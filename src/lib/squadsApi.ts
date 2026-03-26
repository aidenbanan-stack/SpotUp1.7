import { supabase } from '@/lib/supabaseClient';
import type { Sport } from '@/types';

export type SquadRow = {
  id: string;
  name: string;
  sport: Sport | null;
  owner_id: string | null;
  invite_code: string;
  created_at: string;
  min_xp_required?: number;
  member_limit?: number;
};

export type SquadWithMeta = SquadRow & {
  member_count: number;
  is_owner: boolean;
};

export type SquadMemberProfile = {
  squad_id: string;
  user_id: string;
  role: string;
  username: string | null;
  xp: number;
  level: number;
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
    .select('id,name,sport,owner_id,invite_code,created_at,min_xp_required,member_limit')
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

export async function createSquad(args: { userId: string; name: string; sport: Sport | null; minXpRequired?: number }): Promise<SquadRow> {
  const { data, error } = await supabase
    .rpc('create_squad_secure', {
      p_name: args.name.trim(),
      p_sport: args.sport,
      p_min_xp_required: Math.max(0, Number(args.minXpRequired ?? 0)),
    })
    .single();

  if (error) throw error;
  return data as SquadRow;
}

export async function joinSquadByCode(args: { userId: string; code: string }): Promise<SquadRow> {
  const code = args.code.trim().toUpperCase();
  const { data, error } = await supabase.rpc('join_squad_by_code_secure', { p_code: code }).single();
  if (error) throw error;
  return data as SquadRow;
}

export async function fetchSquadById(squadId: string): Promise<SquadRow> {
  const { data, error } = await supabase.from('squads').select('id,name,sport,owner_id,invite_code,created_at,min_xp_required,member_limit').eq('id', squadId).single();
  if (error) throw error;
  return data as SquadRow;
}

export async function fetchSquadMembers(squadId: string): Promise<SquadMemberProfile[]> {
  // role + profile
  const { data, error } = await supabase
    .from('squad_members')
    .select('squad_id, user_id, role, profiles:profiles(id, username, xp)')
    .eq('squad_id', squadId);

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const p = row.profiles ?? null;
    const xp = typeof p?.xp === 'number' ? p.xp : Number(p?.xp ?? 0);
    return {
      squad_id: row.squad_id,
      user_id: row.user_id,
      role: row.role ?? 'member',
      username: p?.username ?? null,
      xp: Number.isFinite(xp) ? xp : 0,
      level: Math.max(1, Math.floor((Number.isFinite(xp) ? xp : 0) / 100) + 1),
    } as SquadMemberProfile;
  });
}

export type SquadLeaderboardRow = {
  squad_id: string;
  name: string;
  sport: Sport | null;
  member_count: number;
  total_xp: number;
  created_at: string;
};

export async function fetchSquadLeaderboard(limit = 50): Promise<SquadLeaderboardRow[]> {
  // Prefer a SQL view if present.
  const { data, error } = await supabase
    .from('squad_leaderboard')
    .select('*')
    .order('total_xp', { ascending: false })
    .limit(limit);
  if (!error) return (data ?? []) as SquadLeaderboardRow[];

  // Fallback: compute client-side (slower, but works if view not installed).
  const { data: squads, error: sErr } = await supabase.from('squads').select('*').order('created_at', { ascending: false }).limit(limit);
  if (sErr) throw sErr;
  const out: SquadLeaderboardRow[] = [];
  for (const s of squads ?? []) {
    try {
      const members = await fetchSquadMembers((s as any).id);
      out.push({
        squad_id: (s as any).id,
        name: (s as any).name,
        sport: (s as any).sport ?? null,
        member_count: members.length,
        total_xp: members.reduce((sum, m) => sum + (m.xp ?? 0), 0),
        created_at: (s as any).created_at,
      });
    } catch {
      // ignore
    }
  }
  out.sort((a, b) => b.total_xp - a.total_xp);
  return out;
}
