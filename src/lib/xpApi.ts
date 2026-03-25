import { supabase } from '@/lib/supabaseClient';

export type XpEventType = 'host_game' | 'check_in' | 'received_vote';

export async function awardXp(_eventType: XpEventType, _gameId?: string | null): Promise<number | null> {
  return null;
}

export async function awardReceivedVotes(
  _gameId: string,
  _votes: { category: string; votedUserId: string }[]
): Promise<void> {
  return;
}

export async function refreshDailyBonus(): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_daily_login_bonus');
  if (error) throw error;
  return Boolean(data);
}
