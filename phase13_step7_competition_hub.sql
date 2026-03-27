begin;

create index if not exists squad_match_posts_status_created_idx
on public.squad_match_posts (status, created_at desc);

create index if not exists squad_match_posts_squad_status_idx
on public.squad_match_posts (squad_id, status, created_at desc);

create index if not exists squad_challenges_challenged_status_idx
on public.squad_challenges (challenged_squad_id, status, created_at desc);

create index if not exists squad_challenges_challenger_status_idx
on public.squad_challenges (challenger_squad_id, status, created_at desc);

create index if not exists squad_game_invites_user_status_idx
on public.squad_game_invites (invited_user_id, status, created_at desc);

create index if not exists squad_game_invites_game_idx
on public.squad_game_invites (game_id, created_at desc);

create unique index if not exists squad_game_invites_unique_pending_idx
on public.squad_game_invites (game_id, squad_id, invited_user_id)
where status = 'pending';

create or replace view public.squad_competition_board as
select
  smp.id,
  smp.squad_id,
  s.name as squad_name,
  s.home_area,
  s.sport,
  smp.title,
  smp.notes,
  smp.preferred_time,
  smp.game_id,
  smp.created_by,
  p.username as created_by_username,
  smp.status,
  smp.created_at
from public.squad_match_posts smp
join public.squads s
  on s.id = smp.squad_id
left join public.profiles p
  on p.id = smp.created_by;

create or replace view public.squad_challenge_feed as
select
  sc.id,
  sc.challenger_squad_id,
  challenger.name as challenger_squad_name,
  sc.challenged_squad_id,
  challenged.name as challenged_squad_name,
  sc.created_by,
  actor.username as created_by_username,
  sc.message,
  sc.proposed_game_id,
  sc.status,
  sc.created_at,
  sc.responded_at
from public.squad_challenges sc
join public.squads challenger
  on challenger.id = sc.challenger_squad_id
join public.squads challenged
  on challenged.id = sc.challenged_squad_id
left join public.profiles actor
  on actor.id = sc.created_by;

commit;
