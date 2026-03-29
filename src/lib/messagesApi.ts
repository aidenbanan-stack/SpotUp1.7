import { supabase } from '@/lib/supabaseClient';
import { createNotification } from '@/lib/notificationsApi';

export type Conversation = {
  id: string;
  createdAt: Date;
  otherUserId: string;
  otherUsername: string;
  otherPhotoUrl: string;
  lastMessage?: { body: string; createdAt: Date; senderId?: string };
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type: 'text' | 'game_invite';
  meta?: any;
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

function normalizePair(a: string, b: string): { user1: string; user2: string } {
  return a < b ? { user1: a, user2: b } : { user1: b, user2: a };
}

function isDuplicateishError(error: any) {
  const msg = String(error?.message ?? '').toLowerCase();
  const code = String(error?.code ?? '');
  return (
    code === '23505' ||
    code === '409' ||
    msg.includes('duplicate') ||
    msg.includes('unique') ||
    msg.includes('already exists') ||
    msg.includes('conflict')
  );
}

function isRlsLikeError(error: any) {
  const msg = String(error?.message ?? '').toLowerCase();
  return (
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('not allowed')
  );
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

  const { data: profs1, error: err1 } = await supabase
    .from('profiles')
    .select('id,username,profile_photo_url,bio,email')
    .in('id', uniqueIds);

  if (!err1 && Array.isArray(profs1)) {
    for (const p of profs1 as any[]) upsertRow(p.id, p);
  }

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

  for (const id of uniqueIds) {
    if (!byId[id]) {
      byId[id] = { username: 'player', profile_photo_url: cleanPhoto(''), bio: '' };
    }
  }

  return byId;
}

async function findSharedConversationId(meId: string, otherUserId: string): Promise<string | null> {
  const { data: myMemberships, error: memErr } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', meId);

  if (memErr || !Array.isArray(myMemberships) || myMemberships.length === 0) {
    return null;
  }

  const candidateIds = Array.from(
    new Set(myMemberships.map((row: any) => row.conversation_id).filter((id: any) => typeof id === 'string' && id.length > 0))
  );
  if (!candidateIds.length) return null;

  const { data: shared, error: sharedErr } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', otherUserId)
    .in('conversation_id', candidateIds)
    .limit(1);

  if (sharedErr || !Array.isArray(shared) || shared.length === 0) {
    return null;
  }

  return String(shared[0].conversation_id);
}

async function ensureConversationMembers(conversationId: string, meId: string, otherUserId: string): Promise<void> {
  const rows = [
    { conversation_id: conversationId, user_id: meId },
    { conversation_id: conversationId, user_id: otherUserId },
  ];

  for (const row of rows) {
    const { error } = await supabase.from('conversation_members').upsert(row, {
      onConflict: 'conversation_id,user_id',
      ignoreDuplicates: true,
    });

    if (!error) continue;
    if (isDuplicateishError(error) || isRlsLikeError(error)) continue;
    throw error;
  }
}

async function getOrCreateConversationViaRpc(otherUserId: string): Promise<string | null> {
  try {
    const { data, error } = await (supabase as any).rpc('get_or_create_direct_conversation', {
      p_other_user_id: otherUserId,
    });

    if (error) {
      const msg = String(error?.message ?? '').toLowerCase();
      const code = String(error?.code ?? '');
      const missingFunction = code === '42883' || msg.includes('function') || msg.includes('does not exist');
      if (!missingFunction) {
        console.warn('[Messages] get_or_create_direct_conversation RPC failed:', error);
      }
      return null;
    }

    if (typeof data === 'string' && data.length > 0) return data;
    return null;
  } catch (error) {
    console.warn('[Messages] RPC conversation creation threw:', error);
    return null;
  }
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

  if (!error) {
    try {
      await createNotification({
        userId: toUserId,
        type: 'message_request',
        relatedUserId: me.id,
        message: 'New message request',
      });
    } catch {
      // ignore
    }
    return;
  }

  if (isDuplicateishError(error)) return;
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

  const conversationId = await getOrCreateConversationWithUser(req.from_user_id);

  const { error: uErr } = await supabase.from('message_requests').update({ status: 'accepted' }).eq('id', requestId);
  if (uErr) throw uErr;

  const first = (req.initial_message ?? '').trim();
  if (first) {
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: req.from_user_id,
      body: first,
      type: 'text',
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

  let conversationIds = Array.from(new Set((mems ?? []).map((r: any) => r.conversation_id).filter(Boolean)));

  if (memErr || !conversationIds.length) {
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('id,user1_id,user2_id,created_at')
      .or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`)
      .order('created_at', { ascending: true });

    if (convErr && !conversationIds.length) throw convErr;

    if (Array.isArray(convs) && convs.length) {
      conversationIds = Array.from(new Set(convs.map((r: any) => r.id)));
    }
  }

  if (!conversationIds.length) return [];

  let otherByConv: Record<string, string> = {};

  const { data: members, error: allMemErr } = await supabase
    .from('conversation_members')
    .select('conversation_id,user_id')
    .in('conversation_id', conversationIds);

  if (!allMemErr && Array.isArray(members) && members.length) {
    (members ?? []).forEach((r: any) => {
      if (r.user_id !== me.id) otherByConv[r.conversation_id] = r.user_id;
    });
  }

  const missingOtherConversationIds = conversationIds.filter((id) => !otherByConv[id]);
  if (missingOtherConversationIds.length > 0) {
    const { data: convs2, error: convErr2 } = await supabase
      .from('conversations')
      .select('id,user1_id,user2_id,created_at')
      .in('id', missingOtherConversationIds);

    if (!convErr2 && Array.isArray(convs2)) {
      for (const row of convs2 as any[]) {
        const otherId = row.user1_id === me.id ? row.user2_id : row.user1_id;
        if (otherId) otherByConv[row.id] = otherId;
      }
    }
  }

  const otherIds = Array.from(
    new Set(Object.values(otherByConv).filter((v): v is string => typeof v === 'string' && v.length > 0))
  );

  const byId = await fetchPublicProfiles(otherIds);

  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select('conversation_id,body,created_at,sender_id')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(500);

  if (msgErr) throw msgErr;

  const lastByConv: Record<string, any> = {};
  (msgs ?? []).forEach((m: any) => {
    if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
  });

  return conversationIds
    .map((id) => {
      const otherId = otherByConv[id];
      if (!otherId) return null;

      const p = byId[otherId] ?? { username: 'player', profile_photo_url: cleanPhoto('') };
      const last = lastByConv[id];

      return {
        id,
        createdAt: new Date(),
        otherUserId: otherId,
        otherUsername: p.username || 'player',
        otherPhotoUrl: p.profile_photo_url || cleanPhoto(''),
        lastMessage: last
          ? { body: last.body ?? '', createdAt: new Date(last.created_at), senderId: last.sender_id ?? undefined }
          : undefined,
      } as Conversation;
    })
    .filter(Boolean) as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id,conversation_id,sender_id,body,type,meta,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    body: r.body,
    type: (r.type ?? 'text') as 'text' | 'game_invite',
    meta: r.meta ?? undefined,
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
    type: 'text',
  });

  if (error) throw error;
}

export async function sendGameInvite(conversationId: string, gameId: string, note?: string): Promise<void> {
  const me = await requireMe();
  const body = (note ?? '').trim();

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: me.id,
    body,
    type: 'game_invite',
    meta: { game_id: gameId },
  });

  if (error) throw error;
}

export async function sendGameInviteToUser(otherUserId: string, gameId: string, note?: string): Promise<void> {
  const me = await requireMe();
  const conversationId = await getOrCreateConversationWithUser(otherUserId);
  await sendGameInvite(conversationId, gameId, note);

  try {
    await createNotification({
      userId: otherUserId,
      type: 'game_invite',
      relatedUserId: me.id,
      relatedGameId: gameId,
      message: 'New game invite',
    });
  } catch {
    // ignore
  }
}

export async function getOrCreateConversationWithUser(otherUserId: string): Promise<string> {
  const me = await requireMe();
  if (!otherUserId) throw new Error('Missing recipient.');
  if (otherUserId === me.id) throw new Error('You cannot start a chat with yourself.');

  const rpcConversationId = await getOrCreateConversationViaRpc(otherUserId);
  if (rpcConversationId) return rpcConversationId;

  const sharedConversationId = await findSharedConversationId(me.id, otherUserId);
  if (sharedConversationId) {
    try {
      await ensureConversationMembers(sharedConversationId, me.id, otherUserId);
    } catch {
      // non-fatal
    }
    return sharedConversationId;
  }

  const { user1, user2 } = normalizePair(me.id, otherUserId);

  const { data: existingRows, error: findErr } = await supabase
    .from('conversations')
    .select('id,created_at')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .order('created_at', { ascending: true });

  if (findErr && !isRlsLikeError(findErr)) throw findErr;

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    const conversationId = String(existingRows[0].id);
    try {
      await ensureConversationMembers(conversationId, me.id, otherUserId);
    } catch {
      // non-fatal
    }
    return conversationId;
  }

  const { data: insertedRow, error: insertErr } = await supabase
    .from('conversations')
    .insert({ user1_id: user1, user2_id: user2 })
    .select('id')
    .single();

  if (!insertErr && insertedRow?.id) {
    const conversationId = String(insertedRow.id);
    try {
      await ensureConversationMembers(conversationId, me.id, otherUserId);
    } catch {
      // non-fatal
    }
    return conversationId;
  }

  if (insertErr && !isDuplicateishError(insertErr) && !isRlsLikeError(insertErr)) {
    throw insertErr;
  }

  const sharedAfterInsert = await findSharedConversationId(me.id, otherUserId);
  if (sharedAfterInsert) return sharedAfterInsert;

  const { data: againRows, error: againErr } = await supabase
    .from('conversations')
    .select('id,created_at')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .order('created_at', { ascending: true });

  if (againErr) throw againErr;
  if (Array.isArray(againRows) && againRows.length > 0) {
    const conversationId = String(againRows[0].id);
    try {
      await ensureConversationMembers(conversationId, me.id, otherUserId);
    } catch {
      // non-fatal
    }
    return conversationId;
  }

  throw new Error('Failed to start chat. Please run the latest messaging SQL patch.');
}
