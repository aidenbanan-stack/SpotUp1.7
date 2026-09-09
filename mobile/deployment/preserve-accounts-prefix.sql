-- Existing SpotUp1.7 cutover. User authorized clearing game/squad data while retaining accounts.
-- Keep the old schema as a private recovery archive, outside every client API.
-- Do not run this on a different project or re-run it after a successful cutover.
alter schema public rename to spotup_legacy;
revoke all on schema spotup_legacy from public, anon, authenticated;
revoke all on all tables in schema spotup_legacy from public, anon, authenticated;
revoke all on all sequences in schema spotup_legacy from public, anon, authenticated;
revoke all on all functions in schema spotup_legacy from public, anon, authenticated;
do $$declare r record;begin
 for r in select tablename from pg_tables where schemaname='spotup_legacy' loop
  execute format('alter table spotup_legacy.%I enable row level security',r.tablename);
 end loop;
 for r in select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='spotup_legacy' loop
  execute format('alter publication supabase_realtime drop table spotup_legacy.%I',r.tablename);
 end loop;
end$$;
create schema public authorization postgres;
grant usage on schema public to anon, authenticated, service_role;
set search_path = public, extensions;
-- New uploads use a separate private avatar bucket. Keep old public image URLs readable.
drop policy if exists "avatars insert own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;
