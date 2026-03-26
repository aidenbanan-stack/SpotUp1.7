-- =========================================================
-- SPOTUP PHASE 6 FULL SQUADS SYSTEM PATCH
-- Adds schema support for richer squads features.
-- This patch is intentionally additive and safe to review.
-- =========================================================

alter table public.squads add column if not exists description text;
alter table public.squads add column if not exists visibility text not null default 'public';
alter table public.squads add column if not exists vibe text not null default 'competitive';
alter table public.squads add column if not exists weekly_goal integer not null default 5;
alter table public.squads add column if not exists primary_color text;
alter table public.squads add column if not exists secondary_color text;
alter table public.squads add column if not exists home_court text;
alter table public.squads add column if not exists recruiting boolean not null default true;
alter table public.squads add column if not exists reliability_min integer not null default 90;

create table if not exists public.squad_join_requests (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (squad_id, user_id)
);

create table if not exists public.squad_invites (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.squad_announcements (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.squad_feed_events (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text,
  actor_user_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.squad_rivalries (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  rival_squad_id uuid not null references public.squads(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (squad_id, rival_squad_id)
);

create table if not exists public.squad_events (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  creator_id uuid not null references public.profiles(id),
  title text not null,
  event_kind text not null default 'practice',
  location_name text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  visibility text not null default 'members_only',
  created_at timestamptz not null default now()
);

create table if not exists public.squad_event_rsvps (
  squad_event_id uuid not null references public.squad_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'going',
  created_at timestamptz not null default now(),
  primary key (squad_event_id, user_id)
);

create table if not exists public.squad_messages (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  channel text not null default 'main',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.squad_reports (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id),
  reporter_user_id uuid not null references public.profiles(id),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.squad_bans (
  squad_id uuid not null references public.squads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

create index if not exists idx_squad_join_requests_squad_status on public.squad_join_requests (squad_id, status, created_at desc);
create index if not exists idx_squad_invites_invited_user on public.squad_invites (invited_user_id, status, created_at desc);
create index if not exists idx_squad_feed_events_squad on public.squad_feed_events (squad_id, created_at desc);
create index if not exists idx_squad_events_squad on public.squad_events (squad_id, starts_at asc);
create index if not exists idx_squad_messages_squad_channel on public.squad_messages (squad_id, channel, created_at desc);

create or replace view public.squad_rivalry_leaderboard as
select
  s.id as squad_id,
  s.name as squad_name,
  r.rival_squad_id,
  rs.name as rival_name,
  count(m.id) as total_matches,
  count(*) filter (where m.winner_squad_id = s.id) as rivalry_wins,
  count(*) filter (where m.loser_squad_id = s.id) as rivalry_losses
from public.squads s
join public.squad_rivalries r on r.squad_id = s.id
join public.squads rs on rs.id = r.rival_squad_id
left join public.squad_match_results m
  on (m.squad_a_id = s.id and m.squad_b_id = rs.id)
  or (m.squad_a_id = rs.id and m.squad_b_id = s.id)
group by s.id, s.name, r.rival_squad_id, rs.name;
