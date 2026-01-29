import { supabase } from '@/lib/supabaseClient';

/**
 * Sends a friend request to another user.
 * Requires a Supabase RPC function: public.send_friend_request(p_to_user uuid)
 */
export async function sendFriendRequest(toUserId: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', { p_to_user: toUserId });
  if (error) throw error;
}
