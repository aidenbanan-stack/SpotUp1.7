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

async function requireMe() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not signed in.');
  return data.user;
}

function newConversationId(): string {
  const c: any = globalThis.crypto as any;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanUsername(u: any, email?: any) {
  const s = typeof u === 'string' ? u.trim() : '';
  if (s) return s;
  const em = typeof email === 'string' ? email.trim() : '';
  if (em && em.includes('@')) return em.split('@')[0];
  return 'player';
}

function cleanPhoto(url: any) {
  const s = typeof url === 'string' ? url.trim() : '';
  if (s) return s;
  return 'https://api.dicebear.com/7.x/avataaars/svg?seed=spotup';
}

/**
 * Fetch public profile info for a set of user IDs.
 * This is designed to work even when:
 * - profiles select succeeds but returns null fields
 * - RLS blocks reading other users
 * It will try direct select first, then call RPC for any missing users or missing fields.
 */
async function fetchPublicProfiles(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.length > 0)));
  const byId: Record<string, { username: string; profile_photo_url: string; bio?: string }> = {};
  if (!uniqueIds.length) return byId;

  const upsertRow = (keyId: string, row: any) => {
    byId[keyId] = {
      username: cleanUsername(row?.username, row?.email),
      profile_photo_url: cleanPhoto(row?.profile_photo_url),
      bio: typeof row?.bio === 'string' ? row.bio : '',
    };
  };

  // 1) Try direct select by id (common schema: profiles.id = auth.users.id)
  const { data: profs1, error: err1 } = await supabase
    .from('profiles')
    .select('id,username,profile_photo_url,bio,email')
    .in('id', uniqueIds);

  if (!err1 && Array.isArray(profs1)) {
    for (const p of profs1 as any[]) upsertRow(p.id, p);
  }

  // 2) If some IDs not found, try alternate schema: profiles.user_id = auth.users.id
  const notFoundAfterIdSelect = uniqueIds.filter((id) => !byId[id]);
  if (notFoundAfterIdSelect.length > 0) {
    const { data: profs2, error: err2 } = await supabase
      .from('profiles')
      .select('user_id,username,profile_photo_url,bio,email')
      .in('user_id', notFoundAfterIdSelect);

    if (!err2 && Array.isArray(profs2)) {
      for (const p of profs2 as any[]) upsertRow(p.user_id, p);
    }
  }

  // 3) For anything still missing, call RPC (works even when RLS blocks or schema differs)
  const stillMissing = uniqueIds.filter((id) => !byId[id]);
  if (stillMissing.length > 0) {
    const { data: rpcRows, error: rpcErr } = await (supabase as any).rpc('get_public_profiles', {
      p_user_ids: stillMissing,
    });

    if (!rpcErr && Array.isArray(rpcRows)) {
      for (const p of rpcRows as any[]) upsertRow(p.id, p);
    } else {
      if (rpcErr) console.warn('[Messages] get_public_profiles failed:', rpcErr);
    }
  }

  // 4) Final defaults so UI never breaks
  for (const id of uniqueIds) {
    if (!byId[id]) {
      byId[id] = { username: 'player', profile_photo_url: cleanPhoto(''), bio: '' };
    }
  }

  return byId;
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

  const fromIds = Array.from(new Set(rows.map((r) => r.from_user_id).filter(Boolean)));
  const byId = await fetchPublicProfiles(fromIds);

  return rows.map((r) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    status: r.status,
    initialMessage: r.initial_message ?? '',
    createdAt: new Date(r.created_at),
    fromUsername: byId[r.from_user_id]?.username ?? 'player',
    fromPhotoUrl: byId[r.from_user_id]?.profile_photo_url ?? cleanPhoto(''),
  }));
}

export async function sendMessageRequest(toUserId: string, initialMessage: string): Promise<void> {
  const me = await requireMe();

  const { error } = await supabase.from('message_requests').insert({
    from_user_id: me.id,
    to_user_id: toUserId,
    status: 'pending',
    initial_message: initialMessage ?? '',
  });

  if (!error) return;

  const msg = (error as any)?.message ?? '';
  const code = (error as any)?.code ?? '';
  if (
    String(code) === '23505' ||
    msg.toLowerCase().includes('duplicate') ||
    msg.toLowerCase().includes('unique') ||
    msg.toLowerCase().includes('already exists')
  ) {
    return;
  }

  throw error;
}

export async function acceptMessageRequest(requestId: string): Promise<string> {
  const me = await requireMe();

  const { data: req, error: rErr } = await supabase
    .from('message_requests')
    .select('id,from_user_id,to_user_id,initial_message,status')
    .eq('id', requestId)
    .maybeSingle();

  if (rErr) throw rErr;
  if (!req) throw new Error('Request not found.');
  if (req.to_user_id !== me.id) throw new Error('Not allowed.');
  if (req.status !== 'pending') throw new Error('Request is not pending.');

  const conversationId = newConversationId();

  const { error: cErr } = await supabase.from('conversations').insert({ id: conversationId });
  if (cErr) throw cErr;

  const { error: m1Err } = await supabase.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: me.id,
  });
  if (m1Err) throw m1Err;

  const { error: m2Err } = await supabase.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: req.from_user_id,
  });
  if (m2Err) throw m2Err;

  const { error: uErr } = await supabase.from('message_requests').update({ status: 'accepted' }).eq('id', requestId);
  if (uErr) throw uErr;

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

  const { error } = await supabase.from('message_requests').update({ status: 'rejected' }).eq('id', requestId);
  if (error) throw error;
}

export async function fetchMyConversations(): Promise<Conversation[]> {
  const me = await requireMe();

  const { data: mems, error: memErr } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', me.id);

  if (memErr) throw memErr;
  const conversationIds = Array.from(new Set((mems ?? []).map((r: any) => r.conversation_id)));
  if (!conversationIds.length) return [];

  const { data: members, error: allMemErr } = await supabase
    .from('conversation_members')
    .select('conversation_id,user_id')
    .in('conversation_id', conversationIds);

  if (allMemErr) throw allMemErr;

  const otherByConv: Record<string, string> = {};
  (members ?? []).forEach((r: any) => {
    if (r.user_id !== me.id) otherByConv[r.conversation_id] = r.user_id;
  });

  const otherIds = Array.from(
    new Set(Object.values(otherByConv).filter((v): v is string => typeof v === 'string' && v.length > 0))
  );

  const byId = await fetchPublicProfiles(otherIds);

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
    const p = (otherId && byId[otherId]) ? byId[otherId] : { username: 'player', profile_photo_url: cleanPhoto('') };
    const last = lastByConv[id];

    return {
      id,
      createdAt: new Date(),
      otherUserId: otherId,
      otherUsername: p.username || 'player',
      otherPhotoUrl: p.profile_photo_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=spotup',
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

  const conversationId = newConversationId();

  const { error: cErr } = await supabase.from('conversations').insert({ id: conversationId });
  if (cErr) throw cErr;

  const { error: m1Err } = await supabase.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: me.id,
  });
  if (m1Err) throw m1Err;

  const { error: m2Err } = await supabase.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: otherUserId,
  });
  if (m2Err) throw m2Err;

  return conversationId;
}
