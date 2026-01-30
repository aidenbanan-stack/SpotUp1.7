import { supabase } from '@/lib/supabaseClient';
import { fetchProfilesByIds } from '@/lib/profileApi';
import type { User } from '@/types';

export async function sendFriendRequest(toUserId: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', { p_to_user: toUserId });
  if (error) throw error;
}

export async function acceptFriendRequest(fromUserId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', { p_from_user: fromUserId });
  if (error) throw error;
}

export async function rejectFriendRequest(fromUserId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_friend_request', { p_from_user: fromUserId });
  if (error) throw error;
}

type FriendRequestRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: string;
};

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
