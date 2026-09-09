create table public.api_quota (user_id uuid references public.profiles,service text,window_start timestamptz,hits int not null,primary key(user_id,service,window_start));
alter table public.api_quota enable row level security;
revoke all on public.api_quota from anon,authenticated;
create function public.use_places_quota() returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();hits int;begin
 insert into api_quota values(u,'places',date_trunc('minute',now()),1) on conflict(user_id,service,window_start) do update set hits=api_quota.hits+1 returning api_quota.hits into hits;
 if hits>30 then raise exception 'Venue search limit reached. Try again in a minute.';end if;
end$$;
-- Retain de-identified competition history, remove authored personal content.
create function public.erase_profile(uid uuid) returns void language plpgsql security definer set search_path=public as $$begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Trusted account service required';end if;
 if exists(select 1 from games where host_id=uid and status in ('upcoming','live')) or exists(select 1 from squads where owner_id=uid) or exists(select 1 from tournaments where organizer_id=uid and status in ('registration','live')) then raise exception 'Cancel active events and transfer or close squad ownership before deleting your account';end if;
 delete from follows where user_id=uid or target_id=uid;
 delete from blocks where user_id=uid or target_id=uid;
 delete from post_tags where user_id=uid;
 delete from reactions where user_id=uid;
 delete from saved_posts where user_id=uid;
 delete from squad_members where user_id=uid;
 delete from game_invites where user_id=uid;
 delete from game_players where user_id=uid and game_id in(select id from games where status='upcoming');
 delete from notifications where user_id=uid;
 delete from push_tokens where user_id=uid;
 delete from analytics_events where user_id=uid;
 update comments set body='[removed]',removed=true where user_id=uid;
 update messages set body='[removed]',removed=true where user_id=uid;
 update posts set caption='',removed=true where creator_id=uid;
 update showcases set caption='',removed=true where creator_id=uid;
 update media_assets set state='deleted' where owner_id=uid;
 update profiles set disabled=true,name='Deleted player',bio='',city='',sports='{}',avatar_url=null,showcase_visibility='private',comments_policy='off',tags_policy='off',interactions_policy='off' where id=uid;
 delete from admins where user_id=uid;
end$$;
create function public.transfer_squad(sid uuid,target uuid default null) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();begin
 if not exists(select 1 from squads where id=sid and owner_id=u) then raise exception 'Only the owner can manage ownership';end if;
 if target is null then
  if exists(select 1 from tournament_teams where squad_id=sid) then raise exception 'Transfer ownership to preserve tournament history';end if;
  delete from messages where squad_id=sid;update posts set squad_id=null where squad_id=sid;delete from squads where id=sid;
 else
  if not exists(select 1 from squad_members where squad_id=sid and user_id=target) or blocked(u,target) then raise exception 'Choose an existing squad member';end if;
  update squads set owner_id=target where id=sid;
 end if;
end$$;
alter table notifications add column delivered_at timestamptz;
alter table notifications add column push_attempts int not null default 0;
alter table notifications add column lease_until timestamptz;
create function public.claim_push_batch() returns setof public.notifications language plpgsql security definer set search_path=public as $$begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker access required';end if;
 return query with batch as (select n.id from notifications n join notification_preferences p on p.user_id=n.user_id where n.delivered_at is null and n.push_attempts<3 and (n.lease_until is null or n.lease_until<now()) and n.created_at>now()-interval '1 day' and p.game_updates and (extract(hour from now() at time zone 'America/Los_Angeles')>=p.quiet_end and extract(hour from now() at time zone 'America/Los_Angeles')<p.quiet_start) order by n.created_at limit 50 for update of n skip locked) update notifications n set lease_until=now()+interval '5 minutes',push_attempts=push_attempts+1 from batch where n.id=batch.id returning n.*;
end$$;
revoke execute on function public.use_places_quota(),public.erase_profile(uuid),public.transfer_squad(uuid,uuid),public.claim_push_batch() from public,anon;
grant execute on function public.use_places_quota(),public.transfer_squad(uuid,uuid) to authenticated;
grant execute on function public.erase_profile(uuid),public.claim_push_batch() to service_role;
grant all on all tables in schema public to service_role;
