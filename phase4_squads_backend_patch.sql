-- =========================================================
-- SPOTUP PHASE 4 SQUADS BACKEND PATCH
-- Safe to run on the current schema snapshot.
-- Includes search/discovery, secure create/join/leave/delete,
-- admin-only match result recording, and leaderboard view.
-- =========================================================

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
as $$
  select p_user_id = 'ab1f49da-0b7a-4ee8-b63e-1a07927e2717'::uuid;
$$;

create or replace function public.has_spotup_pro(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
as $$
  select exists (
    select 1
    from public.user_entitlements ue
    where ue.user_id = p_user_id
      and coalesce(ue.entitlement, 'spotup_pro') = 'spotup_pro'
      and (coalesce(ue.is_active, false) = true or coalesce(ue.is_pro, false) = true)
      and (ue.expires_at is null or ue.expires_at > now())
  );
$$;

create index if not exists idx_squads_name_lower on public.squads (lower(name));
create index if not exists idx_squads_invite_code_lower on public.squads (lower(invite_code));
create index if not exists idx_squads_home_area_lower on public.squads (lower(home_area));
create index if not exists idx_squad_members_user_id on public.squad_members (user_id);
create index if not exists idx_squad_members_squad_id on public.squad_members (squad_id);
create index if not exists idx_squad_match_results_recorded_at on public.squad_match_results (recorded_at desc);
create index if not exists idx_squad_point_events_squad_created on public.squad_point_events (squad_id, created_at desc);

update public.squads
set min_xp_required = greatest(coalesce(min_xp_required, 0), 500)
where min_xp_required is distinct from greatest(coalesce(min_xp_required, 0), 500);

update public.squads
set member_limit = 10
where coalesce(member_limit, 10) <> 10;

alter table public.squads
  alter column member_limit set default 10;

drop function if exists public.search_squads(text);
create or replace function public.search_squads(p_query text default null)
returns table (
  id uuid,
  name text,
  sport text,
  invite_code text,
  owner_id uuid,
  wins integer,
  losses integer,
  points integer,
  rating integer,
  home_area text,
  min_xp_required integer,
  member_limit integer,
  member_count bigint,
  is_nearby boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to public
as $$
  with me as (
    select city
    from public.profiles
    where id = auth.uid()
  ),
  base as (
    select
      s.id,
      s.name,
      s.sport,
      s.invite_code,
      s.owner_id,
      s.wins,
      s.losses,
      s.points,
      s.rating,
      s.home_area,
      s.min_xp_required,
      s.member_limit,
      count(sm.user_id) as member_count,
      case
        when me.city is not null and lower(coalesce(s.home_area, '')) = lower(me.city) then true
        else false
      end as is_nearby,
      s.created_at
    from public.squads s
    left join public.squad_members sm on sm.squad_id = s.id
    left join me on true
    where
      (
        p_query is not null
        and btrim(p_query) <> ''
        and (
          lower(s.name) like '%' || lower(btrim(p_query)) || '%'
          or lower(s.invite_code) like '%' || lower(btrim(p_query)) || '%'
        )
      )
      or
      (
        p_query is null
        or btrim(p_query) = ''
      )
    group by
      s.id, s.name, s.sport, s.invite_code, s.owner_id,
      s.wins, s.losses, s.points, s.rating, s.home_area,
      s.min_xp_required, s.member_limit, s.created_at, me.city
  )
  select *
  from base
  order by
    case when is_nearby then 0 else 1 end,
    rating desc,
    points desc,
    wins desc,
    created_at desc;
$$;

drop function if exists public.create_squad_secure(text, text, text, integer);
create or replace function public.create_squad_secure(
  p_name text,
  p_sport text,
  p_home_area text default null,
  p_min_xp_required integer default 500
)
returns public.squads
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
  v_xp integer := 0;
  v_is_pro boolean := false;
  v_owned_count integer := 0;
  v_area text;
  v_code text;
  v_exists boolean;
  v_squad public.squads;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(xp, 0), city
  into v_xp, v_area
  from public.profiles
  where id = v_uid;

  if v_xp < 500 then
    raise exception 'You need 500 XP to create a squad';
  end if;

  v_is_pro := public.has_spotup_pro(v_uid);

  select count(*) into v_owned_count
  from public.squads
  where owner_id = v_uid;

  if not v_is_pro and v_owned_count >= 1 then
    raise exception 'Free users can only own 1 squad at a time';
  end if;

  if not v_is_pro then
    p_min_xp_required := 500;
  end if;

  v_area := coalesce(nullif(btrim(p_home_area), ''), v_area);

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    select exists(select 1 from public.squads where invite_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  insert into public.squads (
    name,
    sport,
    owner_id,
    invite_code,
    min_xp_required,
    member_limit,
    home_area
  )
  values (
    p_name,
    p_sport,
    v_uid,
    v_code,
    greatest(coalesce(p_min_xp_required, 500), 500),
    10,
    v_area
  )
  returning * into v_squad;

  insert into public.squad_members (squad_id, user_id, role)
  values (v_squad.id, v_uid, 'owner')
  on conflict do nothing;

  return v_squad;
end;
$$;

drop function if exists public.join_squad_secure(uuid);
create or replace function public.join_squad_secure(p_squad_id uuid)
returns boolean
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
  v_xp integer := 0;
  v_is_pro boolean := false;
  v_joined_count integer := 0;
  v_member_count integer := 0;
  v_min_xp_required integer := 500;
  v_member_limit integer := 10;
  v_owner_id uuid;
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

  v_is_pro := public.has_spotup_pro(v_uid);

  select count(*) into v_joined_count
  from public.squad_members
  where user_id = v_uid;

  if not v_is_pro and v_joined_count >= 1 then
    raise exception 'Free users can only join 1 squad';
  end if;

  select s.min_xp_required, s.member_limit, s.owner_id, count(sm.user_id)
  into v_min_xp_required, v_member_limit, v_owner_id, v_member_count
  from public.squads s
  left join public.squad_members sm on sm.squad_id = s.id
  where s.id = p_squad_id
  group by s.id, s.min_xp_required, s.member_limit, s.owner_id;

  if not found then
    raise exception 'Squad not found';
  end if;

  if v_uid = v_owner_id then
    return true;
  end if;

  if exists (
    select 1 from public.squad_members where squad_id = p_squad_id and user_id = v_uid
  ) then
    return true;
  end if;

  if v_xp < greatest(coalesce(v_min_xp_required, 500), 500) then
    raise exception 'You do not meet this squad''s minimum XP requirement';
  end if;

  if v_member_count >= coalesce(v_member_limit, 10) then
    raise exception 'This squad is full';
  end if;

  insert into public.squad_members (squad_id, user_id, role)
  values (p_squad_id, v_uid, 'member')
  on conflict do nothing;

  return true;
end;
$$;

drop function if exists public.leave_squad_secure(uuid);
create or replace function public.leave_squad_secure(p_squad_id uuid)
returns boolean
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner_id uuid;
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
    raise exception 'Owner cannot leave their own squad. Delete it instead.';
  end if;

  delete from public.squad_members
  where squad_id = p_squad_id and user_id = v_uid;

  return true;
end;
$$;

drop function if exists public.delete_squad_secure(uuid);
create or replace function public.delete_squad_secure(p_squad_id uuid)
returns boolean
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.squads where id = p_squad_id and owner_id = v_uid
  ) then
    raise exception 'Only the squad owner can delete this squad';
  end if;

  delete from public.squad_members where squad_id = p_squad_id;
  delete from public.squads where id = p_squad_id and owner_id = v_uid;
  return true;
end;
$$;

drop function if exists public.record_squad_match_result(uuid, uuid, uuid, integer, text);
create or replace function public.record_squad_match_result(
  p_squad_a uuid,
  p_squad_b uuid,
  p_winner uuid,
  p_points integer default 10,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to public
as $$
declare
  v_loser uuid;
  v_match_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admin can record squad match results right now';
  end if;

  if p_squad_a = p_squad_b then
    raise exception 'A squad cannot play itself';
  end if;

  if p_winner = p_squad_a then
    v_loser := p_squad_b;
  elsif p_winner = p_squad_b then
    v_loser := p_squad_a;
  else
    raise exception 'Winner must be one of the two squads';
  end if;

  insert into public.squad_match_results (
    squad_a_id, squad_b_id, winner_squad_id, loser_squad_id, points_awarded, recorded_by, notes
  )
  values (
    p_squad_a, p_squad_b, p_winner, v_loser, greatest(coalesce(p_points, 10), 0), auth.uid(), p_notes
  )
  returning id into v_match_id;

  update public.squads
  set wins = coalesce(wins, 0) + 1,
      points = coalesce(points, 0) + greatest(coalesce(p_points, 10), 0),
      rating = coalesce(rating, 1000) + 20
  where id = p_winner;

  update public.squads
  set losses = coalesce(losses, 0) + 1,
      rating = greatest(coalesce(rating, 1000) - 10, 0)
  where id = v_loser;

  insert into public.squad_point_events (squad_id, event_type, points, related_match_id, metadata)
  values
    (p_winner, 'match_win', greatest(coalesce(p_points, 10), 0), v_match_id, jsonb_build_object('opponent_squad_id', v_loser)),
    (v_loser, 'match_loss', 0, v_match_id, jsonb_build_object('opponent_squad_id', p_winner));

  return v_match_id;
end;
$$;

create or replace view public.squad_competitive_leaderboard as
select
  s.id as squad_id,
  s.name,
  s.sport,
  s.owner_id,
  s.invite_code,
  s.home_area,
  s.wins,
  s.losses,
  s.points,
  s.rating,
  s.min_xp_required,
  s.member_limit,
  count(sm.user_id) as member_count,
  coalesce(sum(p.xp), 0) as total_xp,
  s.created_at
from public.squads s
left join public.squad_members sm on sm.squad_id = s.id
left join public.profiles p on p.id = sm.user_id
group by
  s.id, s.name, s.sport, s.owner_id, s.invite_code, s.home_area,
  s.wins, s.losses, s.points, s.rating, s.min_xp_required, s.member_limit, s.created_at;

grant execute on function public.search_squads(text) to authenticated;
grant execute on function public.create_squad_secure(text, text, text, integer) to authenticated;
grant execute on function public.join_squad_secure(uuid) to authenticated;
grant execute on function public.leave_squad_secure(uuid) to authenticated;
grant execute on function public.delete_squad_secure(uuid) to authenticated;
grant execute on function public.record_squad_match_result(uuid, uuid, uuid, integer, text) to authenticated;
