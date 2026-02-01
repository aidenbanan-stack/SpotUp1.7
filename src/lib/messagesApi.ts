import { supabase } from '@/lib/supabaseClient';

export type Conversation = {
  id: string;
  createdAt: Date;
  otherUserId: string;
  otherUsername: string;
  otherPhotoUrl: string;
  lastMessage?: { body: string; createdAt: Date };
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

export type MessageRequest = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromPhotoUrl: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  initialMessage: string;
  createdAt: Date;
};

/**
 * Recommended Supabase tables (run in SQL editor):
 *
 * create table public.conversations (
 *   id uuid primary key default gen_random_uuid(),
 *   created_at timestamptz not null default now()
 * );
 *
 * create table public.conversation_members (
 *   conversation_id uuid references public.conversations(id) on delete cascade,
 *   user_id uuid references auth.users(id) on delete cascade,
 *   created_at timestamptz not null default now(),
 *   primary key (conversation_id, user_id)
 * );
 *
 * create table public.messages (
 *   id uuid primary key default gen_random_uuid(),
 *   conversation_id uuid references public.conversations(id) on delete cascade,
 *   sender_id uuid references auth.users(id) on delete cascade,
 *   body text not null,
 *   created_at timestamptz not null default now()
 * );
 *
 * create table public.message_requests (
 *   id uuid primary key default gen_random_uuid(),
 *   from_user_id uuid references auth.users(id) on delete cascade,
 *   to_user_id uuid references auth.users(id) on delete cascade,
 *   status text not null default 'pending',
 *   initial_message text not null default '',
 *   created_at timestamptz not null default now()
 * );
 *
 * RLS policies are required (see the instructions in my chat reply).
 */

async function requireMe() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not signed in.');
  return data.user;
}

export async function fetchMyMessageRequests(): Promise<MessageRequest[]> {
  const me = await requireMe();

  const { data, error } = await supabase
    .from('message_requests')
    .select('id,from_user_id,to_user_id,status,initial_message,created_at')
    .eq('to_user_id', me.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as any[];

  // Enrich from profiles
  const fromIds = Array.from(new Set(rows.map(r => r.from_user_id)));
  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select('id,username,profile_photo_url')
    .in('id', fromIds);

  if (pErr) throw pErr;
  const byId: Record<string, any> = {};
  (profs ?? []).forEach((p: any) => (byId[p.id] = p));

  return rows.map((r) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    status: r.status,
    initialMessage: r.initial_message ?? '',
    createdAt: new Date(r.created_at),
    fromUsername: byId[r.from_user_id]?.username ?? 'player',
    fromPhotoUrl: byId[r.from_user_id]?.profile_photo_url ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=spotup',
  }));
}

export async function sendMessageRequest(toUserId: string, initialMessage: string): Promise<void> {
  const me = await requireMe();

  const { error } = await supabase
    .from('message_requests')
    .insert({
      from_user_id: me.id,
      to_user_id: toUserId,
      status: 'pending',
      initial_message: initialMessage ?? '',
    });

  if (error) throw error;
}

export async function acceptMessageRequest(requestId: string): Promise<string> {
  const me = await requireMe();

  // Load request
  const { data: req, error: rErr } = await supabase
    .from('message_requests')
    .select('id,from_user_id,to_user_id,initial_message,status')
    .eq('id', requestId)
    .maybeSingle();

  if (rErr) throw rErr;
  if (!req) throw new Error('Request not found.');
  if (req.to_user_id !== me.id) throw new Error('Not allowed.');
  if (req.status !== 'pending') throw new Error('Request is not pending.');

  // Create conversation
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .insert({})
    .select('id')
    .single();

  if (cErr) throw cErr;

  const conversationId = conv.id as string;

// Add me first
const { error: m1Err } = await supabase.from('conversation_members').insert({
  conversation_id: conversationId,
  user_id: me.id,
});
if (m1Err) throw m1Err;

// Add the requester second
const { error: m2Err } = await supabase.from('conversation_members').insert({
  conversation_id: conversationId,
  user_id: req.from_user_id,
});
if (m2Err) throw m2Err;

  // Mark request accepted
  const { error: uErr } = await supabase
    .from('message_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  if (uErr) throw uErr;

  // Optional first message (from requester)
  const first = (req.initial_message ?? '').trim();
  if (first) {
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: req.from_user_id,
      body: first,
    });
    if (msgErr) throw msgErr;
  }

  return conversationId;
}

export async function rejectMessageRequest(requestId: string): Promise<void> {
  const me = await requireMe();

  const { data: req, error: rErr } = await supabase
    .from('message_requests')
    .select('id,to_user_id,status')
    .eq('id', requestId)
    .maybeSingle();

  if (rErr) throw rErr;
  if (!req) throw new Error('Request not found.');
  if (req.to_user_id !== me.id) throw new Error('Not allowed.');
  if (req.status !== 'pending') return;

  const { error } = await supabase
    .from('message_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId);

  if (error) throw error;
}

export async function fetchMyConversations(): Promise<Conversation[]> {
  const me = await requireMe();

  // Find conversations where I'm a member
  const { data: mems, error: memErr } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', me.id);

  if (memErr) throw memErr;
  const conversationIds = Array.from(new Set((mems ?? []).map((r: any) => r.conversation_id)));
  if (!conversationIds.length) return [];

  // For each conversation, find the other user
  const { data: members, error: allMemErr } = await supabase
    .from('conversation_members')
    .select('conversation_id,user_id')
    .in('conversation_id', conversationIds);

  if (allMemErr) throw allMemErr;

  const otherByConv: Record<string, string> = {};
  (members ?? []).forEach((r: any) => {
    if (r.user_id !== me.id) otherByConv[r.conversation_id] = r.user_id;
  });

  const otherIds = Array.from(new Set(Object.values(otherByConv)));
  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select('id,username,profile_photo_url')
    .in('id', otherIds);

  if (pErr) throw pErr;
  const byId: Record<string, any> = {};
  (profs ?? []).forEach((p: any) => (byId[p.id] = p));

  // Last message per conversation (simple: fetch recent messages)
  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select('conversation_id,body,created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (msgErr) throw msgErr;
  const lastByConv: Record<string, any> = {};
  (msgs ?? []).forEach((m: any) => {
    if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
  });

  return conversationIds.map((id) => {
    const otherId = otherByConv[id];
    const p = byId[otherId] ?? {};
    const last = lastByConv[id];

    return {
      id,
      createdAt: new Date(),
      otherUserId: otherId,
      otherUsername: p.username ?? 'player',
      otherPhotoUrl: p.profile_photo_url ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=spotup',
      lastMessage: last ? { body: last.body ?? '', createdAt: new Date(last.created_at) } : undefined,
    };
  });
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id,conversation_id,sender_id,body,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: new Date(r.created_at),
  }));
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const me = await requireMe();
  const text = body.trim();
  if (!text) return;

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: me.id,
    body: text,
  });

  if (error) throw error;
}

export async function createConversationWithUser(otherUserId: string): Promise<string> {
  const me = await requireMe();

  // Create conversation
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .insert({})
    .select('id')
    .single();

  if (cErr) throw cErr;

  const conversationId = conv.id as string;

  // Add both members
  const { error: mErr } = await supabase.from('conversation_members').insert([
    { conversation_id: conversationId, user_id: me.id },
    { conversation_id: conversationId, user_id: otherUserId },
  ]);
  if (mErr) throw mErr;

  return conversationId;
}
