import { supabase } from '@/lib/supabaseClient';
import { fetchProfilesByIds } from '@/lib/profileApi';
import type { User } from '@/types';
import { createNotification } from '@/lib/notificationsApi';

export async function sendFriendRequest(toUserId: string): Promise<void> {
  // Prefer RPC (uses auth.uid() on the server). Fall back to direct insert for projects
  // that haven't installed the SQL functions yet.
  const { error: rpcErr } = await supabase.rpc('send_friend_request', { p_to_user: toUserId });
  if (!rpcErr) {
    // Best-effort notify recipient.
    try {
      const { data } = await supabase.auth.getUser();
      const me = data.user;
      if (me) {
        await createNotification({
          userId: toUserId,
          type: 'friend_request',
          relatedUserId: me.id,
          message: 'New friend request',
        });
      }
    } catch {
      // ignore
    }
    return;
  }

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  // Idempotent: if there's already a pending request between these users, treat as success.
  const { error } = await supabase
    .from('friend_requests')
    .upsert(
      {
        user_id: me.id,
        friend_id: toUserId,
        status: 'pending',
      },
      { onConflict: 'user_id,friend_id' }
    );

  if (error) {
    // If this fails due to unique constraints in the opposite direction, treat as success.
    const msg = (error as any)?.message ?? '';
    if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) return;
    throw error;
  }

  // Best-effort notify recipient.
  try {
    await createNotification({
      userId: toUserId,
      type: 'friend_request',
      relatedUserId: me.id,
      message: 'New friend request',
    });
  } catch {
    // ignore
  }
}

export async function acceptFriendRequest(fromUserId: string): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('accept_friend_request', { p_from_user: fromUserId });
  if (!rpcErr) return;

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  // Fall back: mark the request accepted in either direction.
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .or(
      `and(user_id.eq.${fromUserId},friend_id.eq.${me.id}),and(user_id.eq.${me.id},friend_id.eq.${fromUserId})`
    );
  if (error) throw error;
}

export async function rejectFriendRequest(fromUserId: string): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('reject_friend_request', { p_from_user: fromUserId });
  if (!rpcErr) return;

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .or(
      `and(user_id.eq.${fromUserId},friend_id.eq.${me.id}),and(user_id.eq.${me.id},friend_id.eq.${fromUserId})`
    );
  if (error) throw error;
}

type FriendRequestRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: string;
};

export type IncomingFriendRequest = {
  id: string;
  fromUserId: string;
  createdAt?: string;
};

/**
 * Incoming pending friend requests for the signed-in user.
 */
export async function fetchMyIncomingFriendRequests(): Promise<IncomingFriendRequest[]> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('friend_requests')
    .select('id,user_id,friend_id,status,created_at')
    .eq('status', 'pending')
    .eq('friend_id', me.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as FriendRequestRow[];
  return rows.map((r) => ({ id: r.id, fromUserId: r.user_id, createdAt: r.created_at }));
}

/**
 * Returns the user ids of all accepted friends for the signed-in user.
 * Requires: public.friend_requests(from_user_id uuid, to_user_id uuid, status text)
 */
export async function fetchMyFriendIds(): Promise<string[]> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

 const { data, error } = await supabase
    .from('friend_requests')
    .select('id,user_id,friend_id,status')
    .eq('status', 'accepted')
    .or(`user_id.eq.${me.id},friend_id.eq.${me.id}`);


  if (error) throw error;
  const rows = (data ?? []) as FriendRequestRow[];

    const friendIds = rows
    .map((r: any) => (r.user_id === me.id ? r.friend_id : r.user_id))
    .filter((id: string) => id && id !== me.id);

  return Array.from(new Set(friendIds));
}

/**
 * Returns profile-shaped Users for all accepted friends.
 */
export async function fetchMyFriends(): Promise<User[]> {
  const ids = await fetchMyFriendIds();
  return fetchProfilesByIds(ids);
}
