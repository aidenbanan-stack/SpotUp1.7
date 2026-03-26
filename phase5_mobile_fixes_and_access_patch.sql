-- Phase 5: mobile polish, secure game editing, squad XP threshold, pro entitlement compatibility

alter table if exists public.user_entitlements add column if not exists entitlement text not null default 'pro';
alter table if exists public.user_entitlements add column if not exists is_active boolean not null default true;
alter table if exists public.user_entitlements add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.has_pro_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to public
as $$
  select coalesce(public.is_admin(p_user_id), false)
      or exists (
        select 1
        from public.user_entitlements ue
        where ue.user_id = p_user_id
          and ue.is_pro = true
          and coalesce(ue.is_active, true) = true
          and (ue.expires_at is null or ue.expires_at > now())
      );
$$;

create or replace function public.get_my_access_state()
returns table(is_pro boolean, is_admin boolean)
language sql
stable
security definer
set search_path to public
as $$
  select public.has_pro_access(auth.uid()) as is_pro, public.is_admin(auth.uid()) as is_admin;
$$;

drop function if exists public.admin_grant_pro(uuid);
create or replace function public.admin_grant_pro(p_user_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admin only';
  end if;

  insert into public.user_entitlements (
    user_id,
    entitlement,
    is_pro,
    is_active,
    granted_by,
    granted_at,
    updated_at,
    notes,
    metadata
  )
  values (
    p_user_id,
    'pro',
    true,
    true,
    auth.uid(),
    now(),
    now(),
    p_notes,
    '{}'::jsonb
  )
  on conflict (user_id)
  do update set
    entitlement = 'pro',
    is_pro = true,
    is_active = true,
    granted_by = auth.uid(),
    granted_at = now(),
    updated_at = now(),
    notes = excluded.notes;
end;
$$;

grant execute on function public.admin_grant_pro(uuid, text) to authenticated;

create or replace function public.admin_revoke_pro(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admin only';
  end if;

  insert into public.user_entitlements (
    user_id,
    entitlement,
    is_pro,
    is_active,
    granted_by,
    granted_at,
    updated_at,
    metadata
  )
  values (
    p_user_id,
    'pro',
    false,
    false,
    auth.uid(),
    now(),
    now(),
    '{}'::jsonb
  )
  on conflict (user_id)
  do update set
    entitlement = coalesce(public.user_entitlements.entitlement, 'pro'),
    is_pro = false,
    is_active = false,
    granted_by = auth.uid(),
    granted_at = now(),
    updated_at = now();
end;
$$;

grant execute on function public.admin_revoke_pro(uuid) to authenticated;

create or replace function public.create_squad_secure(
  p_name text,
  p_sport text default null,
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

  v_is_pro := public.has_pro_access(v_uid);

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
    trim(p_name),
    nullif(trim(p_sport), ''),
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

grant execute on function public.create_squad_secure(text, text, text, integer) to authenticated;

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

  v_is_pro := public.has_pro_access(v_uid);

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

grant execute on function public.join_squad_secure(uuid) to authenticated;

create or replace function public.update_game_secure(
  p_game_id uuid,
  p_sport text default null,
  p_title text default null,
  p_description text default null,
  p_date_time timestamptz default null,
  p_duration integer default null,
  p_skill_requirement text default null,
  p_max_players integer default null,
  p_is_private boolean default null,
  p_location_latitude double precision default null,
  p_location_longitude double precision default null,
  p_location_area_name text default null
)
returns public.games
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id;

  if not found then
    raise exception 'Game not found';
  end if;

  if v_game.host_id <> v_uid then
    raise exception 'Only the host can edit this game';
  end if;

  update public.games
  set
    sport = coalesce(p_sport, sport),
    title = coalesce(nullif(trim(p_title), ''), title),
    description = case when p_description is null then description else nullif(trim(p_description), '') end,
    date_time = coalesce(p_date_time, date_time),
    duration = coalesce(p_duration, duration),
    skill_requirement = coalesce(p_skill_requirement, skill_requirement),
    max_players = coalesce(p_max_players, max_players),
    is_private = coalesce(p_is_private, is_private),
    location_latitude = coalesce(p_location_latitude, location_latitude),
    location_longitude = coalesce(p_location_longitude, location_longitude),
    location_area_name = coalesce(nullif(trim(p_location_area_name), ''), location_area_name)
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.update_game_secure(uuid, text, text, text, timestamptz, integer, text, integer, boolean, double precision, double precision, text) to authenticated;
