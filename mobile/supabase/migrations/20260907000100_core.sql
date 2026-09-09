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
