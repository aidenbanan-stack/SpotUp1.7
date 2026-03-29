-- Phase 24: Tournaments Phase 3 player flows, private access codes, and unregister support
-- Run this after phase22_tournaments_phase1_foundation.sql and phase23_tournaments_phase2_host_workflows.sql

begin;

create or replace function public.generate_tournament_access_code()
returns text
language plpgsql
volatile
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (
      select 1
      from public.tournaments t
      where upper(coalesce(t.settings ->> 'access_code', '')) = v_code
    );
  end loop;

  return v_code;
end;
$$;

update public.tournaments t
set settings = coalesce(t.settings, '{}'::jsonb) || jsonb_build_object('access_code', public.generate_tournament_access_code())
where t.is_private = true
  and coalesce(nullif(trim(t.settings ->> 'access_code'), ''), '') = '';

create or replace function public.create_tournament_secure(
  p_name text,
  p_sport text,
  p_format text,
  p_series_type text,
  p_team_count text,
  p_points_style text,
  p_join_mode text,
  p_is_private boolean,
  p_location jsonb,
  p_starts_at timestamptz,
  p_notes text default null,
  p_registration_closes_at timestamptz default null
)
returns public.tournaments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_capacity integer := public.normalize_tournament_team_count(p_team_count);
  v_settings jsonb := jsonb_build_object('capacity', v_capacity);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_pro_access(v_uid) then
    raise exception 'SpotUp Pro is required to create tournaments';
  end if;

  if coalesce(length(trim(p_name)), 0) < 3 then
    raise exception 'Tournament name must be at least 3 characters';
  end if;

  if p_join_mode not in ('solo', 'squad', 'either') then
    raise exception 'Invalid join mode';
  end if;

  if p_series_type not in ('single_elimination', 'best_of_3') then
    raise exception 'Invalid series type';
  end if;

  if v_capacity not in (4, 8, 16, 32) then
    raise exception 'Tournament team count must be 4, 8, 16, or 32';
  end if;

  if p_starts_at <= now() then
    raise exception 'Tournament start time must be in the future';
  end if;

  if p_registration_closes_at is not null and p_registration_closes_at > p_starts_at then
    raise exception 'Registration close time must be before the tournament start time';
  end if;

  if coalesce(p_is_private, false) then
    v_settings := v_settings || jsonb_build_object('access_code', public.generate_tournament_access_code());
  end if;

  insert into public.tournaments(
    host_id,
    name,
    sport,
    format,
    series_type,
    team_count,
    points_style,
    is_private,
    location,
    starts_at,
    notes,
    join_mode,
    status,
    registration_closes_at,
    settings
  )
  values (
    v_uid,
    trim(p_name),
    trim(p_sport),
    trim(p_format),
    trim(p_series_type),
    trim(p_team_count),
    trim(p_points_style),
    coalesce(p_is_private, false),
    coalesce(p_location, '{}'::jsonb),
    p_starts_at,
    nullif(trim(coalesce(p_notes, '')), ''),
    trim(p_join_mode),
    'scheduled',
    p_registration_closes_at,
    v_settings
  )
  returning * into v_tournament;

  return v_tournament;
end;
$$;

drop function if exists public.join_private_tournament_with_code_secure(text, uuid);
create or replace function public.join_private_tournament_with_code_secure(
  p_access_code text,
  p_squad_id uuid default null
)
returns table (
  tournament_id uuid,
  registration_id uuid,
  join_mode text,
  registration_status text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_registration public.tournament_registrations;
  v_registered_count integer;
  v_capacity integer;
  v_is_member boolean;
  v_code text := upper(trim(coalesce(p_access_code, '')));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_code = '' then
    raise exception 'Enter a private tournament code';
  end if;

  select * into v_tournament
  from public.tournaments t
  where t.is_private = true
    and upper(coalesce(t.settings ->> 'access_code', '')) = v_code
  order by t.created_at desc
  limit 1;

  if not found then
    raise exception 'Private tournament code not found';
  end if;

  if v_tournament.status <> 'scheduled' then
    raise exception 'This tournament is no longer accepting registrations';
  end if;

  if v_tournament.registration_closes_at is not null and now() > v_tournament.registration_closes_at then
    raise exception 'Registration for this tournament has closed';
  end if;

  select count(*) into v_registered_count
  from public.tournament_registrations
  where tournament_id = v_tournament.id
    and status in ('pending','registered','checked_in','champion');

  v_capacity := public.tournament_capacity(v_tournament);
  if v_capacity > 0 and v_registered_count >= v_capacity then
    raise exception 'This tournament is full';
  end if;

  if p_squad_id is null then
    if v_tournament.join_mode = 'squad' then
      raise exception 'This tournament requires a squad entry';
    end if;

    insert into public.tournament_registrations (tournament_id, user_id, squad_id, status)
    values (v_tournament.id, v_uid, null, 'registered')
    on conflict (tournament_id, user_id) where user_id is not null
    do update set status = 'registered'
    returning * into v_registration;
  else
    if v_tournament.join_mode = 'solo' then
      raise exception 'This tournament only allows solo registration';
    end if;

    select exists(
      select 1
      from public.squad_members sm
      where sm.squad_id = p_squad_id
        and sm.user_id = v_uid
    ) into v_is_member;

    if not coalesce(v_is_member, false) then
      raise exception 'You must be a member of this squad to register it';
    end if;

    insert into public.tournament_registrations (tournament_id, user_id, squad_id, status)
    values (v_tournament.id, null, p_squad_id, 'registered')
    on conflict (tournament_id, squad_id) where squad_id is not null
    do update set status = 'registered'
    returning * into v_registration;
  end if;

  return query
  select v_tournament.id, v_registration.id, v_tournament.join_mode, v_registration.status;
end;
$$;

grant execute on function public.join_private_tournament_with_code_secure(text, uuid) to authenticated;

create or replace function public.unregister_from_tournament_secure(
  p_tournament_id uuid,
  p_squad_id uuid default null
)
returns public.tournament_registrations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_registration public.tournament_registrations;
  v_is_member boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.host_id = v_uid then
    raise exception 'Hosts cannot unregister. Cancel the tournament instead.';
  end if;

  if v_tournament.status <> 'scheduled' then
    raise exception 'You can only leave before the tournament starts';
  end if;

  if v_tournament.bracket_generated_at is not null then
    raise exception 'You can no longer leave after the bracket has been generated';
  end if;

  if p_squad_id is null then
    select * into v_registration
    from public.tournament_registrations tr
    where tr.tournament_id = p_tournament_id
      and tr.user_id = v_uid
      and tr.status in ('pending', 'registered', 'checked_in', 'champion')
    order by tr.created_at desc
    limit 1;
  else
    select exists(
      select 1
      from public.squad_members sm
      where sm.squad_id = p_squad_id
        and sm.user_id = v_uid
    ) into v_is_member;

    if not coalesce(v_is_member, false) then
      raise exception 'You must be a member of this squad to remove it';
    end if;

    select * into v_registration
    from public.tournament_registrations tr
    where tr.tournament_id = p_tournament_id
      and tr.squad_id = p_squad_id
      and tr.status in ('pending', 'registered', 'checked_in', 'champion')
    order by tr.created_at desc
    limit 1;
  end if;

  if not found then
    raise exception 'No active registration found';
  end if;

  update public.tournament_registrations tr
  set status = 'withdrawn',
      eliminated_at = now(),
      metadata = coalesce(tr.metadata, '{}'::jsonb) || jsonb_build_object('withdrawn_at', now(), 'withdrawn_by', v_uid)
  where tr.id = v_registration.id
  returning * into v_registration;

  return v_registration;
end;
$$;

grant execute on function public.unregister_from_tournament_secure(uuid, uuid) to authenticated;

create or replace function public.get_private_tournament_access_code_secure(
  p_tournament_id uuid
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_can_view boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if not v_tournament.is_private then
    return null;
  end if;

  if v_tournament.host_id = v_uid then
    v_can_view := true;
  else
    select exists (
      select 1
      from public.tournament_registrations tr
      where tr.tournament_id = p_tournament_id
        and tr.status in ('pending', 'registered', 'checked_in', 'champion')
        and (
          tr.user_id = v_uid
          or exists (
            select 1
            from public.squad_members sm
            where sm.squad_id = tr.squad_id
              and sm.user_id = v_uid
          )
        )
    ) into v_can_view;
  end if;

  if not v_can_view then
    raise exception 'You do not have access to this private tournament code';
  end if;

  return nullif(trim(v_tournament.settings ->> 'access_code'), '');
end;
$$;

grant execute on function public.get_private_tournament_access_code_secure(uuid) to authenticated;

commit;
