import { supabase } from '@/lib/supabaseClient';

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
