create function public.begin_upload() returns jsonb language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();m media_assets;mid uuid:=gen_random_uuid();begin
 if (select count(*) from media_assets where owner_id=u and created_at>now()-interval '1 day')>=10 then raise exception 'Daily video limit reached';end if;
 insert into media_assets(id,owner_id,object_path) values(mid,u,u::text||'/'||mid::text||'.mp4') returning * into m;return to_jsonb(m);
end$$;
create function public.publish_video(mid uuid,kind text,payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();m media_assets;pid uuid;tag uuid;begin
 select * into m from media_assets where id=mid and owner_id=u for update;
 if m.id is null or m.state<>'uploading' then raise exception 'Upload unavailable';end if;
 if not exists(select 1 from storage.objects where bucket_id='videos' and name=m.object_path) then raise exception 'Finish uploading your video first';end if;
 if jsonb_array_length(coalesce(payload->'tags','[]'))>20 then raise exception 'Tag at most 20 players';end if;
 if kind='post' then
  if payload->>'game_id' is not null and not in_game((payload->>'game_id')::uuid) then raise exception 'Only link games you joined';end if;
  if payload->>'squad_id' is not null and not in_squad((payload->>'squad_id')::uuid) then raise exception 'Only link your squad';end if;
  if payload->>'tournament_id' is not null and not exists(select 1 from tournaments where id=(payload->>'tournament_id')::uuid and status<>'cancelled') then raise exception 'Tournament unavailable';end if;
  insert into posts(creator_id,media_id,caption,sport_id,category,location_id,game_id,squad_id,tournament_id,visibility) values(u,mid,coalesce(payload->>'caption',''),payload->>'sport_id',coalesce(payload->>'category','Highlights'),(payload->>'location_id')::uuid,(payload->>'game_id')::uuid,(payload->>'squad_id')::uuid,(payload->>'tournament_id')::uuid,coalesce(payload->>'visibility','members')) returning id into pid;
  for tag in select jsonb_array_elements_text(coalesce(payload->'tags','[]'))::uuid loop
   if not exists(select 1 from profiles where id=tag and audience_ok(id,tags_policy)) then raise exception 'This player does not allow this tag';end if;
   insert into post_tags values(pid,tag) on conflict do nothing;
  end loop;
 elsif kind='showcase' then
  insert into showcases(creator_id,media_id,caption,sport_id,category) values(u,mid,coalesce(payload->>'caption',''),payload->>'sport_id',coalesce(payload->>'category','Skills')) returning id into pid;
 else raise exception 'Choose a post or skill showcase';end if;
 update media_assets set state='pending' where id=mid;
 return pid;
end$$;

-- Only trusted service workers or admins may release media after verification.
create function public.review_media(mid uuid,approved boolean,verified_seconds numeric,verified_bytes bigint) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_admin() and coalesce(auth.role(),'')<>'service_role' then raise exception 'Moderator access required';end if;
 if approved and (verified_seconds is null or verified_seconds<=0 or verified_seconds>90 or verified_bytes is null or verified_bytes<=0 or verified_bytes>104857600) then raise exception 'Videos must be under 90 seconds and 100 MB';end if;
 update media_assets set state=case when approved then 'ready' else 'rejected' end,duration_seconds=verified_seconds,byte_size=verified_bytes where id=mid and state='pending';
 if not found then raise exception 'Pending video not found';end if;
 insert into moderation_log(admin_id,action,note) values(auth.uid(),'media_review',mid::text||':'||approved::text);
end$$;

create function public.social_action(action text,target uuid,value text default null) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();creator uuid;begin
 if action='block' then
  insert into blocks values(u,target) on conflict do nothing;
  delete from follows where (user_id=u and target_id=target) or (user_id=target and target_id=u);
 elsif action='unblock' then delete from blocks where user_id=u and target_id=target;
 elsif action='follow' then
  if blocked(u,target) then raise exception 'Player unavailable';end if;
  if exists(select 1 from follows where user_id=u and target_id=target) then delete from follows where user_id=u and target_id=target;else insert into follows(user_id,target_id) values(u,target);end if;
 elsif action='save' then
  if not can_post(target) then raise exception 'Post unavailable';end if;
  if exists(select 1 from saved_posts where post_id=target and user_id=u) then delete from saved_posts where post_id=target and user_id=u;else insert into saved_posts(post_id,user_id) values(target,u);end if;
 elsif action='react' then
  if not can_interact(target,'react') then raise exception 'Reactions are restricted';end if;
  if exists(select 1 from reactions where post_id=target and user_id=u) then delete from reactions where post_id=target and user_id=u;else insert into reactions(post_id,user_id,kind) values(target,u,coalesce(value,'like'));end if;
 elsif action='comment' then
  if not can_interact(target,'comment') then raise exception 'Comments are restricted';end if;
  if (select count(*) from comments where user_id=u and created_at>now()-interval '1 minute')>=5 then raise exception 'Please slow down';end if;
  insert into comments(post_id,user_id,body) values(target,u,trim(value));
 elsif action='delete_post' then update posts set removed=true where id=target and creator_id=u;
 elsif action='delete_showcase' then update showcases set removed=true where id=target and creator_id=u;
 elsif action='delete_comment' then update comments set removed=true where id=target and user_id=u;
 elsif action='delete_message' then update messages set removed=true where id=target and user_id=u;
 elsif action='untag' then delete from post_tags where post_id=target and user_id=u;
 else raise exception 'Unknown social action';end if;
end$$;
create function public.report_content(kind text,target uuid,reason text) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();begin
 if (select count(*) from reports where reporter_id=u and created_at>now()-interval '1 hour')>=10 then raise exception 'Report limit reached';end if;
 insert into reports(reporter_id,target_type,target_id,reason) values(u,kind,target,trim(reason)) on conflict(reporter_id,target_type,target_id) do nothing;
end$$;
create function public.moderate_report(rid uuid,decision text,note text) returns void language plpgsql security definer set search_path=public as $$declare r reports;u uuid:=require_user();begin
 if not is_admin() then raise exception 'Moderator access required';end if;
 if decision not in ('dismissed','removed') or length(trim(note))<3 then raise exception 'Choose a decision and explain it';end if;
 select * into r from reports where id=rid for update;
 if r.id is null or r.status<>'open' then raise exception 'Report already resolved';end if;
 if decision='removed' then
  case r.target_type
   when 'post' then update posts set removed=true where id=r.target_id;
   when 'showcase' then update showcases set removed=true where id=r.target_id;
   when 'comment' then update comments set removed=true where id=r.target_id;
   when 'message' then update messages set removed=true where id=r.target_id;
   when 'game' then update games set status='cancelled' where id=r.target_id;
   else raise exception 'Account suspension requires the trusted account administration service';
  end case;
 end if;
 update reports set status=decision where id=rid;
 insert into moderation_log(admin_id,report_id,action,note) values(u,rid,decision,note);
end$$;

-- Recommendation factors favour relevance and participation. No watch-time score.
create function public.content_feed(mode text default 'recommended',sport text default null,area text default null,before_time timestamptz default now(),before_id uuid default 'ffffffff-ffff-ffff-ffff-ffffffffffff',page_size int default 15) returns setof public.posts language sql stable security definer set search_path=public as $$
 select p.* from posts p join media_assets m on m.id=p.media_id join profiles c on c.id=p.creator_id
 where can_post(p.id) and m.state='ready' and (sport is null or p.sport_id=sport)
 and (p.created_at,p.id)<(before_time,before_id)
 and (mode<>'following' or is_following(p.creator_id))
 and (mode<>'local' or (area is not null and length(trim(area))>0 and (lower(c.city)=lower(area) or exists(select 1 from locations l where l.id=p.location_id and l.address ilike '%'||area||'%'))))
 and (mode<>'saved' or exists(select 1 from saved_posts s where s.post_id=p.id and s.user_id=auth.uid()))
 -- Select a chronological candidate page; client keeps its cursor independently of reranking.
 order by p.created_at desc,p.id desc limit greatest(1,least(page_size,30))
$$;
create function public.content_signals(pids uuid[]) returns table(post_id uuid,score numeric,reason text) language sql stable security definer set search_path=public as $$
 select p.id,
 (case when p.sport_id=any(u.sports) then 4 else 0 end+case when is_following(p.creator_id) then 4 else 0 end+case when lower(c.city)=lower(u.city) and u.city<>'' then 3 else 0 end+case when p.game_id is not null and in_game(p.game_id) then 5 else 0 end+case when p.squad_id is not null and in_squad(p.squad_id) then 5 else 0 end+case when p.game_id is not null then 2 else 0 end+least(2,(select count(*) from reactions r where r.post_id=p.id)/5.0)+greatest(0,2-extract(epoch from(now()-p.created_at))/86400))::numeric,
 case when p.game_id is not null and in_game(p.game_id) then 'From a game you joined' when is_following(p.creator_id) then 'A player you follow' when lower(c.city)=lower(u.city) and u.city<>'' then 'From your area' when p.sport_id=any(u.sports) then 'One of your sports' else 'Discover a new player' end
 from posts p join profiles c on c.id=p.creator_id join profiles u on u.id=auth.uid() where p.id=any(pids) and can_post(p.id)
$$;

-- RLS everywhere; domain writes go through validated RPCs, never client updates.
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon, authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end$$;
create policy sports_read on sports for select to authenticated using(true);
create policy profile_read on profiles for select to authenticated using(not blocked(auth.uid(),id));
create policy profile_update on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant update(name,bio,sports,city,avatar_url,showcase_visibility,comments_policy,tags_policy,interactions_policy) on profiles to authenticated;
create policy admin_self on admins for select to authenticated using(user_id=auth.uid());
create policy blocks_self on blocks for select to authenticated using(user_id=auth.uid());
create policy follows_read on follows for select to authenticated using(not blocked(auth.uid(),user_id) and not blocked(auth.uid(),target_id));
create policy locations_read on locations for select to authenticated using(created_by=auth.uid() or exists(select 1 from games where location_id=locations.id and can_game(id)) or exists(select 1 from tournaments where location_id=locations.id) or exists(select 1 from posts where location_id=locations.id and can_post(id)));
create policy games_read on games for select to authenticated using(can_game(id));
create policy players_read on game_players for select to authenticated using(can_game(game_id) and not blocked(auth.uid(),user_id));
create policy invites_read on game_invites for select to authenticated using(user_id=auth.uid() or exists(select 1 from games where id=game_id and host_id=auth.uid()));
create policy reliability_read on reliability_events for select to authenticated using(user_id=auth.uid());
create policy xp_read on xp_transactions for select to authenticated using(user_id=auth.uid());
create policy votes_read on game_votes for select to authenticated using(user_id=auth.uid());
create policy squads_read on squads for select to authenticated using(not blocked(auth.uid(),owner_id));
create policy squad_members_read on squad_members for select to authenticated using(not blocked(auth.uid(),user_id));
create policy tournaments_read on tournaments for select to authenticated using(not blocked(auth.uid(),organizer_id));
create policy teams_read on tournament_teams for select to authenticated using(exists(select 1 from tournaments where id=tournament_id));
create policy matches_read on tournament_matches for select to authenticated using(exists(select 1 from tournaments where id=tournament_id));
create policy messages_read on messages for select to authenticated using(not removed and not blocked(auth.uid(),user_id) and ((game_id is not null and in_game(game_id)) or (squad_id is not null and in_squad(squad_id)) or (tournament_id is not null and exists(select 1 from tournaments t where t.id=tournament_id and (t.organizer_id=auth.uid() or exists(select 1 from tournament_teams tt where tt.tournament_id=t.id and in_squad(tt.squad_id)))))));
create policy notifications_read on notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_update on notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant update(read_at) on notifications to authenticated;
create policy preferences_read on notification_preferences for select to authenticated using(user_id=auth.uid());
create policy preferences_update on notification_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant update(game_updates,social,quiet_start,quiet_end) on notification_preferences to authenticated;
create policy tokens_self on push_tokens for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant insert,update,delete on push_tokens to authenticated;
create policy media_read on media_assets for select to authenticated using(owner_id=auth.uid() or is_admin() or exists(select 1 from posts p where p.media_id=media_assets.id and can_post(p.id)) or exists(select 1 from showcases s where s.media_id=media_assets.id and can_showcase(s.id)));
create policy posts_read on posts for select to authenticated using(can_post(id) or is_admin());
create policy showcases_read on showcases for select to authenticated using(can_showcase(id) or is_admin());
create policy tags_read on post_tags for select to authenticated using(can_post(post_id) and not blocked(auth.uid(),user_id));
create policy reactions_read on reactions for select to authenticated using(can_post(post_id) and not blocked(auth.uid(),user_id));
create policy saved_read on saved_posts for select to authenticated using(user_id=auth.uid() and can_post(post_id));
create policy comments_read on comments for select to authenticated using(can_post(post_id) and not removed and not blocked(auth.uid(),user_id));
create policy reports_read on reports for select to authenticated using(reporter_id=auth.uid() or is_admin());
create policy moderation_read on moderation_log for select to authenticated using(is_admin());
create policy analytics_read on analytics_events for select to authenticated using(user_id=auth.uid());
create function public.track_event(event_name text,entity uuid default null) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();begin if (select count(*) from analytics_events where user_id=u and created_at>now()-interval '1 minute')<60 then insert into analytics_events(user_id,event,entity_id) values(u,event_name,entity);end if;end$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('videos','videos',false,104857600,array['video/mp4','video/quicktime']) on conflict(id) do nothing;
create policy video_upload on storage.objects for insert to authenticated with check(bucket_id='videos' and exists(select 1 from media_assets m where m.object_path=name and m.owner_id=auth.uid() and m.state='uploading'));
create policy video_read on storage.objects for select to authenticated using(bucket_id='videos' and exists(select 1 from media_assets m where m.object_path=name and (m.owner_id=auth.uid() or is_admin() or (m.state='ready' and (exists(select 1 from posts p where p.media_id=m.id and can_post(p.id)) or exists(select 1 from showcases s where s.media_id=m.id and can_showcase(s.id)))))));

-- Public execute is revoked, including helper functions callable by anonymous users.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin(),public.blocked(uuid,uuid),public.is_following(uuid),public.audience_ok(uuid,text),public.can_game(uuid),public.in_game(uuid),public.in_squad(uuid),public.can_post(uuid),public.can_showcase(uuid),public.can_interact(uuid,text),public.player_summary(uuid) to authenticated;
grant execute on function public.create_game(jsonb),public.game_action(uuid,text,uuid),public.vote_player(uuid,uuid,text),public.claim_daily(),public.squad_action(text,uuid,jsonb),public.send_message(text,uuid,uuid,uuid),public.begin_upload(),public.publish_video(uuid,text,jsonb),public.review_media(uuid,boolean,numeric,bigint),public.social_action(text,uuid,text),public.report_content(text,uuid,text),public.moderate_report(uuid,text,text),public.content_feed(text,text,text,timestamptz,uuid,int),public.content_signals(uuid[]),public.track_event(text,uuid) to authenticated;
grant execute on function public.review_media(uuid,boolean,numeric,bigint) to service_role;

alter publication supabase_realtime add table public.messages,public.game_players,public.games,public.notifications,public.tournament_matches;
