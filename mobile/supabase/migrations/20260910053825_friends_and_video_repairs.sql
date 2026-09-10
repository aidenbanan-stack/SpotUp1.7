-- Mutual friendships are separate from creator follows.
create table public.friendships (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references public.profiles on delete cascade,
 recipient_id uuid not null references public.profiles on delete cascade,
 state text not null default 'pending' check(state in ('pending','accepted','declined')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(requester_id<>recipient_id)
);
create unique index friendships_pair on public.friendships(least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index friendships_recipient on public.friendships(recipient_id,state);
create index friendships_sender on public.friendships(requester_id,created_at);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon,authenticated;
grant select on public.friendships to authenticated;
grant all on public.friendships to service_role;
create policy friendships_read on public.friendships for select to authenticated using(
 public.session_active() and auth.uid() in(requester_id,recipient_id) and not public.blocked(requester_id,recipient_id));
create function public.are_friends(other uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.session_active() and not public.blocked(auth.uid(),other) and exists(select 1 from friendships where state='accepted' and ((requester_id=auth.uid() and recipient_id=other) or (recipient_id=auth.uid() and requester_id=other)))
$$;
revoke all on function public.are_friends(uuid) from public,anon;
grant execute on function public.are_friends(uuid) to authenticated;
create function public.friend_action(action text,target uuid) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=require_user(); f friendships;
begin
 if u=target or not exists(select 1 from profiles where id=target and not disabled) or blocked(u,target) then raise exception 'Player unavailable';end if;
 perform pg_advisory_xact_lock(hashtext(least(u,target)::text||greatest(u,target)::text));
 select * into f from friendships where least(requester_id,recipient_id)=least(u,target) and greatest(requester_id,recipient_id)=greatest(u,target) for update;
 if action='request' then
  if f.state in ('pending','accepted') then raise exception 'A connection already exists';end if;
  if not exists(select 1 from profiles where id=target and audience_ok(id,interactions_policy)) then raise exception 'This player is not accepting requests';end if;
  if f.updated_at>now()-interval '1 day' then raise exception 'Wait a day before sending another request';end if;
  if (select count(*) from friendships where requester_id=u and updated_at>now()-interval '1 day')>=20 then raise exception 'Daily friend request limit reached';end if;
  if f.id is null then insert into friendships(requester_id,recipient_id) values(u,target);
  else update friendships set requester_id=u,recipient_id=target,state='pending',updated_at=now() where id=f.id;end if;
  insert into notifications(user_id,title,body,path) values(target,'Friend request','A player wants to connect with you.','/friends');
 elsif action='accept' then
  if f.state<>'pending' or f.recipient_id<>u or f.id is null then raise exception 'Request unavailable';end if;
  update friendships set state='accepted',updated_at=now() where id=f.id;
  insert into notifications(user_id,title,body,path) values(target,'Friend request accepted','You can now message each other and plan your next game.','/friends');
 elsif action in ('decline','cancel','remove') then
  if f.id is null or (action='decline' and f.recipient_id<>u) or (action='cancel' and f.requester_id<>u) then raise exception 'Request unavailable';end if;
  update friendships set state='declined',updated_at=now() where id=f.id;
 else raise exception 'Unknown friend action';end if;
end$$;
revoke all on function public.friend_action(text,uuid) from public,anon;
grant execute on function public.friend_action(text,uuid) to authenticated;

-- Reuse the existing message moderation, reporting and account erasure paths.
alter table public.messages add column recipient_id uuid references public.profiles;
alter table public.messages drop constraint messages_check;
alter table public.messages add constraint messages_one_destination check(num_nonnulls(game_id,squad_id,tournament_id,recipient_id)=1);
create index messages_direct_recipient on public.messages(recipient_id,created_at);
create policy direct_messages_read on public.messages for select to authenticated using(
 session_active() and not removed and recipient_id is not null and auth.uid() in(user_id,recipient_id)
 and not blocked(user_id,recipient_id));
create function public.send_direct_message(target uuid,body text) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=require_user();begin
 if not are_friends(target) or exists(select 1 from profiles where id=target and disabled) then raise exception 'Accept a friend request before messaging';end if;
 if length(trim(body)) not between 1 and 2000 then raise exception 'Write a message of 1–2000 characters';end if;
 if (select count(*) from messages where user_id=u and created_at>now()-interval '1 minute')>=10 then raise exception 'Please slow down';end if;
 insert into messages(user_id,recipient_id,body) values(u,target,trim(body));
end$$;
revoke all on function public.send_direct_message(uuid,text) from public,anon;
grant execute on function public.send_direct_message(uuid,text) to authenticated;
alter publication supabase_realtime add table public.friendships;

-- Browser recordings retain their real MIME type.
update storage.buckets set allowed_mime_types=array['video/mp4','video/quicktime','video/webm'] where id='videos';
-- Qualify the storage object's name, avoiding accidental binding to profiles.name.
alter policy avatar_read on storage.objects using(bucket_id='spotup-avatars' and exists(select 1 from public.profiles p where p.avatar_url=storage.objects.name and not public.blocked(auth.uid(),p.id)));
notify pgrst,'reload schema';
