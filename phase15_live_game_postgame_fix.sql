-- Phase 15: live game + postgame hardening
-- Run this in the Supabase SQL editor.

alter table if exists public.games
  add column if not exists checked_in_at jsonb not null default '{}'::jsonb;

create or replace function public.toggle_check_in(p_game_id uuid, p_target_user_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_me uuid := auth.uid();
  v_checked uuid[];
  v_checked_at jsonb;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then
    raise exception 'Game not found';
  end if;
  if v_game.host_id <> v_me then
    raise exception 'Only the host can check players in';
  end if;
  if coalesce(v_game.status, 'scheduled') = 'finished' then
    raise exception 'Game already finished';
  end if;

  if not (
    p_target_user_id = v_game.host_id
    or p_target_user_id = any(coalesce(v_game.player_ids, '{}'::uuid[]))
  ) then
    raise exception 'User is not part of this game';
  end if;

  v_checked := coalesce(v_game.checked_in_ids, '{}'::uuid[]);
  v_checked_at := coalesce(v_game.checked_in_at, '{}'::jsonb);

  if p_target_user_id = any(v_checked) then
    v_checked := array_remove(v_checked, p_target_user_id);
    v_checked_at := v_checked_at - p_target_user_id::text;
  else
    v_checked := array_append(v_checked, p_target_user_id);
    v_checked_at := jsonb_set(v_checked_at, array[p_target_user_id::text], to_jsonb(now()), true);
  end if;

  update public.games
  set checked_in_ids = v_checked,
      checked_in_at = v_checked_at,
      status = case
        when coalesce(status, 'scheduled') = 'finished' then 'finished'
        when array_length(v_checked, 1) >= 2 then 'live'
        else 'scheduled'
      end
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.toggle_check_in(uuid, uuid) to authenticated;

create or replace function public.end_game_session(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_me uuid := auth.uid();
  v_checked_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then
    raise exception 'Game not found';
  end if;
  if v_game.host_id <> v_me then
    raise exception 'Only the host can end the game';
  end if;
  if coalesce(array_length(v_game.checked_in_ids, 1), 0) < 2 then
    raise exception 'At least 2 checked-in players are required';
  end if;

  if coalesce(v_game.status, 'scheduled') = 'finished' then
    return v_game;
  end if;

  update public.games
  set status = 'finished',
      ended_at = coalesce(ended_at, now()),
      runs_started = false
  where id = p_game_id
  returning * into v_game;

  foreach v_checked_id in array coalesce(v_game.checked_in_ids, '{}'::uuid[])
  loop
    update public.profiles
    set show_ups = coalesce(show_ups, 0) + 1
    where id = v_checked_id;
  end loop;

  return v_game;
end;
$$;

grant execute on function public.end_game_session(uuid) to authenticated;

create or replace function public.submit_post_game_votes(p_game_id uuid, p_votes jsonb)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_me uuid := auth.uid();
  v_vote jsonb;
  v_category text;
  v_target uuid;
  v_post_votes jsonb;
  v_post_voters jsonb;
  v_existing_for_voter jsonb;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then
    raise exception 'Game not found';
  end if;
  if coalesce(v_game.status, 'scheduled') <> 'finished' then
    raise exception 'Voting opens after the game ends';
  end if;
  if not (v_me = any(coalesce(v_game.checked_in_ids, '{}'::uuid[]))) then
    raise exception 'Only checked-in players can vote';
  end if;

  v_post_votes := coalesce(v_game.post_game_votes, '{}'::jsonb);
  v_post_voters := coalesce(v_game.post_game_voters, '{}'::jsonb);
  v_existing_for_voter := coalesce(v_post_voters -> v_me::text, '{}'::jsonb);

  if jsonb_typeof(p_votes) <> 'array' then
    raise exception 'Votes payload must be an array';
  end if;

  for v_vote in select * from jsonb_array_elements(p_votes)
  loop
    v_category := nullif(trim(coalesce(v_vote ->> 'category', '')), '');
    v_target := nullif(v_vote ->> 'votedUserId', '')::uuid;

    if v_category is null or v_target is null then
      continue;
    end if;
    if v_target = v_me then
      continue;
    end if;
    if not (v_target = any(coalesce(v_game.checked_in_ids, '{}'::uuid[]))) then
      continue;
    end if;
    if (v_existing_for_voter ? v_category) then
      continue;
    end if;

    v_post_votes := jsonb_set(
      v_post_votes,
      array[v_category, v_target::text],
      to_jsonb(coalesce((v_post_votes -> v_category ->> v_target::text)::integer, 0) + 1),
      true
    );

    v_existing_for_voter := jsonb_set(v_existing_for_voter, array[v_category], to_jsonb(v_target::text), true);
  end loop;

  v_post_voters := jsonb_set(v_post_voters, array[v_me::text], v_existing_for_voter, true);

  update public.games
  set post_game_votes = v_post_votes,
      post_game_voters = v_post_voters
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.submit_post_game_votes(uuid, jsonb) to authenticated;
