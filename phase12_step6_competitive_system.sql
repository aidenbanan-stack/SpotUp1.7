begin;

-- =========================================================
-- STEP 6: SQUAD COMPETITION + GAME INVITES
-- Adds squad game invites, squad-vs-squad challenge board,
-- challenge tracking, and result recording support.
-- =========================================================

create table if not exists public.squad_game_invites (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint squad_game_invites_message_len_check check (message is null or length(message) <= 1000)
);

create table if not exists public.squad_match_posts (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  title text not null,
  notes text,
  preferred_time text,
  game_id uuid references public.games(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  created_at timestamptz not null default now(),
  constraint squad_match_posts_title_len_check check (length(trim(title)) between 1 and 140),
  constraint squad_match_posts_notes_len_check check (notes is null or length(notes) <= 2000),
  constraint squad_match_posts_time_len_check check (preferred_time is null or length(preferred_time) <= 140)
);

create table if not exists public.squad_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_squad_id uuid not null references public.squads(id) on delete cascade,
  challenged_squad_id uuid not null references public.squads(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  message text,
  proposed_game_id uuid references public.games(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint squad_challenges_not_self_check check (challenger_squad_id <> challenged_squad_id),
  constraint squad_challenges_message_len_check check (message is null or length(message) <= 1500)
);

create unique index if not exists squad_game_invites_unique_pending_idx
on public.squad_game_invites (squad_id, game_id, invited_user_id);

create index if not exists squad_game_invites_invited_user_status_idx
on public.squad_game_invites (invited_user_id, status, created_at desc);

create index if not exists squad_match_posts_status_created_idx
on public.squad_match_posts (status, created_at desc);

create index if not exists squad_match_posts_squad_idx
on public.squad_match_posts (squad_id, created_at desc);

create index if not exists squad_challenges_challenger_idx
on public.squad_challenges (challenger_squad_id, status, created_at desc);

create index if not exists squad_challenges_challenged_idx
on public.squad_challenges (challenged_squad_id, status, created_at desc);

create unique index if not exists squad_challenges_unique_pending_pair_idx
on public.squad_challenges (
  least(challenger_squad_id, challenged_squad_id),
  greatest(challenger_squad_id, challenged_squad_id)
)
where status in ('pending', 'accepted');

create or replace view public.squad_match_posts_view as
select
  p.id,
  p.squad_id,
  s.name as squad_name,
  s.sport,
  s.home_area,
  p.title,
  p.notes,
  p.preferred_time,
  p.game_id,
  p.created_by,
  pr.username as created_by_username,
  p.status,
  p.created_at
from public.squad_match_posts p
join public.squads s on s.id = p.squad_id
left join public.profiles pr on pr.id = p.created_by;

create or replace view public.squad_challenges_view as
select
  c.id,
  c.challenger_squad_id,
  a.name as challenger_squad_name,
  c.challenged_squad_id,
  b.name as challenged_squad_name,
  c.created_by,
  pr.username as created_by_username,
  c.message,
  c.proposed_game_id,
  g.title as proposed_game_title,
  c.status,
  c.created_at,
  c.responded_at
from public.squad_challenges c
join public.squads a on a.id = c.challenger_squad_id
join public.squads b on b.id = c.challenged_squad_id
left join public.profiles pr on pr.id = c.created_by
left join public.games g on g.id = c.proposed_game_id;

commit;
