alter table public.games enable row level security;

create or replace function public.cleanup_stale_scheduled_games()
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  update public.profiles p
  set reliability_score = greatest(0, coalesce(p.reliability_score, 100) - 5)
  where p.id in (
    select distinct g.host_id
    from public.games g
    where g.status = 'scheduled'
      and g.date_time < now() - interval '30 minutes'
      and coalesce(array_length(g.player_ids, 1), 0) > 1
      and coalesce(array_length(g.checked_in_ids, 1), 0) = 0
      and coalesce(g.runs_started, false) = false
  );

  delete from public.games g
  where g.status = 'scheduled'
    and g.date_time < now() - interval '30 minutes'
    and coalesce(array_length(g.checked_in_ids, 1), 0) = 0
    and coalesce(g.runs_started, false) = false;
end;
$$;

grant execute on function public.cleanup_stale_scheduled_games() to authenticated;
