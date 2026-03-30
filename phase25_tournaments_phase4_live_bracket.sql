-- Phase 25: Tournaments Phase 4 live match execution, auto advancement, and completion
-- Run this after phase22_tournaments_phase1_foundation.sql, phase23_tournaments_phase2_host_workflows.sql, and phase24_tournaments_phase3_player_flows.sql

begin;

create or replace function public.tournament_rank_for_loss(
  p_bracket_size integer,
  p_round_number integer
)
returns integer
language sql
immutable
as $$
  select greatest(2, ((p_bracket_size / (2 ^ greatest(p_round_number - 1, 0))) / 2) + 1);
$$;

create or replace function public.start_tournament_match_secure(
  p_match_id uuid
)
returns public.tournament_match_details
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.tournament_matches;
  v_tournament public.tournaments;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_match
  from public.tournament_matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = v_match.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.host_id <> v_uid then
    raise exception 'Only the host can start matches';
  end if;

  if v_tournament.status <> 'active' then
    raise exception 'Tournament must be active to start a match';
  end if;

  if v_match.status not in ('ready', 'in_progress') then
    raise exception 'Only ready matches can be started';
  end if;

  if v_match.participant_1_registration_id is null or v_match.participant_2_registration_id is null then
    raise exception 'Both participants must be present before the match can start';
  end if;

  update public.tournament_matches tm
  set status = 'in_progress',
      started_at = coalesce(tm.started_at, now()),
      updated_at = now()
  where tm.id = p_match_id;

  return (
    select tmd
    from public.tournament_match_details tmd
    where tmd.id = p_match_id
  );
end;
$$;

grant execute on function public.start_tournament_match_secure(uuid) to authenticated;

create or replace function public.finalize_tournament_if_complete(
  p_tournament_id uuid
)
returns public.tournaments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tournament public.tournaments;
  v_final_match public.tournament_matches;
  v_champion_id uuid;
  v_runner_up_id uuid;
  v_match_count integer;
  v_completed_count integer;
  v_champion_name text;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  select count(*), count(*) filter (where status = 'completed')
  into v_match_count, v_completed_count
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and bracket_side = 'main';

  if coalesce(v_match_count, 0) = 0 or v_match_count <> v_completed_count then
    return v_tournament;
  end if;

  select * into v_final_match
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and bracket_side = 'main'
  order by round_number desc, match_number desc
  limit 1;

  if not found or v_final_match.winner_registration_id is null then
    return v_tournament;
  end if;

  v_champion_id := v_final_match.winner_registration_id;
  v_runner_up_id := v_final_match.loser_registration_id;

  update public.tournament_registrations tr
  set status = case when tr.id = v_champion_id then 'champion' else tr.status end,
      final_rank = case
        when tr.id = v_champion_id then 1
        when v_runner_up_id is not null and tr.id = v_runner_up_id then coalesce(tr.final_rank, 2)
        else tr.final_rank
      end,
      metadata = coalesce(tr.metadata, '{}'::jsonb) ||
        case when tr.id = v_champion_id then jsonb_build_object('champion_at', now()) else '{}'::jsonb end
  where tr.tournament_id = p_tournament_id;

  update public.profiles p
  set xp = coalesce(p.xp, 0) + 100
  from public.tournament_registrations tr
  where tr.id = v_champion_id
    and tr.user_id is not null
    and p.id = tr.user_id;

  update public.profiles p
  set xp = coalesce(p.xp, 0) + 40
  from public.tournament_registrations tr
  where tr.id = v_runner_up_id
    and tr.user_id is not null
    and p.id = tr.user_id;

  update public.squads s
  set wins = coalesce(s.wins, 0) + 1,
      points = coalesce(s.points, 0) + 100
  from public.tournament_registrations tr
  where tr.id = v_champion_id
    and tr.squad_id is not null
    and s.id = tr.squad_id;

  update public.squads s
  set losses = coalesce(s.losses, 0) + 1,
      points = coalesce(s.points, 0) + 25
  from public.tournament_registrations tr
  where tr.id = v_runner_up_id
    and tr.squad_id is not null
    and s.id = tr.squad_id;

  select display_name into v_champion_name
  from public.tournament_registration_details
  where id = v_champion_id;

  insert into public.notifications (user_id, type, related_tournament_id, message)
  select tr.user_id,
         'tournament_completed',
         p_tournament_id,
         case
           when tr.id = v_champion_id then 'You won ' || v_tournament.name || '!'
           when v_runner_up_id is not null and tr.id = v_runner_up_id then 'You finished runner-up in ' || v_tournament.name || '.'
           else coalesce(v_champion_name, 'A team') || ' won ' || v_tournament.name || '.'
         end
  from public.tournament_registrations tr
  where tr.tournament_id = p_tournament_id
    and tr.user_id is not null
  on conflict do nothing;

  update public.tournaments t
  set status = 'completed',
      winner_registration_id = v_champion_id,
      completed_at = now(),
      ends_at = coalesce(t.ends_at, now()),
      settings = coalesce(t.settings, '{}'::jsonb) || jsonb_build_object('completed_at', now())
  where t.id = p_tournament_id
  returning * into v_tournament;

  return v_tournament;
end;
$$;

create or replace function public.submit_tournament_match_result_secure(
  p_match_id uuid,
  p_participant_1_score integer,
  p_participant_2_score integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.tournament_matches;
  v_tournament public.tournaments;
  v_bracket_size integer;
  v_winner_id uuid;
  v_loser_id uuid;
  v_loser_rank integer;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_participant_1_score is null or p_participant_2_score is null then
    raise exception 'Both scores are required';
  end if;

  if p_participant_1_score < 0 or p_participant_2_score < 0 then
    raise exception 'Scores must be non-negative';
  end if;

  if p_participant_1_score = p_participant_2_score then
    raise exception 'Matches cannot end in a tie';
  end if;

  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = v_match.tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.host_id <> v_uid then
    raise exception 'Only the host can submit match results';
  end if;

  if v_tournament.status <> 'active' then
    raise exception 'Tournament must be active to submit results';
  end if;

  if v_match.status not in ('ready', 'in_progress') then
    raise exception 'Only ready or in-progress matches can be completed';
  end if;

  if v_match.participant_1_registration_id is null or v_match.participant_2_registration_id is null then
    raise exception 'Both participants must be present before submitting a result';
  end if;

  if p_participant_1_score > p_participant_2_score then
    v_winner_id := v_match.participant_1_registration_id;
    v_loser_id := v_match.participant_2_registration_id;
  else
    v_winner_id := v_match.participant_2_registration_id;
    v_loser_id := v_match.participant_1_registration_id;
  end if;

  update public.tournament_matches tm
  set participant_1_score = p_participant_1_score,
      participant_2_score = p_participant_2_score,
      winner_registration_id = v_winner_id,
      loser_registration_id = v_loser_id,
      status = 'completed',
      started_at = coalesce(tm.started_at, now()),
      completed_at = now(),
      updated_at = now()
  where tm.id = p_match_id;

  v_bracket_size := greatest(coalesce((v_match.metadata ->> 'bracket_size')::integer, (v_tournament.settings ->> 'bracket_size')::integer, 2), 2);
  v_loser_rank := public.tournament_rank_for_loss(v_bracket_size, v_match.round_number);

  update public.tournament_registrations tr
  set status = case when tr.id = v_loser_id then 'eliminated' else tr.status end,
      eliminated_at = case when tr.id = v_loser_id then now() else tr.eliminated_at end,
      final_rank = case when tr.id = v_loser_id then coalesce(tr.final_rank, v_loser_rank) else tr.final_rank end,
      metadata = coalesce(tr.metadata, '{}'::jsonb) ||
        case when tr.id = v_loser_id then jsonb_build_object('eliminated_in_round', v_match.round_number) else '{}'::jsonb end
  where tr.id in (v_winner_id, v_loser_id);

  if v_match.next_match_id is not null and v_match.next_match_slot is not null then
    if v_match.next_match_slot = 1 then
      update public.tournament_matches
      set participant_1_registration_id = v_winner_id,
          updated_at = now()
      where id = v_match.next_match_id;
    else
      update public.tournament_matches
      set participant_2_registration_id = v_winner_id,
          updated_at = now()
      where id = v_match.next_match_id;
    end if;
  end if;

  perform public.refresh_tournament_match_readiness(v_match.tournament_id);
  perform public.advance_tournament_byes(v_match.tournament_id);
  perform public.finalize_tournament_if_complete(v_match.tournament_id);

  select jsonb_build_object(
    'updated_match', (
      select row_to_json(tmd)
      from public.tournament_match_details tmd
      where tmd.id = p_match_id
    ),
    'affected_matches', (
      select coalesce(jsonb_agg(row_to_json(tmd) order by tmd.round_number, tmd.match_number), '[]'::jsonb)
      from public.tournament_match_details tmd
      where tmd.tournament_id = v_match.tournament_id
    ),
    'tournament', (
      select row_to_json(t)
      from public.tournaments t
      where t.id = v_match.tournament_id
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.submit_tournament_match_result_secure(uuid, integer, integer) to authenticated;

commit;
