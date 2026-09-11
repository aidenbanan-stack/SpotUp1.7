-- Restore account benefits without restoring archived games or squads.
create table public.user_entitlements (
 user_id uuid primary key references public.profiles on delete cascade,
 is_pro boolean not null default false,
 expires_at timestamptz,
 source text not null default 'admin' check(source in ('admin','legacy','stripe')),
 updated_at timestamptz not null default now()
);
alter table public.user_entitlements enable row level security;
grant select on public.user_entitlements to authenticated;
create policy entitlement_read on public.user_entitlements for select to authenticated using(user_id=(select auth.uid()) and public.session_active());
do $$begin
 if to_regclass('spotup_legacy.user_entitlements') is not null then
  execute 'insert into public.user_entitlements(user_id,is_pro,expires_at,source) select e.user_id,e.is_pro and e.is_active,e.expires_at,''legacy'' from spotup_legacy.user_entitlements e join public.profiles p on p.id=e.user_id on conflict do nothing';
 end if;
end$$;
create function public.has_pro_access(uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from profiles where id=uid and not disabled) and (exists(select 1 from admins where user_id=uid) or exists(select 1 from user_entitlements where user_id=uid and is_pro and (expires_at is null or expires_at>now())))
$$;
create function public.get_my_access_state() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('is_pro',has_pro_access(auth.uid()),'is_admin',is_admin())$$;
create function public.admin_set_pro(target uuid,enabled boolean,until_at timestamptz default null) returns void language plpgsql security definer set search_path=public as $$begin
 perform require_user();if not is_admin() then raise exception 'Admin only';end if;
 insert into user_entitlements(user_id,is_pro,expires_at) values(target,enabled,until_at) on conflict(user_id) do update set is_pro=excluded.is_pro,expires_at=excluded.expires_at,source='admin',updated_at=now();
 insert into moderation_log(admin_id,action,note) values(auth.uid(),'pro_access',target::text||':'||enabled::text);
end$$;
alter table public.games add column min_xp int not null default 0 check(min_xp between 0 and 1000000),add column pro_only boolean not null default false,add column recurrence_group_id uuid;
create index games_recurrence_group on public.games(recurrence_group_id) where recurrence_group_id is not null;
-- Trigger makes checks apply to all creation paths; updates cannot expand a paid gate without access.
create function public.guard_game_benefits() returns trigger language plpgsql security definer set search_path=public as $$begin
 if not has_pro_access(new.host_id) and (new.visibility='private' or new.min_xp>0 or new.pro_only or new.recurrence_group_id is not null) then
  if tg_op='INSERT' then raise exception 'SpotUp Pro unlocks private games and advanced hosting';
  elsif (new.visibility,new.min_xp,new.pro_only,new.recurrence_group_id) is distinct from (old.visibility,old.min_xp,old.pro_only,old.recurrence_group_id) then raise exception 'SpotUp Pro is required to change advanced hosting options';end if;
 end if;return new;
end$$;
create trigger game_benefits before insert or update on public.games for each row execute function public.guard_game_benefits();
create function public.guard_game_entry() returns trigger language plpgsql security definer set search_path=public as $$declare g games;begin
 select * into g from games where id=new.game_id;
 if new.user_id<>g.host_id then
  if g.min_xp>xp_total(new.user_id) then raise exception 'This game has a minimum XP requirement';end if;
  if g.pro_only and not has_pro_access(new.user_id) then raise exception 'This game is for Pro members';end if;
 end if;return new;
end$$;
create trigger game_entry before insert on public.game_players for each row execute function public.guard_game_entry();
create function public.schedule_games(payload jsonb,repeat_starts timestamptz[] default '{}') returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();first_id uuid;next_id uuid;stamp timestamptz;grp uuid:=gen_random_uuid();begin
 if cardinality(repeat_starts)>7 then raise exception 'Schedule up to eight sessions at once';end if;
 if (cardinality(repeat_starts)>0 or coalesce((payload->>'min_xp')::int,0)>0 or coalesce((payload->>'pro_only')::boolean,false)) and not has_pro_access(u) then raise exception 'SpotUp Pro unlocks recurring games and host filters';end if;
 first_id:=create_game(payload);
 update games set min_xp=coalesce((payload->>'min_xp')::int,0),pro_only=coalesce((payload->>'pro_only')::boolean,false),recurrence_group_id=case when cardinality(repeat_starts)>0 then grp end where id=first_id;
 foreach stamp in array repeat_starts loop
  if stamp<=(payload->>'starts_at')::timestamptz or stamp>now()+interval '180 days' then raise exception 'Choose later repeat dates within six months';end if;
  if exists(select 1 from games where recurrence_group_id=grp and starts_at=stamp) then raise exception 'Each session needs a different date';end if;
  insert into games(host_id,title,sport_id,location_id,starts_at,duration_minutes,capacity,skill,format,description,visibility,min_xp,pro_only,recurrence_group_id)
   select host_id,title,sport_id,location_id,stamp,duration_minutes,capacity,skill,format,description,visibility,min_xp,pro_only,grp from games where id=first_id returning id into next_id;
  insert into game_players(game_id,user_id) values(next_id,u);
 end loop;return first_id;
end$$;
-- Fantasy is opt-in and free. Roster lock and scoring use server time and confirmed game outcomes.
create table public.fantasy_players(user_id uuid primary key references public.profiles on delete cascade,enabled boolean not null default true,joined_at timestamptz not null default now());
create table public.fantasy_entries(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,name text not null check(length(name) between 3 and 40),week_start date not null,created_at timestamptz not null default now(),unique(owner_id,week_start));
create table public.fantasy_roster(entry_id uuid references public.fantasy_entries on delete cascade,player_id uuid references public.profiles on delete cascade,primary key(entry_id,player_id));
create index fantasy_roster_player on public.fantasy_roster(player_id);
create index fantasy_entries_week on public.fantasy_entries(week_start);
alter table public.fantasy_players enable row level security;
alter table public.fantasy_entries enable row level security;
alter table public.fantasy_roster enable row level security;
create policy fantasy_players_read on public.fantasy_players for select to authenticated using(public.session_active() and not public.blocked(auth.uid(),user_id));
create policy fantasy_entries_read on public.fantasy_entries for select to authenticated using(public.session_active() and not public.blocked(auth.uid(),owner_id));
create policy fantasy_roster_read on public.fantasy_roster for select to authenticated using(public.session_active() and not public.blocked(auth.uid(),player_id) and exists(select 1 from public.fantasy_entries e where e.id=entry_id));
grant select on public.fantasy_players,public.fantasy_entries,public.fantasy_roster to authenticated;
create function public.fantasy_opt_in(opted_in boolean) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();begin
 insert into fantasy_players(user_id,enabled) values(u,opted_in) on conflict(user_id) do update set enabled=excluded.enabled;
end$$;
create function public.save_fantasy_team(team_name text,players uuid[]) returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();eid uuid;wk date:=(date_trunc('week',now() at time zone 'UTC')+interval '7 days')::date;begin
 if cardinality(players)<>3 or (select count(distinct p) from unnest(players) p)<>3 then raise exception 'Choose three different players';end if;
 if exists(select 1 from unnest(players) p where p=u or not exists(select 1 from fantasy_players f join profiles pr on pr.id=f.user_id where f.user_id=p and f.enabled and not pr.disabled and not blocked(u,p))) then raise exception 'Choose three other opted-in players';end if;
 insert into fantasy_entries(owner_id,name,week_start) values(u,trim(team_name),wk) on conflict(owner_id,week_start) do update set name=excluded.name returning id into eid;
 delete from fantasy_roster where entry_id=eid;
 insert into fantasy_roster(entry_id,player_id) select eid,unnest(players);return eid;
end$$;
create function public.fantasy_board(week_offset int default 0) returns table(id uuid,name text,owner_id uuid,owner_name text,points bigint,week_start date) language plpgsql stable security definer set search_path=public as $$begin
 perform require_user();if week_offset not in (0,1,-1) then raise exception 'Choose this, next, or last week';end if;
 return query select e.id,e.name,e.owner_id,p.name,coalesce(sum(scores.pts),0)::bigint,e.week_start
 from fantasy_entries e join profiles p on p.id=e.owner_id
 left join fantasy_roster r on r.entry_id=e.id
 left join lateral (
  select least(3,count(distinct g.id))*10 as pts from games g join game_players gp on gp.game_id=g.id
  join fantasy_players fp on fp.user_id=gp.user_id and fp.enabled
  where gp.user_id=r.player_id and gp.confirmed_at is not null and gp.checked_in_at is not null
   and g.status='completed' and g.host_id<>gp.user_id and not blocked(auth.uid(),gp.user_id)
   and g.starts_at>=e.week_start::timestamp at time zone 'UTC' and g.starts_at<(e.week_start+7)::timestamp at time zone 'UTC'
 ) scores on true
 where e.week_start=(date_trunc('week',now() at time zone 'UTC')+make_interval(weeks=>week_offset))::date and not p.disabled and not blocked(auth.uid(),e.owner_id)
 group by e.id,p.name order by coalesce(sum(scores.pts),0) desc,e.created_at limit 100;
end$$;
revoke all on function public.has_pro_access(uuid),public.get_my_access_state(),public.admin_set_pro(uuid,boolean,timestamptz),public.guard_game_benefits(),public.guard_game_entry(),public.schedule_games(jsonb,timestamptz[]),public.fantasy_opt_in(boolean),public.save_fantasy_team(text,uuid[]),public.fantasy_board(int) from public,anon;
grant execute on function public.has_pro_access(uuid),public.get_my_access_state(),public.admin_set_pro(uuid,boolean,timestamptz),public.schedule_games(jsonb,timestamptz[]),public.fantasy_opt_in(boolean),public.save_fantasy_team(text,uuid[]),public.fantasy_board(int) to authenticated;
alter table public.squads add column join_policy text not null default 'open' check(join_policy in ('open','approval','invite')),add column member_limit int not null default 50 check(member_limit between 2 and 200),add column min_xp int not null default 500 check(min_xp between 500 and 1000000);
alter table public.squad_members add column role text not null default 'member' check(role in ('member','officer','captain'));
create table public.squad_requests(squad_id uuid references public.squads on delete cascade,user_id uuid references public.profiles on delete cascade,kind text not null check(kind in ('application','invite')),note text not null default '' check(length(note)<=500),created_at timestamptz not null default now(),primary key(squad_id,user_id));
create table public.squad_bans(squad_id uuid references public.squads on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(squad_id,user_id));
create table public.squad_announcements(id uuid primary key default gen_random_uuid(),squad_id uuid not null references public.squads on delete cascade,author_id uuid not null references public.profiles,body text not null check(length(body) between 1 and 2000),pinned boolean not null default false,created_at timestamptz not null default now());
create index squad_announcements_recent on public.squad_announcements(squad_id,created_at desc);
create table public.squad_events(id uuid primary key default gen_random_uuid(),squad_id uuid not null references public.squads on delete cascade,created_by uuid not null references public.profiles,title text not null check(length(title) between 3 and 100),starts_at timestamptz not null,place text not null default '' check(length(place)<=300),cancelled boolean not null default false);
create index squad_events_schedule on public.squad_events(squad_id,starts_at);
create table public.squad_event_rsvps(event_id uuid references public.squad_events on delete cascade,user_id uuid references public.profiles on delete cascade,status text not null check(status in ('going','maybe','out')),primary key(event_id,user_id));
create function public.leads_squad(sid uuid) returns boolean language sql stable security definer set search_path=public as $$select session_active() and (exists(select 1 from squads where id=sid and owner_id=auth.uid()) or exists(select 1 from squad_members where squad_id=sid and user_id=auth.uid() and role in ('officer','captain')))$$;
alter table public.squad_requests enable row level security;alter table public.squad_bans enable row level security;alter table public.squad_announcements enable row level security;alter table public.squad_events enable row level security;alter table public.squad_event_rsvps enable row level security;
grant select on public.squad_requests,public.squad_bans,public.squad_announcements,public.squad_events,public.squad_event_rsvps to authenticated;
create policy squad_requests_read on public.squad_requests for select to authenticated using(session_active() and (user_id=auth.uid() or leads_squad(squad_id)));
create policy squad_bans_read on public.squad_bans for select to authenticated using(session_active() and (user_id=auth.uid() or leads_squad(squad_id)));
create policy announcements_read on public.squad_announcements for select to authenticated using(session_active() and in_squad(squad_id) and not blocked(auth.uid(),author_id));
create policy events_read on public.squad_events for select to authenticated using(session_active() and in_squad(squad_id));
create policy rsvps_read on public.squad_event_rsvps for select to authenticated using(session_active() and not blocked(auth.uid(),user_id) and exists(select 1 from squad_events where id=event_id and in_squad(squad_id)));
create function public.squad_membership_guard() returns trigger language plpgsql security definer set search_path=public as $$declare s squads;begin
 select * into s from squads where id=new.squad_id for update;
 if s.owner_id=new.user_id then return new;end if;
 if exists(select 1 from squad_bans where squad_id=new.squad_id and user_id=new.user_id) then raise exception 'Squad membership unavailable';end if;
 if (select count(*) from squad_members where squad_id=new.squad_id)>=s.member_limit then raise exception 'This squad is full';end if;
 if xp_total(new.user_id)<s.min_xp then raise exception 'Earn more participation XP to join this squad';end if;
 if s.join_policy<>'open' and not exists(select 1 from squad_requests where squad_id=new.squad_id and user_id=new.user_id and kind='invite') then raise exception 'This squad requires approval or an invitation';end if;
 if (select count(*) from squad_members where user_id=new.user_id)>=(case when has_pro_access(new.user_id) then 5 else 1 end) then raise exception 'Your squad membership limit is reached';end if;
 return new;
end$$;
create trigger squad_membership before insert on public.squad_members for each row execute function public.squad_membership_guard();
create function public.squad_manage(sid uuid,action text,target uuid default null,payload jsonb default '{}') returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();s squads;eid uuid;begin
 select * into s from squads where id=sid for update;
 if s.id is null or blocked(u,s.owner_id) then raise exception 'Squad unavailable';end if;
 if action='apply' then
  if s.join_policy<>'approval' or in_squad(sid) or exists(select 1 from squad_bans where squad_id=sid and user_id=u) then raise exception 'Applications are unavailable';end if;
  insert into squad_requests(squad_id,user_id,kind,note) values(sid,u,'application',coalesce(payload->>'note','')) on conflict do nothing;return;
 elsif action='accept' then
  if not exists(select 1 from squad_requests where squad_id=sid and user_id=u and kind='invite') then raise exception 'Invitation unavailable';end if;
  insert into squad_members(squad_id,user_id) values(sid,u) on conflict do nothing;delete from squad_requests where squad_id=sid and user_id=u;return;
 elsif action='decline' then delete from squad_requests where squad_id=sid and user_id=u;return;
 elsif action='rsvp' then
  if not in_squad(sid) or not exists(select 1 from squad_events where id=target and squad_id=sid and not cancelled and starts_at>now()) then raise exception 'Event unavailable';end if;
  insert into squad_event_rsvps values(target,u,payload->>'status') on conflict(event_id,user_id) do update set status=excluded.status;return;
 end if;
 if not leads_squad(sid) then raise exception 'Squad leadership required';end if;
 if action='settings' then
  if s.owner_id<>u then raise exception 'Owner only';end if;
  update squads set join_policy=coalesce(payload->>'join_policy',join_policy),member_limit=coalesce((payload->>'member_limit')::int,member_limit),min_xp=coalesce((payload->>'min_xp')::int,min_xp),description=coalesce(payload->>'description',description) where id=sid;
 elsif action in ('invite','approve') then
  if target is null or blocked(u,target) or not exists(select 1 from profiles where id=target and not disabled) then raise exception 'Player unavailable';end if;
  if action='approve' and not exists(select 1 from squad_requests where squad_id=sid and user_id=target and kind='application') then raise exception 'Application unavailable';end if;
  if (select count(*) from squad_requests where squad_id=sid and created_at>now()-interval '1 day')>=50 then raise exception 'Please try inviting more players tomorrow';end if;
  insert into squad_requests(squad_id,user_id,kind) values(sid,target,'invite') on conflict(squad_id,user_id) do update set kind='invite';
  if action='approve' then insert into squad_members(squad_id,user_id) values(sid,target) on conflict do nothing;delete from squad_requests where squad_id=sid and user_id=target;end if;
  insert into notifications(user_id,title,body,path) values(target,case when action='approve' then 'Welcome to the squad' else 'Squad invitation' end,s.name,'/squad/'||sid);
 elsif action='reject' then delete from squad_requests where squad_id=sid and user_id=target;
 elsif action='role' then
  if s.owner_id<>u or target=s.owner_id then raise exception 'Only the owner can assign teammate roles';end if;
  update squad_members set role=payload->>'role' where squad_id=sid and user_id=target;
 elsif action in ('remove','ban','unban') then
  if target=s.owner_id or target=u or (s.owner_id<>u and exists(select 1 from squad_members where squad_id=sid and user_id=target and role<>'member')) then raise exception 'Only the owner can manage squad leaders';end if;
  if action='unban' then delete from squad_bans where squad_id=sid and user_id=target;
  else delete from squad_members where squad_id=sid and user_id=target;delete from squad_requests where squad_id=sid and user_id=target;
   if action='ban' then insert into squad_bans values(sid,target) on conflict do nothing;end if;
  end if;
 elsif action='announce' then
  if (select count(*) from squad_announcements where squad_id=sid and created_at>now()-interval '1 hour')>=10 then raise exception 'Please slow down';end if;
  insert into squad_announcements(squad_id,author_id,body,pinned) values(sid,u,payload->>'body',coalesce((payload->>'pinned')::boolean,false));
 elsif action='delete_announcement' then delete from squad_announcements where id=target and squad_id=sid;
 elsif action='event' then
  if (payload->>'starts_at')::timestamptz<=now() then raise exception 'Choose a future event date';end if;
  if (select count(*) from squad_events where squad_id=sid and starts_at>now() and not cancelled)>=20 then raise exception 'Manage existing events first';end if;
  insert into squad_events(squad_id,created_by,title,starts_at,place) values(sid,u,payload->>'title',(payload->>'starts_at')::timestamptz,coalesce(payload->>'place',''));
 elsif action='cancel_event' then update squad_events set cancelled=true where id=target and squad_id=sid;
 elsif action='invite_to_game' then
  if not exists(select 1 from games where id=target and host_id=u and status='upcoming') then raise exception 'Choose an upcoming game you host';end if;
  insert into game_invites(game_id,user_id) select target,m.user_id from squad_members m where m.squad_id=sid and not blocked(u,m.user_id) on conflict do nothing;
  insert into notifications(user_id,title,body,path) select m.user_id,'Your squad is playing',s.name,'/game/'||target from squad_members m where m.squad_id=sid and not blocked(u,m.user_id);
 else raise exception 'Unknown squad action';end if;
end$$;
revoke all on function public.leads_squad(uuid),public.squad_membership_guard(),public.squad_manage(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.leads_squad(uuid),public.squad_manage(uuid,text,uuid,jsonb) to authenticated;
create or replace function public.squad_action(action text,sid uuid default null,payload jsonb default '{}') returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();s squads;begin
 if action in ('create','join') then
  if (select count(*) from squad_members where user_id=u)>=(case when has_pro_access(u) then 5 else 1 end) then raise exception 'The free plan includes one squad; Pro includes five';end if;
  if xp_total(u)<(case when action='create' then 1000 else 500 end) then raise exception 'Earn more participation XP to unlock squads';end if;
  if action='create' then insert into squads(owner_id,name,sport_id,description) values(u,payload->>'name',payload->>'sport_id',coalesce(payload->>'description','')) returning id into sid;end if;
  select * into s from squads where id=sid for update;
  if s.id is null or blocked(u,s.owner_id) then raise exception 'Squad unavailable';end if;
  insert into squad_members(squad_id,user_id,joined_at) values(sid,u,now());
 elsif action='leave' then
  select * into s from squads where id=sid for update;
  if s.owner_id=u then raise exception 'Squad owners cannot leave their squad';end if;
  delete from squad_members where squad_id=sid and user_id=u;
 else raise exception 'Unknown squad action';end if;
 return sid;
end$$;

