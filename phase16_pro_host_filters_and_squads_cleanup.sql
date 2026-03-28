-- SpotUp Phase 16: Pro host filters + squads access cleanup

alter table public.games add column if not exists host_min_xp_required integer not null default 0;
alter table public.games add column if not exists host_pro_only boolean not null default false;
alter table public.games add column if not exists host_age_min integer;
alter table public.games add column if not exists host_age_max integer;

update public.games
set host_min_xp_required = greatest(coalesce(host_min_xp_required, 0), 0),
    host_pro_only = coalesce(host_pro_only, false)
where true;

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
  p_host_min_xp_required integer default 0,
  p_host_pro_only boolean default false,
  p_host_age_min integer default null,
  p_host_age_max integer default null,
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
  v_host_min_xp integer := greatest(coalesce(p_host_min_xp_required, 0), 0);
  v_host_age_min integer := case when p_host_age_min is null then null else greatest(p_host_age_min, 0) end;
  v_host_age_max integer := case when p_host_age_max is null then null else greatest(p_host_age_max, 0) end;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Title is required'; end if;
  if v_host_age_min is not null and v_host_age_max is not null and v_host_age_min > v_host_age_max then
    raise exception 'Minimum age cannot be greater than maximum age';
  end if;

  v_is_pro := public.has_pro_access(v_uid);
  if coalesce(p_is_private, false) and not v_is_pro then raise exception 'SpotUp Pro is required to create private games'; end if;
  if v_total > 1 and not v_is_pro then raise exception 'SpotUp Pro is required to create recurring games'; end if;
  if (v_host_min_xp > 0 or coalesce(p_host_pro_only, false) or v_host_age_min is not null or v_host_age_max is not null) and not v_is_pro then
    raise exception 'SpotUp Pro is required to use host join filters';
  end if;

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
      description, player_ids, recurrence_rule, recurrence_group_id,
      host_min_xp_required, host_pro_only, host_age_min, host_age_max
    ) values (
      v_uid, trim(p_title), p_sport, v_when, v_when, greatest(coalesce(p_duration,90),1),
      p_skill_requirement, greatest(coalesce(p_max_players,10),2), coalesce(p_is_private,false), 'scheduled',
      p_location_latitude, p_location_longitude, p_location_area_name, nullif(p_description,''),
      array[v_uid]::uuid[], case when v_total > 1 then 'weekly' else null end, case when v_total > 1 then v_group else null end,
      v_host_min_xp, coalesce(p_host_pro_only, false), v_host_age_min, v_host_age_max
    ) returning * into v_inserted;

    if v_loop = 0 then
      v_first_game := v_inserted;
    end if;
  end loop;

  return v_first_game;
end;
$$;

grant execute on function public.create_game_secure(text, text, text, timestamptz, integer, text, integer, boolean, double precision, double precision, text, integer, boolean, integer, integer, integer, integer) to authenticated;

create or replace function public.join_or_request_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_profile public.profiles;
  v_players uuid[];
  v_pending uuid[];
  v_is_pro boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then
    raise exception 'Game not found';
  end if;

  if coalesce(v_game.status, 'scheduled') = 'finished' then
    raise exception 'This game has already ended';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  v_players := coalesce(v_game.player_ids, '{}'::uuid[]);
  v_pending := coalesce(v_game.pending_request_ids, '{}'::uuid[]);
  v_is_pro := public.has_pro_access(v_uid);

  if v_uid = any(v_players) then
    return v_game;
  end if;

  if v_uid = any(v_pending) then
    return v_game;
  end if;

  if coalesce(array_length(v_players, 1), 0) >= coalesce(v_game.max_players, 10) then
    raise exception 'This game is full';
  end if;

  if coalesce(v_game.host_min_xp_required, 0) > coalesce(v_profile.xp, 0) then
    raise exception 'You do not meet the minimum XP required for this game';
  end if;

  if coalesce(v_game.host_pro_only, false) and not v_is_pro then
    raise exception 'This game is limited to SpotUp Pro players';
  end if;

  if (v_game.host_age_min is not null or v_game.host_age_max is not null) and v_profile.age is null then
    raise exception 'Add your age to your profile before joining this game';
  end if;

  if v_game.host_age_min is not null and coalesce(v_profile.age, -1) < v_game.host_age_min then
    raise exception 'You are below this game''s minimum age';
  end if;

  if v_game.host_age_max is not null and coalesce(v_profile.age, 999) > v_game.host_age_max then
    raise exception 'You are above this game''s maximum age';
  end if;

  if coalesce(v_game.is_private, false) then
    v_pending := array_append(v_pending, v_uid);
    update public.games
      set pending_request_ids = (select array(select distinct unnest(v_pending)))
    where id = p_game_id
    returning * into v_game;
  else
    v_players := array_append(v_players, v_uid);
    update public.games
      set player_ids = (select array(select distinct unnest(v_players)))
    where id = p_game_id
    returning * into v_game;
  end if;

  return v_game;
end;
$$;

grant execute on function public.join_or_request_game(uuid) to authenticated;
