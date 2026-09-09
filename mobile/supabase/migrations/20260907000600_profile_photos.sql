insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('spotup-avatars','spotup-avatars',false,5242880,array['image/jpeg','image/png']) on conflict(id) do nothing;
alter table profiles add constraint own_avatar_path check(avatar_url is null or split_part(avatar_url,'/',1)=id::text);
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='spotup-avatars' and split_part(name,'/',1)=auth.uid()::text);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='spotup-avatars' and exists(select 1 from profiles p where p.avatar_url=name and not blocked(auth.uid(),p.id)));
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='spotup-avatars' and split_part(name,'/',1)=auth.uid()::text);
