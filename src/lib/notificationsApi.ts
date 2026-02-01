import { supabase } from '@/lib/supabaseClient';
import type { Notification } from '@/types';

type NotificationRow = {
  id: string;
  user_id: string;
  type: Notification['type'];
  related_game_id: string | null;
  related_user_id: string | null;
  related_tournament_id: string | null;
  message: string;
  created_at: string;
  read: boolean;
};

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    relatedGameId: row.related_game_id ?? undefined,
    relatedUserId: row.related_user_id ?? undefined,
    relatedTournamentId: row.related_tournament_id ?? undefined,
    message: row.message,
    createdAt: new Date(row.created_at),
    read: Boolean(row.read),
  };
}

/**
 * Fetch current user's notifications.
 * Requires a table: public.notifications with RLS restricted to auth.uid().
 */
export async function fetchMyNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as NotificationRow[]).map(rowToNotification);
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Delete a notification (used after accepting/rejecting requests).
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}


/**
 * Delete ALL of the current user's notifications.
 * (RLS should restrict this to auth.uid().)
 */
export async function clearMyNotifications(): Promise<void> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', me.id);

  if (error) throw error;
}

/**
 * Delete only READ notifications.
 */
export async function clearMyReadNotifications(): Promise<void> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', me.id)
    .eq('read', true);

  if (error) throw error;
}
