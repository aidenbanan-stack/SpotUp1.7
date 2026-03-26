-- Phase 7: Step 1 data model expansion for squads
-- Run this after your existing squads patches.

create extension if not exists pgcrypto;

create table if not exists public.squad_settings (
  squad_id uuid primary key references public.squads(id) on delete cascade,
  motto text,
  banner_url text,
  logo_url text,
  recruiting_status text not null default 'open' check (recruiting_status in ('open', 'selective', 'closed')),
  preferred_days text[] not null default '{}'::text[],
  skill_focus text[] not null default '{}'::text[],
  age_min integer,
  age_max integer,
  gender_focus text not null default 'open' check (gender_focus in ('open', 'mens', 'womens', 'coed')),
  rules text[] not null default '{}'::text[],
  allow_member_invites boolean not null default false,
  allow_officer_announcements boolean not null default true,
  join_questions_enabled boolean not null default true,
  require_join_message boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.squad_tags (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  tag text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists squad_tags_squad_id_idx on public.squad_tags(squad_id, sort_order);

create table if not exists public.squad_join_questions (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  question_text text not null,
  is_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists squad_join_questions_squad_id_idx on public.squad_join_questions(squad_id, sort_order);

create table if not exists public.squad_channels (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  channel_key text not null,
  channel_name text not null,
  is_private boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (squad_id, channel_key)
);
create index if not exists squad_channels_squad_id_idx on public.squad_channels(squad_id, sort_order);

create table if not exists public.squad_audit_logs (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  target_user_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists squad_audit_logs_squad_id_idx on public.squad_audit_logs(squad_id, created_at desc);

insert into public.squad_settings (squad_id, recruiting_status, rules)
select s.id,
       case when coalesce(s.recruiting, true) then 'open' else 'closed' end,
       case when s.description is null or btrim(s.description) = '' then '{}'::text[] else array['Respect every run', 'Communicate clearly'] end
from public.squads s
on conflict (squad_id) do nothing;

insert into public.squad_channels (squad_id, channel_key, channel_name, is_private, sort_order)
select seeded.squad_id, seeded.channel_key, seeded.channel_name, seeded.is_private, seeded.sort_order
from (
  select id as squad_id, 'main'::text as channel_key, 'Main chat'::text as channel_name, false as is_private, 0 as sort_order from public.squads
  union all
  select id as squad_id, 'announcements', 'Announcements', false, 1 from public.squads
  union all
  select id as squad_id, 'strategy', 'Strategy', true, 2 from public.squads
) seeded
on conflict (squad_id, channel_key) do nothing;

create or replace function public.log_squad_audit_event(
  p_squad_id uuid,
  p_action text,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.squad_audit_logs (squad_id, actor_user_id, action, target_user_id, metadata)
  values (p_squad_id, auth.uid(), p_action, p_target_user_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
