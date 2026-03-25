-- Patch the host-per-day rule so it limits by the day the games TAKE PLACE,
-- not the day they were created.

create or replace function public.enforce_host_game_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_occurrence_la_day date;
  v_daily_count integer;
  v_overlap_exists boolean;
begin
  v_start := coalesce(new.starts_at, new.date_time, new.created_at, now());
  v_end := v_start + make_interval(mins => coalesce(new.duration, 90));
  v_occurrence_la_day := date(timezone('America/Los_Angeles', v_start));

  if tg_op = 'INSERT' then
    select count(*)
    into v_daily_count
    from public.games g
    where g.host_id = new.host_id
      and date(timezone('America/Los_Angeles', coalesce(g.starts_at, g.date_time, g.created_at, now()))) = v_occurrence_la_day;

    if v_daily_count >= 2 then
      raise exception 'You can only host 2 games taking place on the same day';
    end if;
  end if;

  if coalesce(new.status, 'scheduled') in ('scheduled', 'live') then
    select exists (
      select 1
      from public.games g
      where g.host_id = new.host_id
        and g.id <> coalesce(new.id, gen_random_uuid())
        and coalesce(g.status, 'scheduled') in ('scheduled', 'live')
        and tstzrange(
              coalesce(g.starts_at, g.date_time, g.created_at, now()),
              coalesce(g.starts_at, g.date_time, g.created_at, now())
                + make_interval(mins => coalesce(g.duration, 90)),
              '[)'
            )
            &&
            tstzrange(v_start, v_end, '[)')
    )
    into v_overlap_exists;

    if v_overlap_exists then
      raise exception 'You cannot host overlapping games';
    end if;
  end if;

  return new;
end;
$function$;
