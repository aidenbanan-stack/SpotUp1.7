import { supabase } from '@/lib/supabaseClient';
import type { Sport } from '@/types';

export type SquadRow = {
  id: string;
  name: string;
  sport: Sport | null;
  owner_id: string | null;
  invite_code: string;
  created_at: string;
};

export type SquadWithMeta = SquadRow & {
  member_count: number;
  is_owner: boolean;
};

function makeInviteCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function fetchMySquads(userId: string): Promise<SquadWithMeta[]> {
  // Get squads where user is a member
  const { data: memberships, error: memErr } = await supabase
    .from('squad_members')
    .select('squad_id, role')
    .eq('user_id', userId);

  if (memErr) throw memErr;
  const squadIds = (memberships ?? []).map((m: any) => m.squad_id).filter(Boolean);
  if (squadIds.length === 0) return [];

  const { data: squads, error: sErr } = await supabase
    .from('squads')
    .select('*')
    .in('id', squadIds)
    .order('created_at', { ascending: false });

  if (sErr) throw sErr;

  // Member counts
  const { data: counts, error: cErr } = await supabase
    .from('squad_members')
    .select('squad_id')
    .in('squad_id', squadIds);

  if (cErr) throw cErr;

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    const sid = (row as any).squad_id as string;
    countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
  }

  const ownerSet = new Set(
    (memberships ?? [])
      .filter((m: any) => (m.role ?? '').toLowerCase() === 'owner')
      .map((m: any) => m.squad_id as string),
  );

  return (squads ?? []).map((s: any) => ({
    ...(s as SquadRow),
    member_count: countMap.get(s.id) ?? 1,
    is_owner: ownerSet.has(s.id),
  }));
}

export async function createSquad(args: { userId: string; name: string; sport: Sport | null }): Promise<SquadRow> {
  // Generate invite code and retry on collision a few times
  let lastErr: any = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = makeInviteCode(6);

    const { data: created, error: cErr } = await supabase
      .from('squads')
      .insert({
        name: args.name.trim(),
        sport: args.sport,
        owner_id: args.userId,
        invite_code,
      })
      .select('*')
      .single();

    if (!cErr && created) {
      // Add owner as member
      const { error: mErr } = await supabase.from('squad_members').insert({
        squad_id: created.id,
        user_id: args.userId,
        role: 'owner',
      });
      if (mErr) throw mErr;
      return created as SquadRow;
    }

    lastErr = cErr;
  }

  throw lastErr ?? new Error('Failed to create squad');
}

export async function joinSquadByCode(args: { userId: string; code: string }): Promise<SquadRow> {
  const code = args.code.trim().toUpperCase();
  const { data: squad, error: sErr } = await supabase
    .from('squads')
    .select('*')
    .eq('invite_code', code)
    .single();

  if (sErr) throw sErr;

  const { error: mErr } = await supabase.from('squad_members').insert({
    squad_id: (squad as any).id,
    user_id: args.userId,
    role: 'member',
  });

  if (mErr) {
    const msg = (mErr as any)?.message ?? '';
    const codePg = (mErr as any)?.code ?? '';
    const isDup =
      String(codePg) === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique');
    if (!isDup) throw mErr;
  }

  return squad as SquadRow;
}
