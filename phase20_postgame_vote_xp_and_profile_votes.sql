-- Awards XP for received post-game votes and keeps vote submission idempotent.
-- Current schema uses public.xp_events(user_id, event_key, xp).

create unique index if not exists ux_xp_events_user_event_key
  on public.xp_events(user_id, event_key);

create or replace function public.grant_xp_once(
  p_user_id uuid,
  p_event_key text,
  p_xp integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or coalesce(trim(p_event_key), '') = '' or coalesce(p_xp, 0) <= 0 then
    return false;
  end if;

  insert into public.xp_events (user_id, event_key, xp)
  values (p_user_id, p_event_key, p_xp)
  on conflict (user_id, event_key) do nothing;

  if found then
    update public.profiles
      set xp = coalesce(xp, 0) + p_xp
      where id = p_user_id;
    return true;
  end if;

  return false;
end;
$$;

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
  v_inserted boolean;
  v_existing_vote_xp integer;
  v_award integer;
  v_event_key text;
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

    select coalesce(sum(xp), 0)
      into v_existing_vote_xp
    from public.xp_events
    where user_id = v_target
      and event_key like ('postgame_vote:' || p_game_id::text || ':%');

    v_award := greatest(least(40 - v_existing_vote_xp, 15), 0);

    if v_award > 0 then
      v_event_key := 'postgame_vote:' || p_game_id::text || ':' || v_category || ':' || v_me::text || ':' || v_target::text;
      v_inserted := public.grant_xp_once(v_target, v_event_key, v_award);
    end if;
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

grant execute on function public.grant_xp_once(uuid, text, integer) to authenticated;
grant execute on function public.submit_post_game_votes(uuid, jsonb) to authenticated;
