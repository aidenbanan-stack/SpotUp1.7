-- =========================================================
-- DAILY LOGIN BONUS FIX
-- Fixes both XP awarding and the popup path expected by the frontend.
-- =========================================================

-- 1) Tighten xp_events so one event_key can only be granted once per user.
-- Remove duplicates first in case any old rows exist.
delete from public.xp_events a
using public.xp_events b
where a.ctid < b.ctid
  and a.user_id = b.user_id
  and a.event_key = b.event_key;

create unique index if not exists ux_xp_events_user_event_key
  on public.xp_events(user_id, event_key);

-- 2) Canonical grant_xp_once helper for the current xp_events schema.
drop function if exists public.grant_xp_once(uuid, text, integer);
create or replace function public.grant_xp_once(
  p_user_id uuid,
  p_event_key text,
  p_xp integer
)
returns boolean
language plpgsql
security definer
set search_path to public
as $$
declare
  v_rowcount integer := 0;
begin
  insert into public.xp_events (user_id, event_key, xp)
  values (p_user_id, p_event_key, p_xp)
  on conflict (user_id, event_key) do nothing;

  get diagnostics v_rowcount = row_count;

  if v_rowcount > 0 then
    update public.profiles
    set xp = coalesce(xp, 0) + p_xp
    where id = p_user_id;
    return true;
  end if;

  return false;
end;
$$;

-- 3) Rebuild the daily bonus function to match the current schema and 3 AM PST reset.
drop function if exists public.claim_daily_login_bonus();
create function public.claim_daily_login_bonus()
returns boolean
language plpgsql
security definer
set search_path to public
as $$
declare
  v_user uuid := auth.uid();
  v_reliability integer := 0;
  v_reset_day date;
  v_event_key text;
  v_claimed boolean := false;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(reliability_score, 100)
  into v_reliability
  from public.profiles
  where id = v_user;

  if v_reliability <= 90 then
    return false;
  end if;

  v_reset_day := date(timezone('America/Los_Angeles', now() - interval '3 hours'));
  v_event_key := 'daily_login:' || v_reset_day::text;

  v_claimed := public.grant_xp_once(v_user, v_event_key, 5);

  if v_claimed then
    update public.profiles
    set last_login_bonus_at = now()
    where id = v_user;
  end if;

  return v_claimed;
end;
$$;

grant execute on function public.grant_xp_once(uuid, text, integer) to authenticated;
grant execute on function public.claim_daily_login_bonus() to authenticated;
