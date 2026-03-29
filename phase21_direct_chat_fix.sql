-- Phase 21: direct chat creation hardening
-- Run this in Supabase SQL Editor.

create unique index if not exists conversations_direct_pair_unique
  on public.conversations (user1_id, user2_id)
  where user1_id is not null and user2_id is not null;

create index if not exists conversation_members_user_conversation_idx
  on public.conversation_members (user_id, conversation_id);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_user1 uuid;
  v_user2 uuid;
  v_conversation_id uuid;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;

  if p_other_user_id is null then
    raise exception 'Missing recipient';
  end if;

  if p_other_user_id = v_me then
    raise exception 'Cannot chat with yourself';
  end if;

  v_user1 := least(v_me, p_other_user_id);
  v_user2 := greatest(v_me, p_other_user_id);

  select c.id
    into v_conversation_id
  from public.conversations c
  where c.user1_id = v_user1
    and c.user2_id = v_user2
  order by c.created_at asc, c.id asc
  limit 1;

  if v_conversation_id is null then
    select cm1.conversation_id
      into v_conversation_id
    from public.conversation_members cm1
    join public.conversation_members cm2
      on cm2.conversation_id = cm1.conversation_id
    where cm1.user_id = v_me
      and cm2.user_id = p_other_user_id
    order by cm1.created_at asc
    limit 1;
  end if;

  if v_conversation_id is null then
    insert into public.conversations (user1_id, user2_id)
    values (v_user1, v_user2)
    on conflict (user1_id, user2_id) where user1_id is not null and user2_id is not null do update
      set user1_id = excluded.user1_id
    returning id into v_conversation_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, v_me)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, p_other_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
