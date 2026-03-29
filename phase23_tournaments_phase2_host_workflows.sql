-- Phase 23: Tournaments Phase 2 host controls, seeding, bracket generation, and registration locking
-- Run this after phase22_tournaments_phase1_foundation.sql

begin;

create or replace function public.tournament_capacity(p_tournament public.tournaments)
returns integer
language sql
immutable
as $$
  select coalesce(
    nullif((p_tournament.settings ->> 'capacity')::integer, 0),
    public.normalize_tournament_team_count(p_tournament.team_count)
  );
$$;

create or replace function public.next_power_of_two(p_value integer)
returns integer
language plpgsql
immutable
as $$
declare
  v integer := 1;
begin
  if coalesce(p_value, 0) <= 1 then
    return 1;
  end if;

  while v < p_value loop
    v := v * 2;
  end loop;

  return v;
end;
$$;

create or replace function public.tournament_seed_positions(p_bracket_size integer)
returns integer[]
language plpgsql
immutable
as $$
declare
  v_positions integer[] := array[1, 2];
  v_next integer[];
  v_current_size integer := 2;
  v_seed integer;
begin
  if p_bracket_size is null or p_bracket_size < 2 or (p_bracket_size & (p_bracket_size - 1)) <> 0 then
    raise exception 'Bracket size must be a power of two >= 2';
  end if;

  if p_bracket_size = 2 then
    return v_positions;
  end if;

  while v_current_size < p_bracket_size loop
    v_next := '{}'::integer[];
    foreach v_seed in array v_positions loop
      v_next := array_append(v_next, v_seed);
      v_next := array_append(v_next, (v_current_size * 2 + 1) - v_seed);
    end loop;
    v_positions := v_next;
    v_current_size := v_current_size * 2;
  end loop;

  return v_positions;
end;
$$;

create or replace function public.tournament_round_label(p_bracket_size integer, p_round_number integer)
returns text
language plpgsql
immutable
as $$
declare
  v_total_rounds integer;
  v_remaining integer;
begin
  if coalesce(p_bracket_size, 0) < 2 or coalesce(p_round_number, 0) < 1 then
    return null;
  end if;

  v_total_rounds := round(log(2, p_bracket_size::numeric));
  v_remaining := p_bracket_size / (2 ^ (p_round_number - 1));

  if v_remaining = 2 then
    return 'Final';
  elsif v_remaining = 4 then
    return 'Semifinal';
  elsif v_remaining = 8 then
    return 'Quarterfinal';
  else
    return 'Round ' || p_round_number;
  end if;
end;
$$;

create or replace function public.refresh_tournament_match_readiness(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.tournament_matches tm
  set status = case
    when tm.winner_registration_id is not null then 'completed'
    when tm.participant_1_registration_id is not null and tm.participant_2_registration_id is not null then 'ready'
    else 'pending'
  end,
  started_at = case
    when tm.status = 'in_progress' then tm.started_at
    else tm.started_at
  end
  where tm.tournament_id = p_tournament_id
    and tm.status <> 'cancelled'
    and tm.winner_registration_id is null;
end;
$$;

create or replace function public.advance_tournament_byes(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_match record;
  v_winner_id uuid;
begin
  loop
    perform public.refresh_tournament_match_readiness(p_tournament_id);

    select tm.*
    into v_match
    from public.tournament_matches tm
    where tm.tournament_id = p_tournament_id
      and tm.status in ('pending', 'ready')
      and tm.winner_registration_id is null
      and (
        (tm.participant_1_registration_id is not null and tm.participant_2_registration_id is null)
        or (tm.participant_1_registration_id is null and tm.participant_2_registration_id is not null)
      )
    order by tm.round_number, tm.match_number
    limit 1;

    exit when not found;

    v_winner_id := coalesce(v_match.participant_1_registration_id, v_match.participant_2_registration_id);

    update public.tournament_matches
    set winner_registration_id = v_winner_id,
        loser_registration_id = null,
        status = 'completed',
        completed_at = now(),
        notes = coalesce(nullif(notes, ''), 'Auto-advanced by bye')
    where id = v_match.id;

    if v_match.next_match_id is not null and v_match.next_match_slot is not null then
      if v_match.next_match_slot = 1 then
        update public.tournament_matches
        set participant_1_registration_id = coalesce(participant_1_registration_id, v_winner_id)
        where id = v_match.next_match_id;
      else
        update public.tournament_matches
        set participant_2_registration_id = coalesce(participant_2_registration_id, v_winner_id)
        where id = v_match.next_match_id;
      end if;
    end if;
  end loop;

  perform public.refresh_tournament_match_readiness(p_tournament_id);
end;
$$;

drop function if exists public.reseed_tournament_secure(uuid, text);
create or replace function public.reseed_tournament_secure(
  p_tournament_id uuid,
  p_method text default 'ranking'
)
returns setof public.tournament_registration_details
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_allowed_methods text[] := array['ranking', 'created_at', 'random'];
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

  if v_tournament.host_id <> v_uid then
    raise exception 'Only the host can seed this tournament';
  end if;

  if v_tournament.status <> 'scheduled' then
    raise exception 'Only scheduled tournaments can be reseeded';
  end if;

  if array_position(v_allowed_methods, p_method) is null then
    raise exception 'Unsupported seed method';
  end if;

  if exists (
    select 1
    from public.tournament_matches tm
    where tm.tournament_id = p_tournament_id
      and tm.status in ('ready', 'in_progress', 'completed')
  ) then
    raise exception 'Cannot reseed after the bracket has been prepared';
  end if;

  if p_method = 'random' then
    update public.tournament_registrations tr
    set seed = src.seed_num,
        metadata = coalesce(tr.metadata, '{}'::jsonb) || jsonb_build_object('seed_method', p_method, 'seeded_at', now())
    from (
      select id, row_number() over (order by random(), created_at, id) as seed_num
      from public.tournament_registrations
      where tournament_id = p_tournament_id
        and status in ('pending','registered','checked_in','champion')
    ) src
    where tr.id = src.id;
  elsif p_method = 'created_at' then
    update public.tournament_registrations tr
    set seed = src.seed_num,
        metadata = coalesce(tr.metadata, '{}'::jsonb) || jsonb_build_object('seed_method', p_method, 'seeded_at', now())
    from (
      select id, row_number() over (order by created_at, id) as seed_num
      from public.tournament_registrations
      where tournament_id = p_tournament_id
        and status in ('pending','registered','checked_in','champion')
    ) src
    where tr.id = src.id;
  else
    update public.tournament_registrations tr
    set seed = src.seed_num,
        metadata = coalesce(tr.metadata, '{}'::jsonb) || jsonb_build_object('seed_method', p_method, 'seeded_at', now())
    from (
      select
        tr_inner.id,
        row_number() over (
          order by
            case when tr_inner.user_id is not null then coalesce(p.xp, 0) else coalesce(s.rating, 0) end desc,
            case when tr_inner.user_id is not null then coalesce(p.reliability_score, 0) else coalesce(s.points, 0) end desc,
            tr_inner.created_at,
            tr_inner.id
        ) as seed_num
      from public.tournament_registrations tr_inner
      left join public.profiles p on p.id = tr_inner.user_id
      left join public.squads s on s.id = tr_inner.squad_id
      where tr_inner.tournament_id = p_tournament_id
        and tr_inner.status in ('pending','registered','checked_in','champion')
    ) src
    where tr.id = src.id;
  end if;

  update public.tournaments t
  set settings = coalesce(t.settings, '{}'::jsonb) || jsonb_build_object('seed_method', p_method, 'last_seeded_at', now())
  where t.id = p_tournament_id;

  return query
  select *
  from public.tournament_registration_details
  where tournament_id = p_tournament_id
  order by coalesce(seed, 999999), created_at, id;
end;
$$;

grant execute on function public.reseed_tournament_secure(uuid, text) to authenticated;

drop function if exists public.generate_tournament_bracket_secure(uuid);
create or replace function public.generate_tournament_bracket_secure(
  p_tournament_id uuid
)
returns setof public.tournament_match_details
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_capacity integer;
  v_registration_count integer;
  v_bracket_size integer;
  v_rounds integer;
  v_round integer;
  v_match_count integer;
  v_match_number integer;
  v_best_of integer;
  v_positions integer[];
  v_position_index integer;
  v_slot_seed integer;
  v_p1 uuid;
  v_p2 uuid;
  v_current_match_id uuid;
  v_next_match_id uuid;
  v_stage_label text;
  v_seeded_registration_ids uuid[];
  v_round_match_ids uuid[];
  v_previous_round_match_ids uuid[];
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

  if v_tournament.host_id <> v_uid then
    raise exception 'Only the host can generate the bracket';
  end if;

  if v_tournament.status <> 'scheduled' then
    raise exception 'Only scheduled tournaments can have a bracket generated';
  end if;

  select count(*)
  into v_registration_count
  from public.tournament_registrations tr
  where tr.tournament_id = p_tournament_id
    and tr.status in ('pending','registered','checked_in','champion');

  if v_registration_count < 2 then
    raise exception 'At least 2 entries are required to generate a bracket';
  end if;

  if exists (
    select 1
    from public.tournament_registrations tr
    where tr.tournament_id = p_tournament_id
      and tr.status in ('pending','registered','checked_in','champion')
      and tr.seed is null
  ) then
    perform public.reseed_tournament_secure(p_tournament_id, coalesce(v_tournament.settings ->> 'seed_method', 'ranking'));
  end if;

  v_capacity := greatest(public.tournament_capacity(v_tournament), 2);
  v_bracket_size := least(v_capacity, public.next_power_of_two(v_registration_count));
  v_rounds := round(log(2, v_bracket_size::numeric));
  v_best_of := case when v_tournament.series_type = 'best_of_3' then 3 else 1 end;
  v_positions := public.tournament_seed_positions(v_bracket_size);

  select array_agg(id order by seed, created_at, id)
  into v_seeded_registration_ids
  from public.tournament_registrations tr
  where tr.tournament_id = p_tournament_id
    and tr.status in ('pending','registered','checked_in','champion');

  delete from public.tournament_matches where tournament_id = p_tournament_id;

  v_previous_round_match_ids := null;

  for v_round in 1..v_rounds loop
    v_match_count := v_bracket_size / (2 ^ v_round);
    v_stage_label := public.tournament_round_label(v_bracket_size, v_round);
    v_round_match_ids := '{}'::uuid[];

    for v_match_number in 1..v_match_count loop
      v_p1 := null;
      v_p2 := null;

      if v_round = 1 then
        v_position_index := ((v_match_number - 1) * 2) + 1;
        v_slot_seed := v_positions[v_position_index];
        if v_slot_seed is not null and v_slot_seed <= coalesce(array_length(v_seeded_registration_ids, 1), 0) then
          v_p1 := v_seeded_registration_ids[v_slot_seed];
        end if;

        v_slot_seed := v_positions[v_position_index + 1];
        if v_slot_seed is not null and v_slot_seed <= coalesce(array_length(v_seeded_registration_ids, 1), 0) then
          v_p2 := v_seeded_registration_ids[v_slot_seed];
        end if;
      end if;

      insert into public.tournament_matches (
        tournament_id,
        round_number,
        match_number,
        bracket_side,
        stage_label,
        status,
        best_of,
        participant_1_registration_id,
        participant_2_registration_id,
        source,
        metadata
      )
      values (
        p_tournament_id,
        v_round,
        v_match_number,
        'main',
        v_stage_label,
        case when v_p1 is not null and v_p2 is not null then 'ready' else 'pending' end,
        v_best_of,
        v_p1,
        v_p2,
        'system',
        jsonb_build_object('bracket_size', v_bracket_size)
      )
      returning id into v_current_match_id;

      v_round_match_ids := array_append(v_round_match_ids, v_current_match_id);

      if v_round > 1 and v_previous_round_match_ids is not null then
        update public.tournament_matches
        set next_match_id = v_current_match_id,
            next_match_slot = case when ((idx - 1) % 2) = 0 then 1 else 2 end
        from unnest(v_previous_round_match_ids) with ordinality prev_match(prev_id, idx)
        where public.tournament_matches.id = prev_match.prev_id
          and ceil(prev_match.idx / 2.0) = v_match_number;
      end if;
    end loop;

    v_previous_round_match_ids := v_round_match_ids;
  end loop;

  update public.tournaments t
  set bracket_generated_at = now(),
      settings = coalesce(t.settings, '{}'::jsonb) || jsonb_build_object('bracket_size', v_bracket_size, 'bracket_generated', true)
  where t.id = p_tournament_id;

  perform public.advance_tournament_byes(p_tournament_id);

  return query
  select *
  from public.tournament_match_details
  where tournament_id = p_tournament_id
  order by bracket_side, round_number, match_number, created_at;
end;
$$;

grant execute on function public.generate_tournament_bracket_secure(uuid) to authenticated;

drop function if exists public.lock_tournament_registration_secure(uuid);
create or replace function public.lock_tournament_registration_secure(
  p_tournament_id uuid
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
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.host_id <> v_uid then
    raise exception 'Only the host can lock registrations';
  end if;

  if v_tournament.status <> 'scheduled' then
    raise exception 'Only scheduled tournaments can lock registrations';
  end if;

  update public.tournaments t
  set registration_closes_at = least(coalesce(t.starts_at, now()), now()),
      settings = coalesce(t.settings, '{}'::jsonb) || jsonb_build_object('registration_locked_at', now())
  where t.id = p_tournament_id
  returning * into v_tournament;

  return v_tournament;
end;
$$;

grant execute on function public.lock_tournament_registration_secure(uuid) to authenticated;

drop function if exists public.start_tournament_secure(uuid);
create or replace function public.start_tournament_secure(
  p_tournament_id uuid
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
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.host_id <> v_uid then
    raise exception 'Only the host can start this tournament';
  end if;

  if v_tournament.status <> 'scheduled' then
    raise exception 'Tournament has already started or ended';
  end if;

  perform public.lock_tournament_registration_secure(p_tournament_id);
  perform public.reseed_tournament_secure(p_tournament_id, coalesce(v_tournament.settings ->> 'seed_method', 'ranking'));
  perform public.generate_tournament_bracket_secure(p_tournament_id);

  update public.tournaments t
  set status = 'active',
      settings = coalesce(t.settings, '{}'::jsonb) || jsonb_build_object('started_at', now())
  where t.id = p_tournament_id
  returning * into v_tournament;

  return v_tournament;
end;
$$;

grant execute on function public.start_tournament_secure(uuid) to authenticated;

drop function if exists public.cancel_tournament_secure(uuid, text);
create or replace function public.cancel_tournament_secure(
  p_tournament_id uuid,
  p_reason text default null
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
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.host_id <> v_uid then
    raise exception 'Only the host can cancel this tournament';
  end if;

  if v_tournament.status = 'completed' then
    raise exception 'Completed tournaments cannot be cancelled';
  end if;

  update public.tournament_matches
  set status = 'cancelled',
      notes = coalesce(nullif(trim(coalesce(notes, '')), ''), nullif(trim(coalesce(p_reason, '')), '')),
      completed_at = coalesce(completed_at, now())
  where tournament_id = p_tournament_id
    and status <> 'completed';

  update public.tournament_registrations
  set status = case when status = 'champion' then status else 'withdrawn' end,
      metadata = coalesce(metadata, '{}'::jsonb) || case when nullif(trim(coalesce(p_reason, '')), '') is null then '{}'::jsonb else jsonb_build_object('cancel_reason', trim(p_reason)) end
  where tournament_id = p_tournament_id
    and status in ('pending','registered','checked_in','eliminated','withdrawn','disqualified');

  update public.tournaments t
  set status = 'cancelled',
      ends_at = coalesce(t.ends_at, now()),
      completed_at = now(),
      settings = coalesce(t.settings, '{}'::jsonb) || case when nullif(trim(coalesce(p_reason, '')), '') is null then jsonb_build_object('cancelled_at', now()) else jsonb_build_object('cancelled_at', now(), 'cancel_reason', trim(p_reason)) end
  where t.id = p_tournament_id
  returning * into v_tournament;

  return v_tournament;
end;
$$;

grant execute on function public.cancel_tournament_secure(uuid, text) to authenticated;

commit;
