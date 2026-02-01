import { supabase } from '@/lib/supabaseClient';

export type XpEventType =
  | 'host_game'
  | 'join_game'
  | 'check_in'
  | 'finish_game'
  | 'postgame_vote'
  | 'received_vote';

/**
 * Awards XP for a single, idempotent event.
 * Requires SQL function `award_xp` (see `supabase_sql_updates.sql`).
 * If the function is not installed yet, this becomes a no-op.
 */
export async function awardXp(eventType: XpEventType, gameId?: string | null): Promise<number | null> {
  const { data, error } = await supabase
    .rpc('award_xp', { p_event_type: eventType, p_game_id: gameId ?? null })
    .maybeSingle();

  if (error) {
    // If the RPC isn't installed yet, don't break core UX.
    const msg = (error as any)?.message ?? '';
    if (msg.toLowerCase().includes('function') && msg.toLowerCase().includes('does not exist')) return null;
    throw error;
  }

  // Convention: return payload can be { xp: number } or a raw number.
  if (typeof data === 'number') return data;
  if (data && typeof (data as any).xp === 'number') return (data as any).xp;
  return null;
}
