-- Phase 22: Tournaments Phase 1 foundation
-- Run this after your previous SpotUp SQL patches.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.normalize_tournament_team_count(p_team_count text)
returns integer
language plpgsql
immutable
as $$
declare
  v_value integer;
begin
  begin
    v_value := nullif(regexp_replace(coalesce(trim(p_team_count), ''), '[^0-9]', '', 'g'), '')::integer;
  exception when others then
    v_value := null;
  end;

  return greatest(coalesce(v_value, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tournaments table hardening + metadata for later phases
-- ---------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists registration_closes_at timestamptz,
  add column if not exists bracket_generated_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists winner_registration_id uuid,
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Tournament registrations hardening
-- ---------------------------------------------------------------------------
alter table public.tournament_registrations
  add column if not exists seed integer,
  add column if not exists checked_in_at timestamptz,
  add column if not exists eliminated_at timestamptz,
  add column if not exists final_rank integer,
  add column if not exists roster_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- normalize existing rows before adding constraints
update public.tournament_registrations
set status = 'registered'
where status is null
   or status not in ('pending','registered','checked_in','eliminated','withdrawn','disqualified','champion');

alter table public.tournament_registrations
  drop constraint if exists tournament_registrations_one_entry_target_check,
  add constraint tournament_registrations_one_entry_target_check
    check (
      ((user_id is not null)::integer + (squad_id is not null)::integer) = 1
    ),
  drop constraint if exists tournament_registrations_status_check,
  add constraint tournament_registrations_status_check
    check (status in ('pending','registered','checked_in','eliminated','withdrawn','disqualified','champion')),
  drop constraint if exists tournament_registrations_seed_check,
  add constraint tournament_registrations_seed_check
    check (seed is null or seed >= 1),
  drop constraint if exists tournament_registrations_final_rank_check,
  add constraint tournament_registrations_final_rank_check
    check (final_rank is null or final_rank >= 1);

create unique index if not exists tournament_registrations_unique_user_per_tournament
  on public.tournament_registrations (tournament_id, user_id)
  where user_id is not null;

create unique index if not exists tournament_registrations_unique_squad_per_tournament
  on public.tournament_registrations (tournament_id, squad_id)
  where squad_id is not null;

create index if not exists tournament_registrations_tournament_status_idx
  on public.tournament_registrations (tournament_id, status, created_at);

create index if not exists tournament_registrations_squad_idx
  on public.tournament_registrations (squad_id)
  where squad_id is not null;

-- ---------------------------------------------------------------------------
-- Tournament matches foundation
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null,
  match_number integer not null,
  bracket_side text not null default 'main',
  stage_label text,
  status text not null default 'pending',
  best_of integer not null default 1,
  participant_1_registration_id uuid references public.tournament_registrations(id) on delete set null,
  participant_2_registration_id uuid references public.tournament_registrations(id) on delete set null,
  participant_1_score integer,
  participant_2_score integer,
  winner_registration_id uuid references public.tournament_registrations(id) on delete set null,
  loser_registration_id uuid references public.tournament_registrations(id) on delete set null,
  next_match_id uuid references public.tournament_matches(id) on delete set null,
  next_match_slot integer,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  source text not null default 'system',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_matches_round_check check (round_number >= 1),
  constraint tournament_matches_match_number_check check (match_number >= 1),
  constraint tournament_matches_bracket_side_check check (bracket_side in ('main', 'winners', 'losers', 'finals', 'placement')),
  constraint tournament_matches_status_check check (status in ('pending', 'ready', 'in_progress', 'completed', 'cancelled')),
  constraint tournament_matches_best_of_check check (best_of >= 1 and best_of % 2 = 1),
  constraint tournament_matches_next_slot_check check (next_match_slot is null or next_match_slot in (1, 2)),
  constraint tournament_matches_scores_nonnegative_check check (
    (participant_1_score is null or participant_1_score >= 0)
    and (participant_2_score is null or participant_2_score >= 0)
  ),
  constraint tournament_matches_distinct_participants_check check (
    participant_1_registration_id is null
    or participant_2_registration_id is null
    or participant_1_registration_id <> participant_2_registration_id
  )
);

create unique index if not exists tournament_matches_unique_position_idx
  on public.tournament_matches (tournament_id, bracket_side, round_number, match_number);

create index if not exists tournament_matches_tournament_idx
  on public.tournament_matches (tournament_id, round_number, match_number);

create index if not exists tournament_matches_next_match_idx
  on public.tournament_matches (next_match_id)
  where next_match_id is not null;

create or replace function public.set_tournament_match_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_tournament_match_updated_at on public.tournament_matches;
create trigger set_tournament_match_updated_at
before update on public.tournament_matches
for each row
execute function public.set_tournament_match_updated_at();

-- ---------------------------------------------------------------------------
-- Read views for frontend use
-- ---------------------------------------------------------------------------
create or replace view public.tournament_registration_details as
select
  tr.id,
  tr.tournament_id,
  tr.user_id,
  tr.squad_id,
  case when tr.user_id is not null then 'solo' else 'squad' end as entry_type,
  coalesce(p.username, s.name, 'Unknown') as display_name,
  p.profile_photo_url as user_profile_photo_url,
  s.primary_color as squad_primary_color,
  s.secondary_color as squad_secondary_color,
  tr.seed,
  tr.status,
  tr.checked_in_at,
  tr.eliminated_at,
  tr.final_rank,
  tr.roster_snapshot,
  tr.metadata,
  tr.created_at
from public.tournament_registrations tr
left join public.profiles p on p.id = tr.user_id
left join public.squads s on s.id = tr.squad_id;

create or replace view public.tournament_match_details as
select
  tm.*,
  p1.display_name as participant_1_name,
  p2.display_name as participant_2_name,
  pw.display_name as winner_name,
  pl.display_name as loser_name
from public.tournament_matches tm
left join public.tournament_registration_details p1 on p1.id = tm.participant_1_registration_id
left join public.tournament_registration_details p2 on p2.id = tm.participant_2_registration_id
left join public.tournament_registration_details pw on pw.id = tm.winner_registration_id
left join public.tournament_registration_details pl on pl.id = tm.loser_registration_id;

-- ---------------------------------------------------------------------------
-- Core secure tournament functions
-- ---------------------------------------------------------------------------
drop function if exists public.create_tournament_secure(text, text, text, text, text, text, text, jsonb, timestamptz, text);
create or replace function public.create_tournament_secure(
  p_name text,
  p_sport text,
  p_format text,
  p_series_type text,
  p_team_count text,
  p_points_style text,
  p_join_mode text,
  p_is_private boolean,
  p_location jsonb,
  p_starts_at timestamptz,
  p_notes text default null,
  p_registration_closes_at timestamptz default null
)
returns public.tournaments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_capacity integer := public.normalize_tournament_team_count(p_team_count);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_pro_access(v_uid) then
    raise exception 'SpotUp Pro is required to create tournaments';
  end if;

  if coalesce(length(trim(p_name)), 0) < 3 then
    raise exception 'Tournament name must be at least 3 characters';
  end if;

  if p_join_mode not in ('solo', 'squad', 'either') then
    raise exception 'Invalid join mode';
  end if;

  if p_series_type not in ('single_elimination', 'best_of_3') then
    raise exception 'Invalid series type';
  end if;

  if v_capacity not in (4, 8, 16, 32) then
    raise exception 'Tournament team count must be 4, 8, 16, or 32';
  end if;

  if p_starts_at <= now() then
    raise exception 'Tournament start time must be in the future';
  end if;

  if p_registration_closes_at is not null and p_registration_closes_at > p_starts_at then
    raise exception 'Registration close time must be before the tournament start time';
  end if;

  insert into public.tournaments(
    host_id,
    name,
    sport,
    format,
    series_type,
    team_count,
    points_style,
    is_private,
    location,
    starts_at,
    notes,
    join_mode,
    status,
    registration_closes_at,
    settings
  )
  values (
    v_uid,
    trim(p_name),
    trim(p_sport),
    trim(p_format),
    trim(p_series_type),
    trim(p_team_count),
    trim(p_points_style),
    coalesce(p_is_private, false),
    coalesce(p_location, '{}'::jsonb),
    p_starts_at,
    nullif(trim(coalesce(p_notes, '')), ''),
    trim(p_join_mode),
    'scheduled',
    p_registration_closes_at,
    jsonb_build_object('capacity', v_capacity)
  )
  returning * into v_tournament;

  return v_tournament;
end;
$$;

grant execute on function public.create_tournament_secure(text, text, text, text, text, text, text, boolean, jsonb, timestamptz, text, timestamptz) to authenticated;

create or replace function public.register_for_tournament_secure(
  p_tournament_id uuid
)
returns public.tournament_registrations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_registration public.tournament_registrations;
  v_capacity integer;
  v_registered_count integer;
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

  if v_tournament.status <> 'scheduled' then
    raise exception 'This tournament is no longer accepting registrations';
  end if;

  if v_tournament.join_mode = 'squad' then
    raise exception 'This tournament requires squad registration';
  end if;

  if v_tournament.registration_closes_at is not null and now() > v_tournament.registration_closes_at then
    raise exception 'Registration for this tournament has closed';
  end if;

  select count(*) into v_registered_count
  from public.tournament_registrations
  where tournament_id = p_tournament_id
    and status in ('pending','registered','checked_in','champion');

  v_capacity := coalesce((v_tournament.settings ->> 'capacity')::integer, public.normalize_tournament_team_count(v_tournament.team_count));

  if v_capacity > 0 and v_registered_count >= v_capacity then
    raise exception 'This tournament is full';
  end if;

  insert into public.tournament_registrations (tournament_id, user_id, squad_id, status)
  values (p_tournament_id, v_uid, null, 'registered')
  on conflict (tournament_id, user_id) where user_id is not null
  do update set status = excluded.status
  returning * into v_registration;

  return v_registration;
end;
$$;

grant execute on function public.register_for_tournament_secure(uuid) to authenticated;

create or replace function public.register_squad_for_tournament_secure(
  p_tournament_id uuid,
  p_squad_id uuid
)
returns public.tournament_registrations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournaments;
  v_registration public.tournament_registrations;
  v_capacity integer;
  v_registered_count integer;
  v_is_member boolean;
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

  if v_tournament.status <> 'scheduled' then
    raise exception 'This tournament is no longer accepting registrations';
  end if;

  if v_tournament.join_mode = 'solo' then
    raise exception 'This tournament only allows solo registration';
  end if;

  if v_tournament.registration_closes_at is not null and now() > v_tournament.registration_closes_at then
    raise exception 'Registration for this tournament has closed';
  end if;

  select exists(
    select 1
    from public.squad_members sm
    where sm.squad_id = p_squad_id
      and sm.user_id = v_uid
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You must be a member of this squad to register it';
  end if;

  select count(*) into v_registered_count
  from public.tournament_registrations
  where tournament_id = p_tournament_id
    and status in ('pending','registered','checked_in','champion');

  v_capacity := coalesce((v_tournament.settings ->> 'capacity')::integer, public.normalize_tournament_team_count(v_tournament.team_count));

  if v_capacity > 0 and v_registered_count >= v_capacity then
    raise exception 'This tournament is full';
  end if;

  insert into public.tournament_registrations (tournament_id, user_id, squad_id, status)
  values (p_tournament_id, null, p_squad_id, 'registered')
  on conflict (tournament_id, squad_id) where squad_id is not null
  do update set status = excluded.status
  returning * into v_registration;

  return v_registration;
end;
$$;

grant execute on function public.register_squad_for_tournament_secure(uuid, uuid) to authenticated;

create or replace function public.list_tournament_registrations_secure(
  p_tournament_id uuid
)
returns setof public.tournament_registration_details
language sql
security definer
set search_path to 'public'
as $$
  select *
  from public.tournament_registration_details
  where tournament_id = p_tournament_id
  order by coalesce(seed, 999999), created_at, id;
$$;

grant execute on function public.list_tournament_registrations_secure(uuid) to authenticated;

create or replace function public.list_tournament_matches_secure(
  p_tournament_id uuid
)
returns setof public.tournament_match_details
language sql
security definer
set search_path to 'public'
as $$
  select *
  from public.tournament_match_details
  where tournament_id = p_tournament_id
  order by bracket_side, round_number, match_number, created_at;
$$;

grant execute on function public.list_tournament_matches_secure(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournament_matches enable row level security;

drop policy if exists tournaments_select_policy on public.tournaments;
create policy tournaments_select_policy
on public.tournaments
for select
using (
  (not is_private)
  or auth.uid() = host_id
  or exists (
    select 1
    from public.tournament_registrations tr
    where tr.tournament_id = tournaments.id
      and (
        tr.user_id = auth.uid()
        or exists (
          select 1
          from public.squad_members sm
          where sm.squad_id = tr.squad_id
            and sm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists tournaments_insert_policy on public.tournaments;
create policy tournaments_insert_policy
on public.tournaments
for insert
with check (auth.uid() = host_id);

drop policy if exists tournaments_update_policy on public.tournaments;
create policy tournaments_update_policy
on public.tournaments
for update
using (auth.uid() = host_id)
with check (auth.uid() = host_id);

drop policy if exists tournament_registrations_select_policy on public.tournament_registrations;
create policy tournament_registrations_select_policy
on public.tournament_registrations
for select
using (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_registrations.tournament_id
      and (
        (not t.is_private)
        or t.host_id = auth.uid()
        or tournament_registrations.user_id = auth.uid()
        or exists (
          select 1
          from public.squad_members sm
          where sm.squad_id = tournament_registrations.squad_id
            and sm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists tournament_registrations_insert_policy on public.tournament_registrations;
create policy tournament_registrations_insert_policy
on public.tournament_registrations
for insert
with check (
  (
    user_id = auth.uid()
    and squad_id is null
  )
  or (
    user_id is null
    and exists (
      select 1
      from public.squad_members sm
      where sm.squad_id = tournament_registrations.squad_id
        and sm.user_id = auth.uid()
    )
  )
);

drop policy if exists tournament_registrations_update_policy on public.tournament_registrations;
create policy tournament_registrations_update_policy
on public.tournament_registrations
for update
using (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_registrations.tournament_id
      and t.host_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_registrations.tournament_id
      and t.host_id = auth.uid()
  )
);

drop policy if exists tournament_matches_select_policy on public.tournament_matches;
create policy tournament_matches_select_policy
on public.tournament_matches
for select
using (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_matches.tournament_id
      and (
        (not t.is_private)
        or t.host_id = auth.uid()
        or exists (
          select 1
          from public.tournament_registrations tr
          where tr.tournament_id = t.id
            and (
              tr.user_id = auth.uid()
              or exists (
                select 1
                from public.squad_members sm
                where sm.squad_id = tr.squad_id
                  and sm.user_id = auth.uid()
              )
            )
        )
      )
  )
);

drop policy if exists tournament_matches_insert_policy on public.tournament_matches;
create policy tournament_matches_insert_policy
on public.tournament_matches
for insert
with check (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_matches.tournament_id
      and t.host_id = auth.uid()
  )
);

drop policy if exists tournament_matches_update_policy on public.tournament_matches;
create policy tournament_matches_update_policy
on public.tournament_matches
for update
using (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_matches.tournament_id
      and t.host_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_matches.tournament_id
      and t.host_id = auth.uid()
  )
);

commit;
