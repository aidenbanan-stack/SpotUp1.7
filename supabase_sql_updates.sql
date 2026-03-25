-- SpotUp Supabase SQL updates - Step 2 safe patch
-- Tailored to the current schema described in this conversation.
-- This script avoids unsupported CREATE POLICY IF NOT EXISTS syntax.

-- -----------------------------------------------------------------------------
-- STEP 2: additional schema needed for timed session XP + daily login bonus
-- -----------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists last_login_bonus_at timestamptz;

alter table if exists public.games
  add column if not exists checked_in_at jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Public profile lookup used by messaging / social features
-- -----------------------------------------------------------------------------
create or replace function public.get_public_profiles(p_user_ids uuid[])
returns table (
  id uuid,
  username text,
  profile_photo_url text,
  bio text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.profile_photo_url, p.bio
  from public.profiles p
  where p.id = any(p_user_ids);
$$;

grant execute on function public.get_public_profiles(uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Safe XP helper for the existing xp_events table shape
-- Assumes xp_events(user_id uuid, xp integer, event_key text, created_at timestamptz)
-- -----------------------------------------------------------------------------
create or replace function public.add_xp(
  p_user_id uuid,
  p_xp integer,
  p_event_key text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if exists (
    select 1
    from public.xp_events xe
    where xe.user_id = p_user_id
      and xe.event_key = p_event_key
  ) then
    return (select coalesce(xp, 0) from public.profiles where id = p_user_id);
  end if;

  insert into public.xp_events (user_id, xp, event_key)
  values (p_user_id, p_xp, p_event_key);

  update public.profiles
  set xp = coalesce(xp, 0) + p_xp
  where id = p_user_id
  returning xp into v_current;

  return coalesce(v_current, 0);
end;
$$;

grant execute on function public.add_xp(uuid, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Daily login bonus: +5 XP once per reset window when reliability > 90
-- Reset window uses 3 AM America/Los_Angeles.
-- -----------------------------------------------------------------------------
create or replace function public.claim_daily_login_bonus()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reliability integer := 0;
  v_reset_day date;
  v_event_key text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(reliability_score, 100)
    into v_reliability
  from public.profiles
  where id = v_user;

  if v_reliability <= 90 then
    return (select coalesce(xp, 0) from public.profiles where id = v_user);
  end if;

  v_reset_day := date(timezone('America/Los_Angeles', now() - interval '3 hours'));
  v_event_key := 'daily_login_' || v_reset_day::text;

  return public.add_xp(v_user, 5, v_event_key);
end;
$$;

grant execute on function public.claim_daily_login_bonus() to authenticated;

-- -----------------------------------------------------------------------------
-- Step 1 compatible award_xp helper used by the frontend
-- host_game = 30
-- check_in = 20
-- -----------------------------------------------------------------------------
create or replace function public.award_xp(p_event_type text, p_game_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_points integer := 0;
  v_event_key text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  v_points := case p_event_type
    when 'host_game' then 30
    when 'check_in' then 20
    else 0
  end;

  if v_points <= 0 then
    return (select coalesce(xp, 0) from public.profiles where id = v_user);
  end if;

  v_event_key := p_event_type || '_' || coalesce(p_game_id::text, 'global');
  return public.add_xp(v_user, v_points, v_event_key);
end;
$$;

grant execute on function public.award_xp(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Check-in handling with timestamp tracking.
-- Keeps existing checked_in_ids behavior and awards the +20 check-in XP once.
-- -----------------------------------------------------------------------------
create or replace function public.toggle_check_in(p_game_id uuid, p_checked_in boolean)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_game public.games;
  v_ids uuid[];
  v_times jsonb;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id;

  if v_game is null then
    raise exception 'Game not found';
  end if;

  if not (v_me = v_game.host_id or v_me = any(coalesce(v_game.player_ids, '{}'::uuid[]))) then
    raise exception 'Not allowed';
  end if;

  v_ids := coalesce(v_game.checked_in_ids, '{}'::uuid[]);
  v_times := coalesce(v_game.checked_in_at, '{}'::jsonb);

  if p_checked_in then
    if not (v_me = any(v_ids)) then
      v_ids := array_append(v_ids, v_me);
    end if;

    if not (v_times ? v_me::text) then
      v_times := jsonb_set(v_times, array[v_me::text], to_jsonb(now()), true);
      perform public.add_xp(v_me, 20, 'checkin_' || p_game_id::text || '_' || v_me::text);

      update public.profiles
      set show_ups = coalesce(show_ups, 0) + 1
      where id = v_me;
    end if;
  else
    v_ids := array_remove(v_ids, v_me);
    v_times := v_times - v_me::text;
  end if;

  update public.games
  set checked_in_ids = v_ids,
      checked_in_at = v_times
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.toggle_check_in(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- End game + timed session XP.
-- +5 XP per 30 minutes checked in, capped at 120 minutes (+20 XP max)
-- host gets +1 XP per checked-in player
-- -----------------------------------------------------------------------------
create or replace function public.end_game_session(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_game public.games;
  v_player uuid;
  v_start timestamptz;
  v_minutes integer;
  v_bonus integer;
  v_checked_count integer;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id;

  if v_game is null then
    raise exception 'Game not found';
  end if;

  if v_game.host_id <> v_me then
    raise exception 'Only host can end the game';
  end if;

  update public.games
  set status = 'finished',
      ended_at = coalesce(ended_at, now()),
      runs_started = false
  where id = p_game_id
  returning * into v_game;

  v_checked_count := coalesce(array_length(v_game.checked_in_ids, 1), 0);
  perform public.add_xp(v_game.host_id, v_checked_count, 'host_checked_in_bonus_' || p_game_id::text);

  foreach v_player in array coalesce(v_game.checked_in_ids, '{}'::uuid[])
  loop
    begin
      v_start := nullif(v_game.checked_in_at ->> v_player::text, '')::timestamptz;
    exception when others then
      v_start := null;
    end;

    if v_start is null then
      continue;
    end if;

    v_minutes := greatest(floor(extract(epoch from (coalesce(v_game.ended_at, now()) - v_start)) / 60)::integer, 0);
    v_bonus := least(4, floor(v_minutes / 30)::integer) * 5;

    if v_bonus > 0 then
      perform public.add_xp(v_player, v_bonus, 'session_time_' || p_game_id::text || '_' || v_player::text);
    end if;
  end loop;

  return v_game;
end;
$$;

grant execute on function public.end_game_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reliable no-show report
-- -----------------------------------------------------------------------------
create table if not exists public.no_show_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_id, reported_user_id)
);

alter table public.no_show_reports enable row level security;

drop policy if exists "no_show_reports_select_own" on public.no_show_reports;
create policy "no_show_reports_select_own"
on public.no_show_reports
for select
using (auth.uid() = reported_user_id or auth.uid() = reporter_user_id);

create or replace function public.report_no_show(p_game_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_me uuid := auth.uid();
  v_show_ups integer;
  v_cancels integer;
  v_noshows integer;
  v_total integer;
  v_score integer;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then raise exception 'Game not found'; end if;
  if v_game.host_id <> v_me then raise exception 'Only host can report'; end if;
  if not (p_user_id = any(coalesce(v_game.player_ids, '{}'::uuid[]))) then
    raise exception 'User is not signed up for this game';
  end if;

  insert into public.no_show_reports(game_id, reported_user_id, reporter_user_id)
  values (p_game_id, p_user_id, v_me)
  on conflict do nothing;

  if found then
    perform public.add_xp(p_user_id, -25, 'no_show_' || p_game_id::text || '_' || p_user_id::text);

    update public.profiles
      set no_shows = coalesce(no_shows, 0) + 1
      where id = p_user_id;
  end if;

  select coalesce(show_ups,0), coalesce(cancellations,0), coalesce(no_shows,0)
    into v_show_ups, v_cancels, v_noshows
    from public.profiles
    where id = p_user_id;

  v_total := v_show_ups + v_cancels + v_noshows;
  if v_total <= 0 then
    v_score := 100;
  else
    v_score := greatest(0, least(100, round((v_show_ups::numeric / v_total::numeric) * 100))::integer);
  end if;

  update public.profiles
    set reliability_score = v_score
    where id = p_user_id;
end;
$$;

grant execute on function public.report_no_show(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Direct chat creation helper compatibility.
-- -----------------------------------------------------------------------------
alter table if exists public.conversations
  add column if not exists user1_id uuid references auth.users(id) on delete cascade,
  add column if not exists user2_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

-- If you later confirm there are no duplicate direct conversations, you can add a
-- unique index on (user1_id, user2_id). This patch leaves it out to avoid failures on
-- projects that already have duplicate rows.

-- -----------------------------------------------------------------------------
-- Post-game votes: allow any participant to submit through RPC.
-- Stores the merged vote aggregates and voter ledger.
-- -----------------------------------------------------------------------------
create or replace function public.submit_post_game_votes(p_game_id uuid, p_votes jsonb, p_voters jsonb)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then
    raise exception 'Game not found';
  end if;

  if not (
    v_me = v_game.host_id
    or v_me = any(coalesce(v_game.player_ids, '{}'::uuid[]))
    or v_me = any(coalesce(v_game.checked_in_ids, '{}'::uuid[]))
  ) then
    raise exception 'Not a participant';
  end if;

  update public.games
  set post_game_votes = coalesce(p_votes, '{}'::jsonb),
      post_game_voters = coalesce(p_voters, '{}'::jsonb)
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.submit_post_game_votes(uuid, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Vote recipient XP: +15 each, capped at +40 per session.
-- -----------------------------------------------------------------------------
create or replace function public.award_received_votes(p_game_id uuid, p_votes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_vote jsonb;
  v_user uuid;
  v_existing integer;
  v_award integer;
  v_event_key text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  for v_vote in select * from jsonb_array_elements(coalesce(p_votes, '[]'::jsonb))
  loop
    v_user := nullif(v_vote->>'votedUserId', '')::uuid;

    if v_user is null or v_user = v_me then
      continue;
    end if;

    select coalesce(sum(xp), 0)
      into v_existing
    from public.xp_events
    where user_id = v_user
      and event_key like ('received_vote_' || p_game_id::text || '_%');

    v_award := greatest(least(40 - v_existing, 15), 0);
    v_event_key := 'received_vote_' || p_game_id::text || '_' || gen_random_uuid()::text;

    if v_award > 0 then
      perform public.add_xp(v_user, v_award, v_event_key);
    end if;
  end loop;
end;
$$;

grant execute on function public.award_received_votes(uuid, jsonb) to authenticated;
