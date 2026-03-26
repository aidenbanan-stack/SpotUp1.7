-- Phase 2: Pro entitlements, admin tools, secure creation gating
-- Admin UUID: ab1f49da-0b7a-4ee8-b63e-1a07927e2717

create table if not exists public.user_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_pro boolean not null default false,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  entitlement text not null default 'pro',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.user_entitlements add column if not exists entitlement text not null default 'pro';
alter table public.user_entitlements add column if not exists is_active boolean not null default true;
alter table public.user_entitlements add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.squads add column if not exists min_xp_required integer not null default 0;
alter table public.squads add column if not exists member_limit integer not null default 10;
alter table public.games add column if not exists recurrence_rule text;
alter table public.games add column if not exists recurrence_group_id uuid;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(p_user_id = 'ab1f49da-0b7a-4ee8-b63e-1a07927e2717'::uuid, false);
$$;

create or replace function public.has_pro_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
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
set search_path to 'public'
as $$
  select public.has_pro_access(auth.uid()) as is_pro, public.is_admin(auth.uid()) as is_admin;
$$;

grant execute on function public.get_my_access_state() to authenticated;

create or replace function public.admin_grant_pro(p_user_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admin only';
  end if;

  insert into public.user_entitlements (
    user_id, is_pro, granted_by, granted_at, notes, updated_at, entitlement, is_active, metadata
  )
  values (p_user_id, true, auth.uid(), now(), p_notes, now(), 'pro', true, '{}'::jsonb)
  on conflict (user_id) do update
    set is_pro = true,
        granted_by = auth.uid(),
        granted_at = now(),
        notes = excluded.notes,
        updated_at = now(),
        entitlement = 'pro',
        is_active = true;
end;
$$;

grant execute on function public.admin_grant_pro(uuid, text) to authenticated;

create or replace function public.admin_revoke_pro(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admin only';
  end if;

  insert into public.user_entitlements (user_id, is_pro, granted_by, granted_at, updated_at, entitlement, is_active, metadata)
  values (p_user_id, false, auth.uid(), now(), now(), 'pro', false, '{}'::jsonb)
  on conflict (user_id) do update
    set is_pro = false,
        granted_by = auth.uid(),
        granted_at = now(),
        updated_at = now(),
        entitlement = coalesce(public.user_entitlements.entitlement, 'pro'),
        is_active = false;
end;
$$;

grant execute on function public.admin_revoke_pro(uuid) to authenticated;

create or replace function public.create_squad_secure(
  p_name text,
  p_sport text default null,
  p_min_xp_required integer default 0
)
returns public.squads
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_pro boolean;
  v_xp integer;
  v_owned_count integer;
  v_invite_code text;
  v_squad public.squads;
  v_try integer := 0;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select coalesce(xp,0) into v_xp from public.profiles where id = v_uid;
  if v_xp < 500 then raise exception 'You need 500 XP to create a squad'; end if;
  v_is_pro := public.has_pro_access(v_uid);
  if p_min_xp_required > 0 and not v_is_pro then
    raise exception 'Only SpotUp Pro can set a minimum XP requirement';
  end if;
  if not v_is_pro then
    select count(*) into v_owned_count from public.squads where owner_id = v_uid;
    if v_owned_count >= 1 then raise exception 'Free plan can only own 1 squad at a time'; end if;
  end if;

  loop
    v_try := v_try + 1;
    v_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text),1,6));
    begin
      insert into public.squads(name, sport, owner_id, invite_code, min_xp_required, member_limit)
      values (trim(p_name), nullif(trim(p_sport), ''), v_uid, v_invite_code, greatest(0, coalesce(p_min_xp_required,0)), 10)
      returning * into v_squad;
      exit;
    exception when unique_violation then
      if v_try >= 8 then raise; end if;
    end;
  end loop;

  insert into public.squad_members(squad_id, user_id, role)
  values (v_squad.id, v_uid, 'owner')
  on conflict do nothing;

  return v_squad;
end;
$$;

grant execute on function public.create_squad_secure(text, text, integer) to authenticated;

create or replace function public.join_squad_by_code_secure(p_code text)
returns public.squads
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_xp integer;
  v_is_pro boolean;
  v_membership_count integer;
  v_member_count integer;
  v_squad public.squads;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select coalesce(xp,0) into v_xp from public.profiles where id = v_uid;
  if v_xp < 500 then raise exception 'You need 500 XP to join a squad'; end if;
  v_is_pro := public.has_pro_access(v_uid);
  if not v_is_pro then
    select count(*) into v_membership_count from public.squad_members where user_id = v_uid;
    if v_membership_count >= 1 then raise exception 'Free plan can only join 1 squad'; end if;
  end if;

  select * into v_squad from public.squads where invite_code = upper(trim(p_code));
  if not found then raise exception 'Invalid squad invite code'; end if;
  if v_xp < coalesce(v_squad.min_xp_required, 0) then raise exception 'You do not meet this squad''s minimum XP'; end if;
  select count(*) into v_member_count from public.squad_members where squad_id = v_squad.id;
  if v_member_count >= coalesce(v_squad.member_limit, 10) then raise exception 'This squad is full'; end if;

  insert into public.squad_members(squad_id, user_id, role)
  values (v_squad.id, v_uid, 'member')
  on conflict do nothing;

  return v_squad;
end;
$$;

grant execute on function public.join_squad_by_code_secure(text) to authenticated;

create or replace function public.create_tournament_secure(
  p_name text,
  p_sport text,
  p_format text,
  p_series_type text,
  p_team_count text,
  p_points_style text,
  p_join_mode text,
  p_location jsonb,
  p_starts_at timestamptz,
  p_notes text default null
)
returns public.tournaments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.has_pro_access(v_uid) then raise exception 'SpotUp Pro is required to create tournaments'; end if;

  insert into public.tournaments(host_id, name, sport, format, series_type, team_count, points_style, is_private, location, starts_at, notes, join_mode, status)
  values (v_uid, trim(p_name), p_sport, p_format, p_series_type, p_team_count, p_points_style, false, p_location, p_starts_at, p_notes, p_join_mode, 'scheduled')
  returning * into v_tournament;

  return v_tournament;
end;
$$;

grant execute on function public.create_tournament_secure(text, text, text, text, text, text, text, jsonb, timestamptz, text) to authenticated;

create or replace function public.create_game_secure(
  p_sport text,
  p_title text,
  p_description text,
  p_date_time timestamptz,
  p_duration integer,
  p_skill_requirement text,
  p_max_players integer,
  p_is_private boolean,
  p_location_latitude double precision,
  p_location_longitude double precision,
  p_location_area_name text,
  p_recurrence_count integer default 1,
  p_recurrence_interval_days integer default 7
)
returns public.games
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_pro boolean;
  v_created_recently integer;
  v_loop integer;
  v_when timestamptz;
  v_group uuid := gen_random_uuid();
  v_first_game public.games;
  v_inserted public.games;
  v_same_day_count integer;
  v_overlap boolean;
  v_total integer := greatest(coalesce(p_recurrence_count,1),1);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_is_pro := public.has_pro_access(v_uid);
  if coalesce(p_is_private, false) and not v_is_pro then raise exception 'SpotUp Pro is required to create private games'; end if;
  if v_total > 1 and not v_is_pro then raise exception 'SpotUp Pro is required to create recurring games'; end if;
  if not v_is_pro then
    select count(*) into v_created_recently
    from public.games
    where host_id = v_uid and created_at > now() - interval '24 hours';
    if v_created_recently >= 1 then raise exception 'Free plan can only schedule 1 new game every 24 hours'; end if;
  end if;

  for v_loop in 0..v_total-1 loop
    v_when := p_date_time + make_interval(days => v_loop * greatest(coalesce(p_recurrence_interval_days,7),1));

    select count(*) into v_same_day_count
    from public.games g
    where g.host_id = v_uid
      and date(timezone('America/Los_Angeles', coalesce(g.starts_at, g.date_time))) = date(timezone('America/Los_Angeles', v_when));
    if v_same_day_count >= 2 then
      raise exception 'You can only have 2 hosted games taking place on the same day';
    end if;

    select exists (
      select 1 from public.games g
      where g.host_id = v_uid
        and coalesce(g.status, 'scheduled') in ('scheduled','live')
        and tstzrange(coalesce(g.starts_at, g.date_time), coalesce(g.starts_at, g.date_time) + make_interval(mins => coalesce(g.duration,90)), '[)')
            && tstzrange(v_when, v_when + make_interval(mins => greatest(coalesce(p_duration,90),1)), '[)')
    ) into v_overlap;
    if v_overlap then raise exception 'You cannot host overlapping games'; end if;

    insert into public.games(
      host_id, title, sport, starts_at, date_time, duration, skill_requirement, max_players,
      is_private, status, location_latitude, location_longitude, location_area_name,
      description, player_ids, recurrence_rule, recurrence_group_id
    ) values (
      v_uid, trim(p_title), p_sport, v_when, v_when, greatest(coalesce(p_duration,90),1),
      p_skill_requirement, greatest(coalesce(p_max_players,10),2), coalesce(p_is_private,false), 'scheduled',
      p_location_latitude, p_location_longitude, p_location_area_name, nullif(p_description,''),
      array[v_uid]::uuid[], case when v_total > 1 then 'weekly' else null end, case when v_total > 1 then v_group else null end
    ) returning * into v_inserted;

    if v_loop = 0 then
      v_first_game := v_inserted;
    end if;
  end loop;

  return v_first_game;
end;
$$;

grant execute on function public.create_game_secure(text, text, text, timestamptz, integer, text, integer, boolean, double precision, double precision, text, integer, integer) to authenticated;
