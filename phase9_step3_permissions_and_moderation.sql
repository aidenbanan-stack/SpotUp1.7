-- Step 3: permissions, moderation, and leadership hardening
-- Safe to run after the earlier squads patches.

begin;

alter table public.squad_members
  drop constraint if exists squad_members_role_check;
alter table public.squad_members
  add constraint squad_members_role_check
  check (role in ('member', 'officer', 'captain'));

alter table public.squad_join_requests
  drop constraint if exists squad_join_requests_status_check;
alter table public.squad_join_requests
  add constraint squad_join_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'cancelled'));

alter table public.squad_invites
  drop constraint if exists squad_invites_status_check;
alter table public.squad_invites
  add constraint squad_invites_status_check
  check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired'));

alter table public.squad_rivalries
  drop constraint if exists squad_rivalries_status_check;
alter table public.squad_rivalries
  add constraint squad_rivalries_status_check
  check (status in ('active', 'heated', 'paused', 'archived'));

create unique index if not exists squad_join_requests_one_pending_per_user_idx
  on public.squad_join_requests (squad_id, user_id)
  where status = 'pending';

create unique index if not exists squad_invites_one_pending_per_user_idx
  on public.squad_invites (squad_id, invited_user_id)
  where status = 'pending';

create unique index if not exists squad_rivalries_unique_pair_idx
  on public.squad_rivalries (least(squad_id, rival_squad_id), greatest(squad_id, rival_squad_id));

create index if not exists squad_members_user_lookup_idx
  on public.squad_members (user_id, squad_id);
create index if not exists squad_bans_user_lookup_idx
  on public.squad_bans (user_id, squad_id);
create index if not exists squad_audit_logs_squad_created_idx
  on public.squad_audit_logs (squad_id, created_at desc);
create index if not exists squad_audit_logs_actor_idx
  on public.squad_audit_logs (actor_user_id, created_at desc);
create index if not exists squad_messages_squad_channel_created_idx
  on public.squad_messages (squad_id, channel, created_at desc);
create index if not exists squad_announcements_squad_created_idx
  on public.squad_announcements (squad_id, is_pinned desc, created_at desc);

create or replace view public.squad_leadership_snapshot as
select
  s.id as squad_id,
  s.name,
  s.owner_id,
  coalesce(owner_profile.username, 'Owner') as owner_username,
  count(sm.user_id) filter (where sm.role = 'captain') as captain_count,
  count(sm.user_id) filter (where sm.role = 'officer') as officer_count,
  count(sm.user_id) filter (where sm.role = 'member') as member_count,
  count(distinct sb.user_id) as banned_count,
  count(distinct sajr.id) filter (where sajr.status = 'pending') as pending_join_requests,
  count(distinct si.id) filter (where si.status = 'pending') as pending_invites,
  max(sal.created_at) as last_audit_at
from public.squads s
left join public.profiles owner_profile on owner_profile.id = s.owner_id
left join public.squad_members sm on sm.squad_id = s.id
left join public.squad_bans sb on sb.squad_id = s.id
left join public.squad_join_requests sajr on sajr.squad_id = s.id
left join public.squad_invites si on si.squad_id = s.id
left join public.squad_audit_logs sal on sal.squad_id = s.id
group by s.id, s.name, s.owner_id, owner_profile.username;

create or replace view public.squad_ban_details as
select
  sb.squad_id,
  sb.user_id,
  target.username as banned_username,
  sb.banned_by,
  banner.username as banned_by_username,
  sb.reason,
  sb.created_at
from public.squad_bans sb
left join public.profiles target on target.id = sb.user_id
left join public.profiles banner on banner.id = sb.banned_by;

commit;
