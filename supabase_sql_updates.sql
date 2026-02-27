-- SpotUp Supabase SQL updates
-- Run this in Supabase SQL editor.
-- Notes:
-- 1) These functions are optional but recommended. The app includes client-side fallbacks where possible.
-- 2) Adjust policies to match your security needs.

-- -----------------------------------------------------------------------------
-- PROFILES: progression + reliability columns
-- -----------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists xp integer not null default 0,
  add column if not exists show_ups integer not null default 0,
  add column if not exists cancellations integer not null default 0,
  add column if not exists no_shows integer not null default 0,
  add column if not exists reliability_score integer not null default 100;

-- Public profile lookup for messaging (username + photo only).
-- This avoids needing a wide-open SELECT policy on profiles while still letting users see
-- who they are messaging.
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
-- XP EVENTS (idempotent awarding)
-- -----------------------------------------------------------------------------
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  game_id uuid null,
  points integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_type, game_id)
);

alter table public.xp_events enable row level security;

-- Users can insert their own XP events only via RPC.
-- Allow select on own rows (optional).
create policy if not exists "xp_events_select_own"
on public.xp_events
for select
using (auth.uid() = user_id);

-- Award XP (idempotent)
create or replace function public.award_xp(p_event_type text, p_game_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_points integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Point values (tweak freely)
  v_points := case p_event_type
    when 'host_game' then 50
    when 'join_game' then 10
    when 'check_in' then 20
    when 'finish_game' then 50
    when 'postgame_vote' then 10
    when 'received_vote' then 5
    else 0
  end;

  if v_points <= 0 then
    return (select xp from public.profiles where id = v_user);
  end if;

  insert into public.xp_events(user_id, event_type, game_id, points)
  values (v_user, p_event_type, p_game_id, v_points)
  on conflict do nothing;

  -- Only increment if we actually inserted (found in rowcount)
  if found then
    update public.profiles
      set xp = coalesce(xp,0) + v_points
      where id = v_user;
  end if;

  return (select xp from public.profiles where id = v_user);
end;
$$;

-- -----------------------------------------------------------------------------
-- GAME REQUESTS: host approves/denies pending requests
-- -----------------------------------------------------------------------------
create or replace function public.approve_game_request(p_game_id uuid, p_user_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_host uuid := auth.uid();
begin
  if v_host is null then raise exception 'Not authenticated'; end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then raise exception 'Game not found'; end if;
  if v_game.host_id <> v_host then raise exception 'Only host can approve'; end if;

  update public.games
  set pending_request_ids = array_remove(coalesce(pending_request_ids,'{}'::uuid[]), p_user_id),
      player_ids = case
        when p_user_id = any(coalesce(player_ids,'{}'::uuid[])) then player_ids
        else array_append(coalesce(player_ids,'{}'::uuid[]), p_user_id)
      end
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

create or replace function public.reject_game_request(p_game_id uuid, p_user_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_host uuid := auth.uid();
begin
  if v_host is null then raise exception 'Not authenticated'; end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then raise exception 'Game not found'; end if;
  if v_game.host_id <> v_host then raise exception 'Only host can reject'; end if;

  update public.games
  set pending_request_ids = array_remove(coalesce(pending_request_ids,'{}'::uuid[]), p_user_id)
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

-- -----------------------------------------------------------------------------
-- POSTGAME VOTES: allow any participant to submit
-- -----------------------------------------------------------------------------
create or replace function public.submit_post_game_votes(p_game_id uuid, p_votes jsonb, p_voter_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_voter_id <> v_me then raise exception 'Invalid voter'; end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then raise exception 'Game not found'; end if;

  if not (v_me = any(coalesce(v_game.player_ids,'{}'::uuid[])) or v_me = v_game.host_id) then
    raise exception 'Not a participant';
  end if;

  update public.games
  set post_game_votes = p_votes,
      post_game_voters = case
        when v_me = any(coalesce(post_game_voters,'{}'::uuid[])) then post_game_voters
        else array_append(coalesce(post_game_voters,'{}'::uuid[]), v_me)
      end
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

-- -----------------------------------------------------------------------------
-- RELIABILITY: host reports a no-show
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

-- Only allow reading own reports (optional)
create policy if not exists "no_show_reports_select_own"
on public.no_show_reports
for select
using (auth.uid() = reported_user_id or auth.uid() = reporter_user_id);

create or replace function public.report_no_show(p_game_id uuid, p_reported_user uuid)
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
  if v_me is null then raise exception 'Not authenticated'; end if;

  select * into v_game from public.games where id = p_game_id;
  if v_game is null then raise exception 'Game not found'; end if;
  if v_game.host_id <> v_me then raise exception 'Only host can report'; end if;
  if not (p_reported_user = any(coalesce(v_game.player_ids,'{}'::uuid[]))) then
    raise exception 'User is not signed up for this game';
  end if;

  -- Idempotent report per (game, user)
  insert into public.no_show_reports(game_id, reported_user_id, reporter_user_id)
  values (p_game_id, p_reported_user, v_me)
  on conflict do nothing;

  if found then
    update public.profiles
      set no_shows = coalesce(no_shows,0) + 1
      where id = p_reported_user;
  end if;

  select coalesce(show_ups,0), coalesce(cancellations,0), coalesce(no_shows,0)
    into v_show_ups, v_cancels, v_noshows
    from public.profiles
    where id = p_reported_user;

  v_total := v_show_ups + v_cancels + v_noshows;
  if v_total <= 0 then
    v_score := 100;
  else
    v_score := greatest(0, least(100, round((v_show_ups::numeric / v_total::numeric) * 100))::integer);
  end if;

  update public.profiles
    set reliability_score = v_score
    where id = p_reported_user;
end;
$$;

-- -----------------------------------------------------------------------------
-- MESSAGING: prevent duplicate direct chats + support game invites
-- -----------------------------------------------------------------------------

-- Conversations: store the normalized (user1_id, user2_id) pair for 1:1 DMs.
alter table if exists public.conversations
  add column if not exists user1_id uuid references auth.users(id) on delete cascade,
  add column if not exists user2_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists conversations_direct_pair_unique
  on public.conversations (user1_id, user2_id)
  where user1_id is not null and user2_id is not null;

-- Conversation members: ensure no duplicate memberships.
alter table if exists public.conversation_members
  add constraint if not exists conversation_members_unique unique (conversation_id, user_id);

-- Messages: type + meta payload for things like game invites.
alter table if exists public.messages
  add column if not exists type text not null default 'text',
  add column if not exists meta jsonb;

alter table if exists public.messages
  add constraint if not exists messages_type_check check (type in ('text','game_invite'));

-- Backfill user1_id/user2_id for existing 1:1 conversations (based on conversation_members).
with pairs as (
  select conversation_id,
         min(user_id) as u1,
         max(user_id) as u2
  from public.conversation_members
  group by conversation_id
  having count(*) = 2
)
update public.conversations c
set user1_id = p.u1,
    user2_id = p.u2
from pairs p
where c.id = p.conversation_id
  and (c.user1_id is null or c.user2_id is null);

-- OPTIONAL CLEANUP: delete duplicate direct conversations, keeping the oldest one.
-- This clears duplicate rows that were created before the unique index existed.
-- Run once, then keep the unique index.
with pair_convs as (
  select c.id, c.created_at, c.user1_id, c.user2_id
  from public.conversations c
  where c.user1_id is not null and c.user2_id is not null
), ranked as (
  select *, row_number() over (partition by user1_id, user2_id order by created_at asc, id asc) as rn
  from pair_convs
), dupe_ids as (
  select id from ranked where rn > 1
)
delete from public.messages where conversation_id in (select id from dupe_ids);

with dupe_ids as (
  select id
  from (
    select c.id, row_number() over (partition by c.user1_id, c.user2_id order by c.created_at asc, c.id asc) as rn
    from public.conversations c
    where c.user1_id is not null and c.user2_id is not null
  ) x
  where rn > 1
)
delete from public.conversation_members where conversation_id in (select id from dupe_ids);

with dupe_ids as (
  select id
  from (
    select c.id, row_number() over (partition by c.user1_id, c.user2_id order by c.created_at asc, c.id asc) as rn
    from public.conversations c
    where c.user1_id is not null and c.user2_id is not null
  ) x
  where rn > 1
)
delete from public.conversations where id in (select id from dupe_ids);

-- OPTIONAL NUCLEAR RESET (dev only): clears all messaging.
-- truncate table public.messages, public.conversation_members, public.conversations, public.message_requests;
