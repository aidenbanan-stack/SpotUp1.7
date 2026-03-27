begin;

-- =========================================================
-- STEP 5: SQUAD EVENTS + SCHEDULING
-- Adds richer recurring event scheduling and RSVP analytics
-- =========================================================

alter table public.squad_events
  add column if not exists recurrence_rule text,
  add column if not exists max_attendees integer,
  add column if not exists status text not null default 'scheduled';

alter table public.squad_events
  drop constraint if exists squad_events_status_check;

alter table public.squad_events
  add constraint squad_events_status_check
  check (status in ('scheduled', 'cancelled', 'completed'));

alter table public.squad_events
  drop constraint if exists squad_events_max_attendees_check;

alter table public.squad_events
  add constraint squad_events_max_attendees_check
  check (max_attendees is null or max_attendees >= 1);

alter table public.squad_events
  drop constraint if exists squad_events_recurrence_rule_len_check;

alter table public.squad_events
  add constraint squad_events_recurrence_rule_len_check
  check (recurrence_rule is null or length(recurrence_rule) <= 255);

alter table public.squad_events
  drop constraint if exists squad_events_notes_len_check;

alter table public.squad_events
  add constraint squad_events_notes_len_check
  check (notes is null or length(notes) <= 4000);

alter table public.squad_events
  drop constraint if exists squad_events_ends_after_starts_check;

alter table public.squad_events
  add constraint squad_events_ends_after_starts_check
  check (ends_at is null or ends_at > starts_at);

create index if not exists squad_events_squad_starts_idx
on public.squad_events (squad_id, starts_at asc);

create index if not exists squad_events_creator_idx
on public.squad_events (creator_id, starts_at desc);

create index if not exists squad_event_rsvps_user_status_idx
on public.squad_event_rsvps (user_id, status, created_at desc);

create index if not exists squad_event_rsvps_event_status_idx
on public.squad_event_rsvps (squad_event_id, status);

insert into public.squad_feed_events (squad_id, event_type, title, body, actor_user_id, metadata)
select
  se.squad_id,
  'event',
  'Squad schedule unlocked',
  'Leadership can now plan recurring practices, scrimmages, and RSVP-based events.',
  se.creator_id,
  jsonb_build_object('event_id', se.id)
from public.squad_events se
where not exists (
  select 1
  from public.squad_feed_events sfe
  where sfe.squad_id = se.squad_id
    and sfe.event_type = 'event'
    and sfe.title = 'Squad schedule unlocked'
)
limit 1;

drop view if exists public.squad_event_schedule_summary;

create view public.squad_event_schedule_summary as
select
  se.id,
  se.squad_id,
  se.creator_id,
  se.title,
  se.event_kind,
  se.location_name,
  se.starts_at,
  se.ends_at,
  se.notes,
  se.visibility,
  se.recurrence_rule,
  se.max_attendees,
  se.status,
  coalesce(sum(case when r.status = 'going' then 1 else 0 end), 0) as going_count,
  coalesce(sum(case when r.status = 'maybe' then 1 else 0 end), 0) as maybe_count,
  coalesce(sum(case when r.status = 'not_going' then 1 else 0 end), 0) as not_going_count
from public.squad_events se
left join public.squad_event_rsvps r
  on r.squad_event_id = se.id
group by
  se.id,
  se.squad_id,
  se.creator_id,
  se.title,
  se.event_kind,
  se.location_name,
  se.starts_at,
  se.ends_at,
  se.notes,
  se.visibility,
  se.recurrence_rule,
  se.max_attendees,
  se.status;

create or replace function public.touch_squad_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_squad_settings_updated_at on public.squad_settings;
create trigger trg_touch_squad_settings_updated_at
before update on public.squad_settings
for each row
execute function public.touch_squad_settings_updated_at();

commit;
