-- Step 2: create/edit squad system + membership workflow helpers
-- Safe additive patch for the current SpotUp schema.

begin;

create index if not exists idx_squad_join_requests_squad_status_created
  on public.squad_join_requests (squad_id, status, created_at desc);

create index if not exists idx_squad_invites_squad_status_created
  on public.squad_invites (squad_id, status, created_at desc);

create index if not exists idx_squad_invites_invited_user_status_created
  on public.squad_invites (invited_user_id, status, created_at desc);

create index if not exists idx_squad_announcements_squad_pinned_created
  on public.squad_announcements (squad_id, is_pinned desc, created_at desc);

create unique index if not exists uniq_pending_squad_join_request
  on public.squad_join_requests (squad_id, user_id)
  where status = 'pending';

create unique index if not exists uniq_pending_squad_invite
  on public.squad_invites (squad_id, invited_user_id)
  where status = 'pending';

create or replace function public.squad_user_can_manage(p_squad_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.squad_members sm
    where sm.squad_id = p_squad_id
      and sm.user_id = p_user_id
      and lower(sm.role) in ('owner', 'captain', 'officer')
  )
  or exists (
    select 1
    from public.squads s
    where s.id = p_squad_id
      and s.owner_id = p_user_id
  );
$$;

create or replace function public.squad_user_can_invite(p_squad_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select public.squad_user_can_manage(p_squad_id, p_user_id)
  or exists (
    select 1
    from public.squad_settings ss
    join public.squad_members sm
      on sm.squad_id = ss.squad_id
     and sm.user_id = p_user_id
    where ss.squad_id = p_squad_id
      and ss.allow_member_invites = true
  );
$$;

create or replace view public.squad_members_detailed as
select
  sm.squad_id,
  sm.user_id,
  sm.role,
  sm.joined_at,
  p.username,
  p.city,
  p.xp,
  p.reliability_score,
  p.profile_photo_url
from public.squad_members sm
join public.profiles p
  on p.id = sm.user_id;

commit;
