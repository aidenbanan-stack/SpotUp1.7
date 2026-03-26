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
  wins?: number;
  losses?: number;
  points?: number;
  rating?: number;
  home_area?: string | null;
};

export type SquadWithMeta = SquadRow & {
  member_count: number;
  is_owner: boolean;
};

export type SquadDiscoverRow = SquadRow & {
  member_count: number;
  is_member: boolean;
  can_join: boolean;
  is_nearby: boolean;
};

export type SquadMemberProfile = {
  squad_id: string;
  user_id: string;
  role: string;
  username: string | null;
  xp: number;
  level: number;
};

export type SquadLeaderboardRow = {
  squad_id: string;
  name: string;
  sport: Sport | null;
  member_count: number;
  total_xp: number;
  wins: number;
  losses: number;
  points: number;
  rating: number;
  win_pct: number;
  home_area: string | null;
  created_at: string;
};

function rowToLeaderboard(row: any): SquadLeaderboardRow {
  const wins = Number(row.wins ?? 0);
  const losses = Number(row.losses ?? 0);
  const totalGames = wins + losses;
  return {
    squad_id: row.squad_id ?? row.id,
    name: row.name,
    sport: row.sport ?? null,
    member_count: Number(row.member_count ?? 0),
    total_xp: Number(row.total_xp ?? 0),
    wins,
    losses,
    points: Number(row.points ?? 0),
    rating: Number(row.rating ?? 1000),
    win_pct: totalGames > 0 ? wins / totalGames : 0,
    home_area: row.home_area ?? null,
    created_at: row.created_at,
  };
}

export async function fetchMySquads(userId: string): Promise<SquadWithMeta[]> {
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

export async function createSquad(args: {
  userId: string;
  name: string;
  sport: Sport | null;
  homeArea?: string | null;
  minXpRequired?: number;
}): Promise<SquadRow> {
  const { data, error } = await supabase.rpc('create_squad_secure', {
    p_name: args.name.trim(),
    p_sport: args.sport,
    p_home_area: args.homeArea?.trim() || null,
    p_min_xp_required: Math.max(0, Math.floor(args.minXpRequired ?? 0)),
  });

  if (error) throw error;

  const squadId = typeof data === 'string' ? data : data?.id ?? data;
  if (!squadId) throw new Error('Could not create squad');
  return fetchSquadById(String(squadId));
}

export async function searchSquads(args: {
  userId: string;
  query?: string;
  limit?: number;
}): Promise<SquadDiscoverRow[]> {
  const { data, error } = await supabase.rpc('search_squads', {
    p_query: args.query?.trim() || null,
  });

  if (error) throw error;

  const rows = ((data ?? []) as any[]).slice(0, args.limit ?? 30);
  const { data: myMemberships } = await supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', args.userId);

  const memberSet = new Set((myMemberships ?? []).map((m: any) => m.squad_id as string));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sport: row.sport ?? null,
    owner_id: row.owner_id ?? null,
    invite_code: row.invite_code,
    created_at: row.created_at,
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    points: Number(row.points ?? 0),
    rating: Number(row.rating ?? 1000),
    home_area: row.home_area ?? null,
    min_xp_required: Number(row.min_xp_required ?? 0),
    member_limit: Number(row.member_limit ?? 10),
    member_count: Number(row.member_count ?? 0),
    is_nearby: Boolean(row.is_nearby),
    is_member: memberSet.has(row.id),
    can_join: !memberSet.has(row.id),
  }));
}

export async function joinSquadById(args: { squadId: string }): Promise<SquadRow> {
  const { data, error } = await supabase.rpc('join_squad_secure', {
    p_squad_id: args.squadId,
  });

  if (error) throw error;
  const squadId = typeof data === 'string' ? data : data?.id ?? args.squadId;
  return fetchSquadById(String(squadId));
}

export async function leaveSquadById(args: { squadId: string }): Promise<void> {
  const { error } = await supabase.rpc('leave_squad_secure', {
    p_squad_id: args.squadId,
  });
  if (error) throw error;
}

export async function deleteSquadById(args: { squadId: string }): Promise<void> {
  const { error } = await supabase.rpc('delete_squad_secure', {
    p_squad_id: args.squadId,
  });
  if (error) throw error;
}

export async function fetchSquadById(squadId: string): Promise<SquadRow> {
  const { data, error } = await supabase.from('squads').select('*').eq('id', squadId).single();
  if (error) throw error;
  return data as SquadRow;
}

export async function fetchSquadMembers(squadId: string): Promise<SquadMemberProfile[]> {
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

export async function fetchSquadLeaderboard(limit = 50): Promise<SquadLeaderboardRow[]> {
  const { data, error } = await supabase
    .from('squad_competitive_leaderboard')
    .select('*')
    .order('rating', { ascending: false })
    .order('points', { ascending: false })
    .limit(limit);

  if (!error) return (data ?? []).map(rowToLeaderboard);

  const { data: squads, error: sErr } = await supabase.from('squads').select('*').order('created_at', { ascending: false }).limit(limit);
  if (sErr) throw sErr;

  const out: SquadLeaderboardRow[] = [];
  for (const s of squads ?? []) {
    try {
      const members = await fetchSquadMembers((s as any).id);
      out.push(rowToLeaderboard({
        squad_id: (s as any).id,
        name: (s as any).name,
        sport: (s as any).sport ?? null,
        member_count: members.length,
        total_xp: members.reduce((sum, m) => sum + (m.xp ?? 0), 0),
        wins: (s as any).wins ?? 0,
        losses: (s as any).losses ?? 0,
        points: (s as any).points ?? 0,
        rating: (s as any).rating ?? 1000,
        home_area: (s as any).home_area ?? null,
        created_at: (s as any).created_at,
      }));
    } catch {
      // ignore
    }
  }
  out.sort((a, b) => (b.rating - a.rating) || (b.points - a.points) || (b.total_xp - a.total_xp));
  return out;
}
