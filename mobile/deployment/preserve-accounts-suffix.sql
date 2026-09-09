-- Preserve identity; do not carry over games, squads, XP, or inferred reliability.
alter table public.profiles add column legacy_avatar_url text;
insert into public.profiles(id,name,bio,city,sports,legacy_avatar_url,created_at)
select u.id,left(coalesce(nullif(trim(p.username),''),nullif(trim(u.raw_user_meta_data->>'name'),''),'Player'),60),
 left(coalesce(p.bio,''),500),left(coalesce(p.city,''),120),
 coalesce((select array_agg(distinct s.id) from unnest(array[p.primary_sport] || coalesce(p.secondary_sports,'{}')) v
 join public.sports s on s.id=case lower(v) when 'frisbee' then 'ultimate' when 'football' then 'flag-football' else lower(v) end),'{}'),
 case when p.profile_photo_url like 'https://qzssyfzfrghvmgggzplc.supabase.co/storage/v1/object/public/avatars/%' then p.profile_photo_url else null end,
 coalesce(p.created_at,u.created_at,now())
from auth.users u left join spotup_legacy.profiles p on p.id=u.id;
insert into public.notification_preferences(user_id) select id from public.profiles;
-- Carry over the existing moderator identity; no new user gains admin access.
insert into public.admins(user_id) select id from public.profiles where spotup_legacy.is_admin(id);
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
-- Existing project dashboard already exposes public; no custom API override is needed.
notify pgrst, 'reload schema';
do $$begin
 if (select count(*) from auth.users)<>(select count(*) from public.profiles) then
  raise exception 'Account preservation check failed';
 end if;
 if exists(select 1 from public.games) or exists(select 1 from public.squads) then
  raise exception 'Fresh game and squad state check failed';
 end if;
end$$;
