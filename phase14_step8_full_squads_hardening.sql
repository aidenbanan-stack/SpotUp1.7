begin;

alter table public.squad_match_posts
  add column if not exists location_name text,
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision;

alter table public.squad_match_posts
  drop constraint if exists squad_match_posts_location_name_len_check;

alter table public.squad_match_posts
  add constraint squad_match_posts_location_name_len_check
  check (location_name is null or length(trim(location_name)) between 1 and 240);

create index if not exists squad_match_posts_status_created_idx
on public.squad_match_posts (status, created_at desc);

create index if not exists squad_match_posts_squad_status_idx
on public.squad_match_posts (squad_id, status, created_at desc);

create index if not exists squad_challenges_status_created_idx
on public.squad_challenges (status, created_at desc);

create unique index if not exists squad_game_invites_one_pending_per_game_user_idx
on public.squad_game_invites (game_id, invited_user_id)
where status = 'pending';

update public.squad_match_posts
set location_name = coalesce(location_name, notes)
where location_name is null
  and notes is not null
  and (notes ilike '%park%' or notes ilike '%court%' or notes ilike '%gym%');

commit;
