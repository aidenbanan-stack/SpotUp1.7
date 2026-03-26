-- =========================================================
-- PHASE 4: Squads competitive system + discover search
-- =========================================================

-- ---------------------------------------------------------
-- 1) Entitlements helpers (safe if phase 2 already created them)
-- ---------------------------------------------------------
create table if not exists public.user_entitlements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entitlement_key text not null,
  is_active boolean not null default true,
  granted_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement_key)
);

create or replace function public.has_pro_access(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_entitlements ue
    where ue.user_id = p_user_id
      and ue.entitlement_key = 'spotup_pro'
      and ue.is_active = true
  );
$$;

create or replace function public.get_my_plan_info()
returns table (is_pro boolean)
language sql
security definer
set search_path = public
as $$
  select public.has_pro_access(auth.uid()) as is_pro;
$$;

grant execute on function public.has_pro_access(uuid) to authenticated;
grant execute on function public.get_my_plan_info() to authenticated;

-- ---------------------------------------------------------
-- 2) Expand squads table for competitive system
-- ---------------------------------------------------------
alter table public.squads
  add column if not exists wins integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists points integer not null default 0,
  add column if not exists rating integer not null default 1000,
  add column if not exists home_area text,
  add column if not exists min_join_xp integer not null default 0,
  add column if not exists member_cap integer not null default 10,
  add column if not exists is_recruiting boolean not null default true;

alter table public.squads
  alter column member_cap set default 10;

update public.squads
set member_cap = 10
where member_cap is null or member_cap <> 10;

update public.squads s
set home_area = p.city
from public.profiles p
where s.owner_id = p.id
  and (s.home_area is null or btrim(s.home_area) = '');

-- ---------------------------------------------------------
-- 3) Competitive squad tables
-- ---------------------------------------------------------
create table if not exists public.squad_match_results (
  id uuid primary key default gen_random_uuid(),
  squad_a_id uuid not null references public.squads(id) on delete cascade,
  squad_b_id uuid not null references public.squads(id) on delete cascade,
  winner_squad_id uuid not null references public.squads(id) on delete cascade,
  loser_squad_id uuid not null references public.squads(id) on delete cascade,
  recorded_by uuid references public.profiles(id),
  related_game_id uuid references public.games(id) on delete set null,
  related_tournament_id uuid references public.tournaments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint squad_match_results_distinct_squads check (squad_a_id <> squad_b_id),
  constraint squad_match_results_winner_in_match check (winner_squad_id in (squad_a_id, squad_b_id)),
  constraint squad_match_results_loser_in_match check (loser_squad_id in (squad_a_id, squad_b_id)),
  constraint squad_match_results_winner_loser_distinct check (winner_squad_id <> loser_squad_id)
);

create table if not exists public.squad_point_events (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  points integer not null,
  related_game_id uuid references public.games(id) on delete set null,
  related_match_id uuid references public.squad_match_results(id) on delete set null,
  related_tournament_id uuid references public.tournaments(id) on delete set null,
  related_user_id uuid references public.profiles(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (squad_id, event_key)
);

alter table public.squad_match_results enable row level security;
alter table public.squad_point_events enable row level security;

drop policy if exists squad_match_results_select_all_authenticated on public.squad_match_results;
create policy squad_match_results_select_all_authenticated
on public.squad_match_results
for select
to authenticated
using (true);

drop policy if exists squad_point_events_select_all_authenticated on public.squad_point_events;
create policy squad_point_events_select_all_authenticated
on public.squad_point_events
for select
to authenticated
using (true);

-- ---------------------------------------------------------
-- 4) Competitive scoring helpers
-- ---------------------------------------------------------
create or replace function public.award_squad_points_once(
  p_squad_id uuid,
  p_event_key text,
  p_event_type text,
  p_points integer,
  p_related_game_id uuid default null,
  p_related_match_id uuid default null,
  p_related_tournament_id uuid default null,
  p_related_user_id uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_inserted integer;
begin
  insert into public.squad_point_events (
    squad_id,
    event_key,
    event_type,
    points,
    related_game_id,
    related_match_id,
    related_tournament_id,
    related_user_id,
    meta
  ) values (
    p_squad_id,
    p_event_key,
    p_event_type,
    p_points,
    p_related_game_id,
    p_related_match_id,
    p_related_tournament_id,
    p_related_user_id,
    coalesce(p_meta, '{}'::jsonb)
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.squads
    set points = coalesce(points, 0) + p_points
    where id = p_squad_id;
    return true;
  end if;

  return false;
end;
$function$;

create or replace function public.recalculate_squad_stats(p_squad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_wins integer;
  v_losses integer;
  v_points integer;
begin
  select count(*) into v_wins
  from public.squad_match_results
  where winner_squad_id = p_squad_id;

  select count(*) into v_losses
  from public.squad_match_results
  where loser_squad_id = p_squad_id;

  select coalesce(sum(points), 0) into v_points
  from public.squad_point_events
  where squad_id = p_squad_id;

  update public.squads
  set wins = coalesce(v_wins, 0),
      losses = coalesce(v_losses, 0),
      points = coalesce(v_points, 0),
      rating = greatest(100, 1000 + coalesce(v_wins, 0) * 20 - coalesce(v_losses, 0) * 8)
  where id = p_squad_id;
end;
$function$;

create or replace function public.record_squad_match_result(
  p_squad_a_id uuid,
  p_squad_b_id uuid,
  p_winner_squad_id uuid,
  p_related_game_id uuid default null,
  p_related_tournament_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_loser uuid;
  v_match_id uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  -- admin-only for now so result entry stays trusted
  if v_actor <> 'ab1f49da-0b7a-4ee8-b63e-1a07927e2717'::uuid then
    raise exception 'Only admin can record squad match results right now';
  end if;

  if p_squad_a_id = p_squad_b_id then
    raise exception 'Squads must be different';
  end if;

  if p_winner_squad_id not in (p_squad_a_id, p_squad_b_id) then
    raise exception 'Winner must be one of the two squads';
  end if;

  v_loser := case when p_winner_squad_id = p_squad_a_id then p_squad_b_id else p_squad_a_id end;

  insert into public.squad_match_results (
    squad_a_id,
    squad_b_id,
    winner_squad_id,
    loser_squad_id,
    recorded_by,
    related_game_id,
    related_tournament_id,
    notes
  ) values (
    p_squad_a_id,
    p_squad_b_id,
    p_winner_squad_id,
    v_loser,
    v_actor,
    p_related_game_id,
    p_related_tournament_id,
    p_notes
  )
  returning id into v_match_id;

  perform public.award_squad_points_once(
    p_winner_squad_id,
    'match_win:' || v_match_id::text,
    'match_win',
    10,
    p_related_game_id,
    v_match_id,
    p_related_tournament_id,
    null,
    jsonb_build_object('loser_squad_id', v_loser)
  );

  perform public.award_squad_points_once(
    v_loser,
    'match_loss:' || v_match_id::text,
    'match_loss',
    -2,
    p_related_game_id,
    v_match_id,
    p_related_tournament_id,
    null,
    jsonb_build_object('winner_squad_id', p_winner_squad_id)
  );

  perform public.recalculate_squad_stats(p_winner_squad_id);
  perform public.recalculate_squad_stats(v_loser);

  return v_match_id;
end;
$function$;

grant execute on function public.award_squad_points_once(uuid, text, text, integer, uuid, uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.recalculate_squad_stats(uuid) to authenticated;
grant execute on function public.record_squad_match_result(uuid, uuid, uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 5) Secure create / join / leave squad flows
-- ---------------------------------------------------------
drop function if exists public.create_squad_secure(text, text, integer);
create or replace function public.create_squad_secure(
  p_name text,
  p_sport text default null,
  p_min_join_xp integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_xp integer := 0;
  v_is_pro boolean := false;
  v_owned_count integer := 0;
  v_code text;
  v_squad_id uuid;
  v_home_area text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(xp, 0), city into v_xp, v_home_area
  from public.profiles
  where id = v_uid;

  if v_xp < 1000 then
    raise exception 'You need 1000 XP to create a squad';
  end if;

  v_is_pro := public.has_pro_access(v_uid);

  select count(*) into v_owned_count
  from public.squads
  where owner_id = v_uid;

  if not v_is_pro and v_owned_count >= 1 then
    raise exception 'Free plan users can only own 1 squad at a time';
  end if;

  if not v_is_pro and coalesce(p_min_join_xp, 0) > 0 then
    raise exception 'Only Pro squad creators can require a minimum XP to join';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.squads (
    name,
    sport,
    owner_id,
    invite_code,
    home_area,
    min_join_xp,
    member_cap,
    wins,
    losses,
    points,
    rating,
    is_recruiting
  ) values (
    btrim(p_name),
    nullif(btrim(coalesce(p_sport, '')), ''),
    v_uid,
    v_code,
    nullif(btrim(coalesce(v_home_area, '')), ''),
    greatest(0, coalesce(p_min_join_xp, 0)),
    10,
    0,
    0,
    0,
    1000,
    true
  )
  returning id into v_squad_id;

  insert into public.squad_members (squad_id, user_id, role)
  values (v_squad_id, v_uid, 'owner')
  on conflict do nothing;

  return v_squad_id;
end;
$function$;

drop function if exists public.join_squad_secure(uuid);
create or replace function public.join_squad_secure(p_squad_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_xp integer := 0;
  v_is_pro boolean := false;
  v_member_count integer := 0;
  v_current_squad_count integer := 0;
  v_min_join_xp integer := 0;
  v_member_cap integer := 10;
  v_is_recruiting boolean := true;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(xp, 0) into v_xp
  from public.profiles
  where id = v_uid;

  if v_xp < 500 then
    raise exception 'You need 500 XP to join a squad';
  end if;

  select coalesce(min_join_xp, 0), coalesce(member_cap, 10), coalesce(is_recruiting, true)
  into v_min_join_xp, v_member_cap, v_is_recruiting
  from public.squads
  where id = p_squad_id;

  if not found then
    raise exception 'Squad not found';
  end if;

  if not v_is_recruiting then
    raise exception 'This squad is not currently recruiting';
  end if;

  if v_xp < v_min_join_xp then
    raise exception 'You do not meet this squad''s minimum XP requirement';
  end if;

  v_is_pro := public.has_pro_access(v_uid);

  if not v_is_pro then
    select count(*) into v_current_squad_count
    from public.squad_members
    where user_id = v_uid;

    if v_current_squad_count >= 1 then
      raise exception 'Free plan users can only join 1 squad at a time';
    end if;
  end if;

  select count(*) into v_member_count
  from public.squad_members
  where squad_id = p_squad_id;

  if v_member_count >= v_member_cap then
    raise exception 'This squad is full';
  end if;

  insert into public.squad_members (squad_id, user_id, role)
  values (p_squad_id, v_uid, 'member')
  on conflict do nothing;

  return p_squad_id;
end;
$function$;

drop function if exists public.leave_squad_secure(uuid);
create or replace function public.leave_squad_secure(p_squad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_member_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id into v_owner_id
  from public.squads
  where id = p_squad_id;

  if not found then
    raise exception 'Squad not found';
  end if;

  if v_owner_id = v_uid then
    raise exception 'Owner cannot leave the squad without transferring or deleting it';
  end if;

  delete from public.squad_members
  where squad_id = p_squad_id
    and user_id = v_uid;

  select count(*) into v_member_count
  from public.squad_members
  where squad_id = p_squad_id;

  if v_member_count <= 0 then
    delete from public.squads where id = p_squad_id and owner_id <> v_uid;
  end if;
end;
$function$;

grant execute on function public.create_squad_secure(text, text, integer) to authenticated;
grant execute on function public.join_squad_secure(uuid) to authenticated;
grant execute on function public.leave_squad_secure(uuid) to authenticated;

-- ---------------------------------------------------------
-- 6) Squad discover search + leaderboard view
-- ---------------------------------------------------------
create or replace view public.squad_competitive_leaderboard as
select
  s.id as squad_id,
  s.name,
  s.sport,
  s.home_area,
  s.created_at,
  coalesce(s.wins, 0) as wins,
  coalesce(s.losses, 0) as losses,
  coalesce(s.points, 0) as points,
  coalesce(s.rating, 1000) as rating,
  case
    when coalesce(s.wins, 0) + coalesce(s.losses, 0) > 0
      then coalesce(s.wins, 0)::numeric / (coalesce(s.wins, 0) + coalesce(s.losses, 0))::numeric
    else 0::numeric
  end as win_pct,
  count(sm.user_id) as member_count,
  coalesce(sum(p.xp), 0) as total_xp
from public.squads s
left join public.squad_members sm on sm.squad_id = s.id
left join public.profiles p on p.id = sm.user_id
group by s.id;

create or replace function public.search_squads(
  p_query text default null,
  p_area text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  sport text,
  owner_id uuid,
  invite_code text,
  created_at timestamptz,
  wins integer,
  losses integer,
  points integer,
  rating integer,
  home_area text,
  min_join_xp integer,
  member_cap integer,
  is_recruiting boolean,
  member_count bigint,
  owner_username text,
  owner_city text
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      s.id,
      s.name,
      s.sport,
      s.owner_id,
      s.invite_code,
      s.created_at,
      coalesce(s.wins, 0) as wins,
      coalesce(s.losses, 0) as losses,
      coalesce(s.points, 0) as points,
      coalesce(s.rating, 1000) as rating,
      s.home_area,
      coalesce(s.min_join_xp, 0) as min_join_xp,
      coalesce(s.member_cap, 10) as member_cap,
      coalesce(s.is_recruiting, true) as is_recruiting,
      count(sm.user_id) as member_count,
      p.username as owner_username,
      p.city as owner_city
    from public.squads s
    left join public.squad_members sm on sm.squad_id = s.id
    left join public.profiles p on p.id = s.owner_id
    where (
      p_query is null
      or btrim(p_query) = ''
      or s.name ilike '%' || p_query || '%'
      or s.invite_code ilike '%' || p_query || '%'
    )
    group by s.id, p.username, p.city
  )
  select *
  from base
  order by
    case
      when p_area is not null and btrim(p_area) <> '' and lower(coalesce(home_area, owner_city, '')) = lower(p_area) then 0
      else 1
    end,
    points desc,
    rating desc,
    member_count desc,
    created_at desc
  limit greatest(coalesce(p_limit, 20), 1);
$$;

grant select on public.squad_competitive_leaderboard to authenticated;
grant execute on function public.search_squads(text, text, integer) to authenticated;

-- ---------------------------------------------------------
-- 7) Optional: allow squad owners / admin to update recruiting fields
-- ---------------------------------------------------------
create or replace function public.update_squad_settings(
  p_squad_id uuid,
  p_is_recruiting boolean default null,
  p_min_join_xp integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_is_pro boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.squads where id = p_squad_id and owner_id = v_uid
  ) and v_uid <> 'ab1f49da-0b7a-4ee8-b63e-1a07927e2717'::uuid then
    raise exception 'Only the squad owner can update settings';
  end if;

  v_is_pro := public.has_pro_access(v_uid);

  update public.squads
  set is_recruiting = coalesce(p_is_recruiting, is_recruiting),
      min_join_xp = case
        when p_min_join_xp is null then min_join_xp
        when v_is_pro or v_uid = 'ab1f49da-0b7a-4ee8-b63e-1a07927e2717'::uuid then greatest(0, p_min_join_xp)
        else min_join_xp
      end
  where id = p_squad_id;

  return p_squad_id;
end;
$function$;

grant execute on function public.update_squad_settings(uuid, boolean, integer) to authenticated;
