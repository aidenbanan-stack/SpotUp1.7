-- Existing SpotUp1.7 cutover. User authorized clearing game/squad data while retaining accounts.
-- Keep the old schema as a private recovery archive, outside every client API.
-- Do not run this on a different project or re-run it after a successful cutover.
alter schema public rename to spotup_legacy;
revoke all on schema spotup_legacy from public, anon, authenticated;
revoke all on all tables in schema spotup_legacy from public, anon, authenticated;
revoke all on all sequences in schema spotup_legacy from public, anon, authenticated;
revoke all on all functions in schema spotup_legacy from public, anon, authenticated;
do $$declare r record;begin
 for r in select tablename from pg_tables where schemaname='spotup_legacy' loop
  execute format('alter table spotup_legacy.%I enable row level security',r.tablename);
 end loop;
 for r in select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='spotup_legacy' loop
  execute format('alter publication supabase_realtime drop table spotup_legacy.%I',r.tablename);
 end loop;
end$$;
create schema public authorization postgres;
grant usage on schema public to anon, authenticated, service_role;
set search_path = public, extensions;
-- New uploads use a separate private avatar bucket. Keep old public image URLs readable.
drop policy if exists "avatars insert own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;


-- 20260907000100_core.sql
-- SpotUp: server-authoritative participation and content foundation.
create extension if not exists pgcrypto;
create table public.sports (id text primary key, name text not null, icon text not null);
insert into public.sports values ('basketball','Basketball','basketball-outline'),('soccer','Soccer','football-outline'),('volleyball','Volleyball','tennisball-outline'),('tennis','Tennis','tennisball-outline'),('other','Other sports','fitness-outline');
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 name text not null check (length(name) between 1 and 60), bio text not null default '' check(length(bio)<=500),
 sports text[] not null default '{}', city text not null default '', avatar_url text,
 showcase_visibility text not null default 'members' check(showcase_visibility in ('members','followers','private')),
 comments_policy text not null default 'members' check(comments_policy in ('members','followers','off')),
 tags_policy text not null default 'followers' check(tags_policy in ('members','followers','off')),
 disabled boolean not null default false,
 interactions_policy text not null default 'members' check(interactions_policy in ('members','followers','off')),
 created_at timestamptz not null default now()
);
create table public.admins (user_id uuid primary key references public.profiles on delete cascade);
create table public.blocks (user_id uuid references public.profiles on delete cascade, target_id uuid references public.profiles on delete cascade, primary key(user_id,target_id), check(user_id<>target_id));
create table public.follows (user_id uuid references public.profiles on delete cascade, target_id uuid references public.profiles on delete cascade, created_at timestamptz not null default now(), primary key(user_id,target_id), check(user_id<>target_id));
create table public.locations (id uuid primary key default gen_random_uuid(), name text not null, address text not null, latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180), place_id text unique, created_by uuid references public.profiles);
create table public.games (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references public.profiles,
 title text not null check(length(title) between 3 and 100), sport_id text not null references public.sports,
 location_id uuid not null references public.locations, starts_at timestamptz not null,
 duration_minutes int not null default 90 check(duration_minutes between 30 and 240),
 capacity int not null check(capacity between 2 and 100), skill text not null check(skill in ('All levels','Casual','Intermediate','Competitive')),
 format text not null default 'Open play', description text not null default '' check(length(description)<=2000),
 visibility text not null default 'public' check(visibility in ('public','private')),
 status text not null default 'upcoming' check(status in ('upcoming','live','completed','cancelled')),
 created_at timestamptz not null default now()
);
create index games_discovery on public.games(status,starts_at,sport_id);
create table public.game_players (game_id uuid references public.games on delete cascade, user_id uuid references public.profiles, joined_at timestamptz not null default now(), checked_in_at timestamptz, confirmed_at timestamptz, checked_out_at timestamptz, primary key(game_id,user_id));
create table public.game_invites (game_id uuid references public.games on delete cascade,user_id uuid references public.profiles,primary key(game_id,user_id));
create table public.reliability_events (game_id uuid references public.games,user_id uuid references public.profiles,attended boolean not null,created_at timestamptz not null default now(),primary key(game_id,user_id));
create table public.xp_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, amount int not null check(amount>0), reason text not null, source text not null, created_at timestamptz not null default now(), unique(user_id,reason,source));
create table public.game_votes (game_id uuid references public.games,user_id uuid references public.profiles,target_id uuid references public.profiles,category text check(category in ('Sportsmanship','Teamwork','Great host')),created_at timestamptz default now(),primary key(game_id,user_id,target_id),check(user_id<>target_id));
create table public.squads (id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles,name text not null check(length(name) between 3 and 60),sport_id text references public.sports,description text not null default '',created_at timestamptz default now());
create table public.squad_members (squad_id uuid references public.squads on delete cascade,user_id uuid references public.profiles,joined_at timestamptz default now(),primary key(squad_id,user_id));
create table public.tournaments (id uuid primary key default gen_random_uuid(),organizer_id uuid not null references public.profiles,name text not null check(length(name) between 3 and 100),sport_id text not null references public.sports,location_id uuid not null references public.locations,starts_at timestamptz not null,registration_deadline timestamptz not null,max_teams int not null check(max_teams in (4,8,16,32)),status text not null default 'registration' check(status in ('registration','live','completed','cancelled')),format text not null default 'single_elimination' check(format='single_elimination'),check(registration_deadline<starts_at));
create table public.tournament_teams (id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments,squad_id uuid not null references public.squads,registered_at timestamptz not null default now(),unique(tournament_id,squad_id));
create table public.tournament_matches (id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments,round int not null,slot int not null,team_a uuid references public.tournament_teams,team_b uuid references public.tournament_teams,score_a int check(score_a>=0),score_b int check(score_b>=0),winner_id uuid references public.tournament_teams,unique(tournament_id,round,slot));
create table public.messages (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,game_id uuid references public.games,squad_id uuid references public.squads,tournament_id uuid references public.tournaments,body text not null check(length(body) between 1 and 2000),removed boolean not null default false,created_at timestamptz not null default now(),check(num_nonnulls(game_id,squad_id,tournament_id)=1));
create index messages_game_time on public.messages(game_id,created_at);
create table public.notifications (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,title text not null,body text not null,path text,read_at timestamptz,created_at timestamptz not null default now());
create table public.notification_preferences (user_id uuid primary key references public.profiles,game_updates boolean not null default true,social boolean not null default true,quiet_start int not null default 22 check(quiet_start between 0 and 23),quiet_end int not null default 8 check(quiet_end between 0 and 23));
create table public.push_tokens (user_id uuid references public.profiles,token text primary key,created_at timestamptz default now());
-- Shared media infrastructure; a social post is NEVER a profile showcase record.
create table public.media_assets (id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles,object_path text not null unique,state text not null default 'uploading' check(state in ('uploading','pending','ready','rejected','deleted')),duration_seconds numeric,byte_size bigint,created_at timestamptz not null default now());
create table public.posts (id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.profiles,media_id uuid not null references public.media_assets,caption text not null default '' check(length(caption)<=1500),sport_id text not null references public.sports,category text not null default 'Highlights',location_id uuid references public.locations,game_id uuid references public.games,squad_id uuid references public.squads,tournament_id uuid references public.tournaments,visibility text not null default 'members' check(visibility in ('members','followers','private')),removed boolean not null default false,created_at timestamptz not null default now());
create table public.showcases (id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.profiles,media_id uuid not null references public.media_assets,sport_id text references public.sports,category text not null default 'Skills',caption text not null default '' check(length(caption)<=1500),removed boolean not null default false,created_at timestamptz not null default now());
create table public.post_tags (post_id uuid references public.posts on delete cascade,user_id uuid references public.profiles,primary key(post_id,user_id));
create table public.reactions (post_id uuid references public.posts on delete cascade,user_id uuid references public.profiles,kind text not null default 'like' check(kind in ('like','fire','clap')),created_at timestamptz default now(),primary key(post_id,user_id));
create table public.saved_posts (post_id uuid references public.posts on delete cascade,user_id uuid references public.profiles,created_at timestamptz default now(),primary key(post_id,user_id));
create table public.comments (id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts on delete cascade,user_id uuid not null references public.profiles,body text not null check(length(body) between 1 and 1000),removed boolean not null default false,created_at timestamptz not null default now());
create table public.reports (id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles,target_type text not null check(target_type in ('post','showcase','comment','message','game','user')),target_id uuid not null,reason text not null check(length(reason) between 3 and 1000),status text not null default 'open' check(status in ('open','dismissed','removed')),created_at timestamptz default now(),unique(reporter_id,target_type,target_id));
create table public.moderation_log (id uuid primary key default gen_random_uuid(),admin_id uuid references public.profiles,report_id uuid references public.reports,action text not null,note text not null,created_at timestamptz default now());
create table public.analytics_events (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,event text not null check(length(event)<=80),entity_id uuid,created_at timestamptz default now());
create index posts_feed on public.posts(created_at desc,sport_id) where not removed;
create index xp_user on public.xp_transactions(user_id);
create index members_user on public.game_players(user_id);
create index comments_post on public.comments(post_id,created_at);

create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from admins where user_id=auth.uid())$$;
create function public.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from blocks where (user_id=a and target_id=b) or (user_id=b and target_id=a))$$;
create function public.is_following(creator uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from follows where user_id=auth.uid() and target_id=creator)$$;
create function public.audience_ok(creator uuid,audience text) returns boolean language sql stable security definer set search_path=public as $$select auth.uid() is not null and not blocked(auth.uid(),creator) and (creator=auth.uid() or audience='members' or (audience='followers' and is_following(creator)))$$;
create function public.can_game(gid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from games g where g.id=gid and not blocked(auth.uid(),g.host_id) and (g.visibility='public' or g.host_id=auth.uid() or exists(select 1 from game_players where game_id=gid and user_id=auth.uid()) or exists(select 1 from game_invites where game_id=gid and user_id=auth.uid())))$$;
create function public.in_game(gid uuid) returns boolean language sql stable security definer set search_path=public as $$select can_game(gid) and exists(select 1 from game_players where game_id=gid and user_id=auth.uid())$$;
create function public.in_squad(sid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from squad_members where squad_id=sid and user_id=auth.uid())$$;
create function public.can_post(pid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from posts p join media_assets m on m.id=p.media_id where p.id=pid and not p.removed and audience_ok(p.creator_id,p.visibility) and (m.state='ready' or p.creator_id=auth.uid()))$$;
create function public.can_showcase(sid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from showcases s join profiles p on p.id=s.creator_id join media_assets m on m.id=s.media_id where s.id=sid and not s.removed and audience_ok(s.creator_id,p.showcase_visibility) and (m.state='ready' or s.creator_id=auth.uid()))$$;
create function public.can_interact(pid uuid,interaction text) returns boolean language sql stable security definer set search_path=public as $$select can_post(pid) and exists(select 1 from posts p join profiles u on u.id=p.creator_id where p.id=pid and (u.id=auth.uid() or audience_ok(u.id,case when interaction='comment' then u.comments_policy when interaction='tag' then u.tags_policy else u.interactions_policy end)))$$;
create function public.xp_total(uid uuid) returns bigint language sql stable security definer set search_path=public as $$select coalesce(sum(amount),0) from xp_transactions where user_id=uid$$;
create function public.reliability(uid uuid) returns numeric language sql stable security definer set search_path=public as $$select round(100.0*count(*) filter(where attended)/nullif(count(*),0),1) from reliability_events where user_id=uid$$;
create function public.award_xp(uid uuid,amt int,why text,src text) returns void language sql security definer set search_path=public as $$insert into xp_transactions(user_id,amount,reason,source) values(uid,amt,why,src) on conflict do nothing$$;
revoke all on function public.award_xp(uuid,int,text,text) from public;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,name) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Player'),60)); insert into notification_preferences(user_id) values(new.id); return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Every mutation takes a transaction-scoped user lock, serializing spam counters.
create function public.require_user() returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=auth.uid();begin if u is null then raise exception 'Please sign in';end if; perform pg_advisory_xact_lock(hashtext(u::text));return u;end$$;
revoke all on function public.require_user() from public;

create function public.create_game(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare u uuid:=require_user();gid uuid;lid uuid;
begin
 if (select count(*) from games where host_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'Game creation limit reached. Try later.';end if;
 if (payload->>'starts_at')::timestamptz<now() then raise exception 'Choose a future start time';end if;
 insert into locations(name,address,latitude,longitude,created_by) values(payload->>'venue',payload->>'address',(payload->>'latitude')::float8,(payload->>'longitude')::float8,u) returning id into lid;
 insert into games(host_id,title,sport_id,location_id,starts_at,capacity,skill,format,description,visibility,duration_minutes) values(u,payload->>'title',payload->>'sport_id',lid,(payload->>'starts_at')::timestamptz,(payload->>'capacity')::int,payload->>'skill',coalesce(payload->>'format','Open play'),coalesce(payload->>'description',''),coalesce(payload->>'visibility','public'),coalesce((payload->>'duration_minutes')::int,90)) returning id into gid;
 insert into game_players(game_id,user_id) values(gid,u);return gid;
end$$;

create function public.game_action(gid uuid,action text,target uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=require_user();g games;p game_players;r record;mins int;
begin
 select * into g from games where id=gid for update;
 if g.id is null or not can_game(gid) then raise exception 'Game unavailable';end if;
 if action='join' then
  if g.status<>'upcoming' or g.starts_at<now() then raise exception 'Registration is closed';end if;
  if exists(select 1 from game_players where game_id=gid and user_id=u) then return;end if;
  if (select count(*) from game_players where game_id=gid)>=g.capacity then raise exception 'This game is full';end if;
  insert into game_players(game_id,user_id) values(gid,u);
  insert into notifications(user_id,title,body,path) values(g.host_id,'A player joined',g.title,'/game/'||gid);
 elsif action='leave' then
  if g.host_id=u then raise exception 'Hosts must cancel the game';end if;
  if g.status<>'upcoming' or now()>=g.starts_at-interval '30 minutes' then raise exception 'Leaving closes 30 minutes before the game';end if;
  delete from game_players where game_id=gid and user_id=u;
 elsif action='checkin' then
  if g.status not in ('upcoming','live') or now()<g.starts_at-interval '15 minutes' or now()>g.starts_at+make_interval(mins=>g.duration_minutes) then raise exception 'Check-in is available near game time';end if;
  update game_players set checked_in_at=coalesce(checked_in_at,now()) where game_id=gid and user_id=u;
  if not found then raise exception 'Join this game first';end if;
 elsif action='checkout' then
  update game_players set checked_out_at=coalesce(checked_out_at,now()) where game_id=gid and user_id=u and confirmed_at is not null;
  if not found then raise exception 'Host must confirm attendance first';end if;
 else
  if g.host_id<>u then raise exception 'Only the host can do that';end if;
  if action='confirm' then
   if g.status not in ('upcoming','live') then raise exception 'Game is closed';end if;
   update game_players set confirmed_at=coalesce(confirmed_at,now()) where game_id=gid and user_id=target and checked_in_at is not null;
   if not found then raise exception 'Player must check in first';end if;
   perform award_xp(target,20,'attendance',gid::text);
  elsif action='start' then
   if g.status<>'upcoming' or now()<g.starts_at-interval '15 minutes' then raise exception 'This game cannot start yet';end if;
   update games set status='live' where id=gid;
  elsif action='cancel' then
   if g.status not in ('upcoming','live') then raise exception 'Game is already closed';end if;
   update games set status='cancelled' where id=gid;
  elsif action='remove' then
   if g.status<>'upcoming' or now()>=g.starts_at or target=u then raise exception 'Player cannot be removed now';end if;
   delete from game_players where game_id=gid and user_id=target;
  elsif action='invite' then
   if blocked(u,target) then raise exception 'Player unavailable';end if;
   insert into game_invites values(gid,target) on conflict do nothing;
   insert into notifications(user_id,title,body,path) values(target,'You are invited to play',g.title,'/game/'||gid);
  elsif action='complete' then
   if g.status<>'live' or now()<g.starts_at then raise exception 'Start the game before completing it';end if;
   update games set status='completed' where id=gid;
   for r in select * from game_players where game_id=gid loop
    insert into reliability_events values(gid,r.user_id,r.confirmed_at is not null,now()) on conflict do nothing;
    if r.confirmed_at is not null then
     mins:=greatest(0,least(120,floor(extract(epoch from (least(coalesce(r.checked_out_at,now()),now(),g.starts_at+make_interval(mins=>g.duration_minutes))-greatest(r.checked_in_at,g.starts_at)))/60)::int));
     if mins>=30 then perform award_xp(r.user_id,5*(mins/30),'time',gid::text);end if;
    end if;
   end loop;
  else raise exception 'Unknown game action';end if;
  if action in ('start','cancel','complete') then insert into notifications(user_id,title,body,path) select user_id,'Game '||action,g.title,'/game/'||gid from game_players where game_id=gid;end if;
 end if;
end$$;

create function public.vote_player(gid uuid,target uuid,category text) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();used int;begin
 if not exists(select 1 from games where id=gid and status='completed') or not exists(select 1 from game_players where game_id=gid and user_id=u and confirmed_at is not null) or not exists(select 1 from game_players where game_id=gid and user_id=target and confirmed_at is not null) or blocked(u,target) then raise exception 'Only confirmed participants can vote after the game';end if;
 insert into game_votes values(gid,u,target,category,now()) on conflict do nothing;
 if found then select coalesce(sum(amount),0) into used from xp_transactions where user_id=u and reason='vote' and source like gid::text||':%';if used<40 then perform award_xp(u,least(15,40-used),'vote',gid::text||':'||target::text);end if;end if;
end$$;
create function public.claim_daily() returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();begin if coalesce(reliability(u),0)<=90 then raise exception 'Reliability above 90%% unlocks this bonus';end if;perform award_xp(u,5,'daily',((now() at time zone 'America/Los_Angeles')-interval '3 hours')::date::text);end$$;

create function public.squad_action(action text,sid uuid default null,payload jsonb default '{}') returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();s squads;begin
 if action in ('create','join') then
  if exists(select 1 from squad_members where user_id=u) then raise exception 'The free plan includes one squad';end if;
  if xp_total(u)<(case when action='create' then 1000 else 500 end) then raise exception 'Earn more participation XP to unlock squads';end if;
  if action='create' then insert into squads(owner_id,name,sport_id,description) values(u,payload->>'name',payload->>'sport_id',coalesce(payload->>'description','')) returning id into sid;end if;
  select * into s from squads where id=sid for update;
  if s.id is null or blocked(u,s.owner_id) then raise exception 'Squad unavailable';end if;
  insert into squad_members values(sid,u,now());
 elsif action='leave' then
  select * into s from squads where id=sid for update;
  if s.owner_id=u then raise exception 'Squad owners cannot leave their squad';end if;
  delete from squad_members where squad_id=sid and user_id=u;
 else raise exception 'Unknown squad action';end if;
 return sid;
end$$;

create function public.send_message(body text,gid uuid default null,sid uuid default null,tid uuid default null) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();begin
 if num_nonnulls(gid,sid,tid)<>1 or not ((gid is not null and in_game(gid)) or (sid is not null and in_squad(sid)) or (tid is not null and exists(select 1 from tournaments where id=tid and (organizer_id=u or exists(select 1 from tournament_teams where tournament_id=tid and in_squad(squad_id)))))) then raise exception 'Join this group to chat';end if;
 if (select count(*) from messages where user_id=u and created_at>now()-interval '1 minute')>=10 then raise exception 'Please slow down';end if;
 insert into messages(user_id,game_id,squad_id,tournament_id,body) values(u,gid,sid,tid,trim(body));
end$$;

create function public.player_summary(uid uuid) returns jsonb language sql stable security definer set search_path=public as $$select case when auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and not disabled) or blocked(auth.uid(),uid) then null else jsonb_build_object('xp',xp_total(uid),'reliability',reliability(uid),'games', (select count(*) from reliability_events where user_id=uid and attended),'followers',(select count(*) from follows where target_id=uid),'level',1+floor(xp_total(uid)/250.0)) end$$;


-- 20260907000200_content_security.sql
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


-- 20260907000300_competition.sql
create function public.create_tournament(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();lid uuid;tid uuid;begin
 if (select count(*) from tournaments where organizer_id=u and starts_at>now())>=3 then raise exception 'Manage your existing tournaments first';end if;
 if (payload->>'registration_deadline')::timestamptz<=now() then raise exception 'Registration deadline must be in the future';end if;
 insert into locations(name,address,latitude,longitude,created_by) values(payload->>'venue',payload->>'address',(payload->>'latitude')::float8,(payload->>'longitude')::float8,u) returning id into lid;
 insert into tournaments(organizer_id,name,sport_id,location_id,starts_at,registration_deadline,max_teams) values(u,payload->>'name',payload->>'sport_id',lid,(payload->>'starts_at')::timestamptz,(payload->>'registration_deadline')::timestamptz,(payload->>'max_teams')::int) returning id into tid;return tid;
end$$;
create function public.tournament_action(tid uuid,action text,sid uuid default null,mid uuid default null,a int default null,b int default null) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=require_user();t tournaments;m tournament_matches;ids uuid[];n int;r int;i int;winner uuid;
begin
 select * into t from tournaments where id=tid for update;
 if t.id is null or blocked(u,t.organizer_id) then raise exception 'Tournament unavailable';end if;
 if action in ('register','withdraw') then
  if t.status<>'registration' or now()>=t.registration_deadline then raise exception 'Registration is closed';end if;
  if not exists(select 1 from squads where id=sid and owner_id=u) then raise exception 'Only the squad owner may register';end if;
  if action='withdraw' then delete from tournament_teams where tournament_id=tid and squad_id=sid;return;end if;
  if (select count(*) from tournament_teams where tournament_id=tid)>=t.max_teams then raise exception 'Tournament is full';end if;
  insert into tournament_teams(tournament_id,squad_id) values(tid,sid);
 else
  if t.organizer_id<>u then raise exception 'Only the organizer may manage this tournament';end if;
  if action='start' then
   if t.status<>'registration' or now()<t.registration_deadline then raise exception 'Wait for registration to close';end if;
   select array_agg(id order by registered_at,id) into ids from tournament_teams where tournament_id=tid;
   n:=coalesce(array_length(ids,1),0);
   if n<>t.max_teams then raise exception 'A full bracket is required before starting';end if;
   for i in 1..n/2 loop insert into tournament_matches(tournament_id,round,slot,team_a,team_b) values(tid,1,i,ids[2*i-1],ids[2*i]);end loop;
   r:=2;n:=n/4;
   while n>=1 loop for i in 1..n loop insert into tournament_matches(tournament_id,round,slot) values(tid,r,i);end loop;r:=r+1;n:=n/2;end loop;
   update tournaments set status='live' where id=tid;
  elsif action='score' then
   if t.status<>'live' then raise exception 'Tournament is not live';end if;
   select * into m from tournament_matches where id=mid and tournament_id=tid for update;
   if m.id is null or m.team_a is null or m.team_b is null or m.winner_id is not null or a is null or b is null or a=b or a<0 or b<0 then raise exception 'Enter a non-tied result for an unplayed match';end if;
   winner:=case when a>b then m.team_a else m.team_b end;
   update tournament_matches set score_a=a,score_b=b,winner_id=winner where id=mid;
   if exists(select 1 from tournament_matches where tournament_id=tid and round=m.round+1 and slot=(m.slot+1)/2) then
    if m.slot%2=1 then update tournament_matches set team_a=winner where tournament_id=tid and round=m.round+1 and slot=(m.slot+1)/2;else update tournament_matches set team_b=winner where tournament_id=tid and round=m.round+1 and slot=(m.slot+1)/2;end if;
   else update tournaments set status='completed' where id=tid;end if;
  elsif action='cancel' then
   if t.status='completed' then raise exception 'Completed tournaments cannot be cancelled';end if;
   update tournaments set status='cancelled' where id=tid;
  else raise exception 'Unknown tournament action';end if;
 end if;
end$$;
create function public.edit_game(gid uuid,payload jsonb) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();g games;begin
 select * into g from games where id=gid for update;
 if g.host_id is distinct from u or g.status<>'upcoming' then raise exception 'Only hosts may edit upcoming games';end if;
 if (payload->>'capacity')::int<(select count(*) from game_players where game_id=gid) then raise exception 'Capacity cannot be below current attendance';end if;
 if (payload->>'starts_at')::timestamptz<=now() then raise exception 'Choose a future start time';end if;
 update games set title=payload->>'title',description=coalesce(payload->>'description',''),capacity=(payload->>'capacity')::int,starts_at=(payload->>'starts_at')::timestamptz where id=gid;
 insert into notifications(user_id,title,body,path) select user_id,'Game details changed',payload->>'title','/game/'||gid from game_players where game_id=gid;
end$$;
create function public.leaderboard(sport text default null,area text default null) returns table(id uuid,name text,xp bigint,reliability numeric,games bigint) language sql stable security definer set search_path=public as $$
 select p.id,p.name,xp_total(p.id),reliability(p.id),(select count(*) from reliability_events r where r.user_id=p.id and r.attended) from profiles p
 where exists(select 1 from profiles active where active.id=auth.uid() and not active.disabled) and not blocked(auth.uid(),p.id) and (sport is null or sport=any(p.sports)) and (area is null or lower(p.city)=lower(area)) order by xp_total(p.id) desc,p.created_at limit 50
$$;
revoke execute on function public.create_tournament(jsonb),public.tournament_action(uuid,text,uuid,uuid,int,int),public.edit_game(uuid,jsonb),public.leaderboard(text,text) from public,anon;
grant execute on function public.create_tournament(jsonb),public.tournament_action(uuid,text,uuid,uuid,int,int),public.edit_game(uuid,jsonb),public.leaderboard(text,text) to authenticated;


-- 20260907000400_operations.sql
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


-- 20260907000500_hardening.sql
create policy moderators_read_comments on comments for select to authenticated using(is_admin());
create policy moderators_read_messages on messages for select to authenticated using(is_admin());
create function public.limit_social_inserts() returns trigger language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();n int;begin
 insert into api_quota values(u,'social',date_trunc('minute',now()),1) on conflict(user_id,service,window_start) do update set hits=api_quota.hits+1 returning api_quota.hits into n;
 if n>60 then raise exception 'Please slow down and try again in a minute';end if;return new;
end$$;
revoke execute on function public.limit_social_inserts() from public,anon,authenticated;
create trigger limit_follows before insert on follows for each row execute function limit_social_inserts();
create trigger limit_reactions before insert on reactions for each row execute function limit_social_inserts();
create trigger limit_saves before insert on saved_posts for each row execute function limit_social_inserts();
-- Client-chosen values remain bounded; no arbitrary sports or gigantic profiles.
alter table profiles add constraint known_sports check(sports <@ array['basketball','soccer','volleyball','tennis','other']::text[]);
alter table profiles add constraint city_length check(length(city)<=100);
alter table squads add constraint squad_description_length check(length(description)<=1000);
alter table posts add constraint post_category_length check(length(category) between 1 and 80);
alter table showcases add constraint showcase_category_length check(length(category) between 1 and 80);
create index media_pending on media_assets(state,created_at);
create index follows_target on follows(target_id,user_id);
create index blocks_target on blocks(target_id,user_id);
create index squad_member_user on squad_members(user_id);
create index notifications_pending on notifications(created_at) where delivered_at is null;
create index analytics_rate on analytics_events(user_id,created_at);
create index messages_rate on messages(user_id,created_at);
create index comments_rate on comments(user_id,created_at);


-- 20260907000600_profile_photos.sql
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('spotup-avatars','spotup-avatars',false,5242880,array['image/jpeg','image/png']) on conflict(id) do nothing;
alter table profiles add constraint own_avatar_path check(avatar_url is null or split_part(avatar_url,'/',1)=id::text);
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='spotup-avatars' and split_part(name,'/',1)=auth.uid()::text);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='spotup-avatars' and exists(select 1 from profiles p where p.avatar_url=name and not blocked(auth.uid(),p.id)));
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='spotup-avatars' and split_part(name,'/',1)=auth.uid()::text);


-- 20260907000700_session_revocation.sql
create function public.session_active() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and not disabled)$$;
revoke execute on function public.session_active() from public,anon;
grant execute on function public.session_active() to authenticated;
-- Restrictive policies close the lifetime of already-issued JWTs after deletion.
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('create policy active_session on public.%I as restrictive for all to authenticated using(public.session_active()) with check(public.session_active())',t);end loop;end$$;
create policy active_storage_session on storage.objects as restrictive for all to authenticated using(public.session_active()) with check(public.session_active());
create or replace function public.require_user() returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=auth.uid();begin if u is null or not session_active() then raise exception 'Please sign in with an active account';end if;perform pg_advisory_xact_lock(hashtext(u::text));return u;end$$;
create or replace function public.audience_ok(creator uuid,audience text) returns boolean language sql stable security definer set search_path=public as $$select session_active() and not blocked(auth.uid(),creator) and (creator=auth.uid() or audience='members' or (audience='followers' and is_following(creator)))$$;


-- 20260907173627_multisport_catalog.sql
insert into public.sports(id,name,icon) values
('badminton','Badminton','fitness-outline'),
('baseball','Baseball','fitness-outline'),
('cricket','Cricket','fitness-outline'),
('dodgeball','Dodgeball','fitness-outline'),
('flag-football','Flag football','fitness-outline'),
('futsal','Futsal','fitness-outline'),
('handball','Handball','fitness-outline'),
('field-hockey','Field hockey','fitness-outline'),
('ice-hockey','Ice hockey','fitness-outline'),
('kickball','Kickball','fitness-outline'),
('lacrosse','Lacrosse','fitness-outline'),
('netball','Netball','fitness-outline'),
('padel','Padel','fitness-outline'),
('pickleball','Pickleball','fitness-outline'),
('rounders','Rounders','fitness-outline'),
('rugby','Rugby','fitness-outline'),
('softball','Softball','fitness-outline'),
('squash','Squash','fitness-outline'),
('table-tennis','Table tennis','fitness-outline'),
('ultimate','Ultimate frisbee','fitness-outline')
on conflict (id) do nothing;

-- Validate against the catalog so new sports never require a new profile constraint.
alter table public.profiles drop constraint known_sports;
create function public.validate_profile_sports() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from unnest(new.sports) as selected(id)
    where not exists (select 1 from public.sports s where s.id = selected.id)) then
    raise exception 'Choose sports from the sports catalog';
  end if;
  return new;
end $$;
revoke all on function public.validate_profile_sports() from public,anon,authenticated;
create trigger validate_profile_sports before insert or update of sports
on public.profiles for each row execute function public.validate_profile_sports();


-- Preserve identity; do not carry over games, squads, XP, or inferred reliability.
alter table public.profiles add column legacy_avatar_url text;
insert into public.profiles(id,name,bio,city,sports,legacy_avatar_url,created_at)
select u.id,left(coalesce(nullif(trim(p.username),''),nullif(trim(u.raw_user_meta_data->>'name'),''),'Player'),60),
 left(coalesce(p.bio,''),500),left(coalesce(p.city,''),120),
 coalesce((select array_agg(distinct s.id) from unnest(array[p.primary_sport] || coalesce(p.secondary_sports,'{}')) v
 join public.sports s on s.id=case lower(v) when 'frisbee' then 'ultimate' when 'football' then 'flag-football' else lower(v) end),'{}'),
 case when p.profile_photo_url like 'https://qzssyfzfrghvmgggzplc.supabase.co/storage/v1/object/public/avatars/%' then p.profile_photo_url else null end,
 coalesce(p.created_at,u.created_at,now())
from auth.users u left join spotup_legacy.profiles p on p.id=u.id;
insert into public.notification_preferences(user_id) select id from public.profiles;
-- Carry over the existing moderator identity; no new user gains admin access.
insert into public.admins(user_id) select id from public.profiles where spotup_legacy.is_admin(id);
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
-- Existing project dashboard already exposes public; no custom API override is needed.
notify pgrst, 'reload schema';
do $$begin
 if (select count(*) from auth.users)<>(select count(*) from public.profiles) then
  raise exception 'Account preservation check failed';
 end if;
 if exists(select 1 from public.games) or exists(select 1 from public.squads) then
  raise exception 'Fresh game and squad state check failed';
 end if;
end$$;
