create function public.session_active() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and not disabled)$$;
revoke execute on function public.session_active() from public,anon;
grant execute on function public.session_active() to authenticated;
-- Restrictive policies close the lifetime of already-issued JWTs after deletion.
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('create policy active_session on public.%I as restrictive for all to authenticated using(public.session_active()) with check(public.session_active())',t);end loop;end$$;
create policy active_storage_session on storage.objects as restrictive for all to authenticated using(public.session_active()) with check(public.session_active());
create or replace function public.require_user() returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=auth.uid();begin if u is null or not session_active() then raise exception 'Please sign in with an active account';end if;perform pg_advisory_xact_lock(hashtext(u::text));return u;end$$;
create or replace function public.audience_ok(creator uuid,audience text) returns boolean language sql stable security definer set search_path=public as $$select session_active() and not blocked(auth.uid(),creator) and (creator=auth.uid() or audience='members' or (audience='followers' and is_following(creator)))$$;
