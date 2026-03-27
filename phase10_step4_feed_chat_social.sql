begin;

-- =========================================================
-- STEP 4: FEED + CHAT + SOCIAL ACTIVITY HARDENING
-- =========================================================

alter table public.squad_messages
drop constraint if exists squad_messages_body_len_check;

alter table public.squad_messages
add constraint squad_messages_body_len_check
check (length(trim(body)) between 1 and 2000);

alter table public.squad_messages
drop constraint if exists squad_messages_channel_len_check;

alter table public.squad_messages
add constraint squad_messages_channel_len_check
check (length(trim(channel)) between 1 and 60);

alter table public.squad_events
drop constraint if exists squad_events_kind_check;

alter table public.squad_events
add constraint squad_events_kind_check
check (event_kind in ('practice', 'scrimmage', 'tryout', 'tournament', 'hangout'));

alter table public.squad_events
drop constraint if exists squad_events_visibility_check;

alter table public.squad_events
add constraint squad_events_visibility_check
check (visibility in ('members_only', 'leadership_only', 'public'));

alter table public.squad_event_rsvps
drop constraint if exists squad_event_rsvps_status_check;

alter table public.squad_event_rsvps
add constraint squad_event_rsvps_status_check
check (status in ('going', 'maybe', 'not_going'));

create index if not exists squad_messages_squad_channel_created_idx
on public.squad_messages (squad_id, channel, created_at desc);

create index if not exists squad_messages_sender_created_idx
on public.squad_messages (sender_id, created_at desc);

create index if not exists squad_feed_events_squad_type_created_idx
on public.squad_feed_events (squad_id, event_type, created_at desc);

create index if not exists squad_announcements_squad_pinned_created_idx
on public.squad_announcements (squad_id, is_pinned, created_at desc);

create index if not exists squad_events_squad_starts_idx
on public.squad_events (squad_id, starts_at asc);

create index if not exists squad_event_rsvps_user_status_idx
on public.squad_event_rsvps (user_id, status, created_at desc);

create or replace view public.squad_social_activity_summary as
select
  s.id as squad_id,
  s.name,
  coalesce(msg.message_count_7d, 0) as message_count_7d,
  coalesce(msg.active_chatters_7d, 0) as active_chatters_7d,
  coalesce(feed.feed_events_14d, 0) as feed_events_14d,
  coalesce(ann.pinned_announcements, 0) as pinned_announcements,
  coalesce(evt.upcoming_events, 0) as upcoming_events
from public.squads s
left join (
  select
    squad_id,
    count(*) as message_count_7d,
    count(distinct sender_id) as active_chatters_7d
  from public.squad_messages
  where created_at >= now() - interval '7 days'
  group by squad_id
) msg on msg.squad_id = s.id
left join (
  select squad_id, count(*) as feed_events_14d
  from public.squad_feed_events
  where created_at >= now() - interval '14 days'
  group by squad_id
) feed on feed.squad_id = s.id
left join (
  select squad_id, count(*) as pinned_announcements
  from public.squad_announcements
  where is_pinned = true
  group by squad_id
) ann on ann.squad_id = s.id
left join (
  select squad_id, count(*) as upcoming_events
  from public.squad_events
  where starts_at >= now()
  group by squad_id
) evt on evt.squad_id = s.id;

commit;
