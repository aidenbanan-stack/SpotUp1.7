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
  description?: string | null;
  visibility?: 'public' | 'request' | 'invite_only' | null;
  vibe?: 'casual' | 'competitive' | 'balanced' | null;
  weekly_goal?: number | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  home_court?: string | null;
  recruiting?: boolean | null;
  reliability_min?: number | null;
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

export type SquadFeedItem = {
  id: string;
  type: 'announcement' | 'match' | 'milestone' | 'member' | 'event' | 'rivalry';
  title: string;
  body: string;
  created_at: string;
  accent?: string;
};

export type SquadMatchHistoryRow = {
  id: string;
  squad_a_id: string;
  squad_b_id: string;
  winner_squad_id: string;
  loser_squad_id: string;
  points_awarded: number;
  recorded_at: string;
  notes: string | null;
  opponent_name: string;
  outcome: 'win' | 'loss';
};

export type SquadRivalry = {
  squad_id: string;
  opponent_name: string;
  wins: number;
  losses: number;
  total_matches: number;
  status: 'heated' | 'active' | 'emerging';
};

export type SquadEventCard = {
  id: string;
  title: string;
  kind: 'practice' | 'scrimmage' | 'tryout' | 'tournament' | 'hangout';
  starts_at: string;
  attendee_count: number;
  location: string;
};

function normalizeSquadRow(row: any): SquadRow {
  return {
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
    description: row.description ?? null,
    visibility: row.visibility ?? null,
    vibe: row.vibe ?? null,
    weekly_goal: row.weekly_goal != null ? Number(row.weekly_goal) : null,
    primary_color: row.primary_color ?? null,
    secondary_color: row.secondary_color ?? null,
    home_court: row.home_court ?? null,
    recruiting: row.recruiting ?? null,
    reliability_min: row.reliability_min != null ? Number(row.reliability_min) : null,
  };
}

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
    ...normalizeSquadRow(s),
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
    ...normalizeSquadRow(row),
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
  return normalizeSquadRow(data);
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

export async function fetchSquadMatchHistory(squadId: string): Promise<SquadMatchHistoryRow[]> {
  try {
    const { data, error } = await supabase
      .from('squad_match_results')
      .select('id, squad_a_id, squad_b_id, winner_squad_id, loser_squad_id, points_awarded, recorded_at, notes')
      .or(`squad_a_id.eq.${squadId},squad_b_id.eq.${squadId}`)
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    const opponentIds = Array.from(new Set((data ?? []).flatMap((row: any) => [row.squad_a_id, row.squad_b_id]).filter((sid: string) => sid && sid !== squadId)));
    let opponentMap = new Map<string, string>();
    if (opponentIds.length > 0) {
      const { data: squads } = await supabase.from('squads').select('id, name').in('id', opponentIds);
      opponentMap = new Map((squads ?? []).map((row: any) => [row.id as string, row.name as string]));
    }
    return (data ?? []).map((row: any) => {
      const opponentId = row.squad_a_id === squadId ? row.squad_b_id : row.squad_a_id;
      return {
        id: row.id,
        squad_a_id: row.squad_a_id,
        squad_b_id: row.squad_b_id,
        winner_squad_id: row.winner_squad_id,
        loser_squad_id: row.loser_squad_id,
        points_awarded: Number(row.points_awarded ?? 0),
        recorded_at: row.recorded_at,
        notes: row.notes ?? null,
        opponent_name: opponentMap.get(opponentId) ?? 'Opponent Squad',
        outcome: row.winner_squad_id === squadId ? 'win' : 'loss',
      };
    });
  } catch {
    return [];
  }
}

export async function fetchSquadRivalries(squadId: string): Promise<SquadRivalry[]> {
  const matches = await fetchSquadMatchHistory(squadId);
  const byOpponent = new Map<string, SquadRivalry>();
  for (const match of matches) {
    const key = match.opponent_name;
    const cur = byOpponent.get(key) ?? {
      squad_id: squadId,
      opponent_name: match.opponent_name,
      wins: 0,
      losses: 0,
      total_matches: 0,
      status: 'emerging' as const,
    };
    cur.total_matches += 1;
    if (match.outcome === 'win') cur.wins += 1;
    else cur.losses += 1;
    cur.status = cur.total_matches >= 4 ? 'heated' : cur.total_matches >= 2 ? 'active' : 'emerging';
    byOpponent.set(key, cur);
  }
  return [...byOpponent.values()].sort((a, b) => b.total_matches - a.total_matches);
}

export async function fetchSquadEvents(squadId: string): Promise<SquadEventCard[]> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('games')
      .select('id, title, starts_at, date_time, location_name, location_area_name, player_ids, description')
      .contains('player_ids', [squadId])
      .gte('date_time', now)
      .order('date_time', { ascending: true })
      .limit(6);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title ?? 'Squad Run',
      kind: /tryout/i.test(row.description ?? '') ? 'tryout' : /scrimmage/i.test(row.description ?? '') ? 'scrimmage' : 'practice',
      starts_at: row.starts_at ?? row.date_time,
      attendee_count: Array.isArray(row.player_ids) ? row.player_ids.length : 0,
      location: row.location_name ?? row.location_area_name ?? 'TBD',
    }));
  } catch {
    return [];
  }
}

export async function fetchSquadFeed(args: {
  squad: SquadRow;
  members: SquadMemberProfile[];
  matches?: SquadMatchHistoryRow[];
}): Promise<SquadFeedItem[]> {
  const feed: SquadFeedItem[] = [];
  const createdAt = args.squad.created_at;
  feed.push({
    id: `created-${args.squad.id}`,
    type: 'milestone',
    title: `${args.squad.name} was formed`,
    body: `Invite code ${args.squad.invite_code} is live. Build your local crew and climb the ladder.`,
    created_at: createdAt,
    accent: 'bg-blue-500/15 text-blue-700',
  });

  const sortedMembers = [...args.members].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
  if (sortedMembers[0]) {
    feed.push({
      id: `top-${sortedMembers[0].user_id}`,
      type: 'member',
      title: `${sortedMembers[0].username ?? 'A member'} leads the squad`,
      body: `Current top contributor with ${sortedMembers[0].xp.toLocaleString()} XP and level ${sortedMembers[0].level}.`,
      created_at: new Date().toISOString(),
      accent: 'bg-amber-500/15 text-amber-700',
    });
  }

  for (const match of (args.matches ?? []).slice(0, 4)) {
    feed.push({
      id: `match-${match.id}`,
      type: 'match',
      title: `${match.outcome === 'win' ? 'Victory' : 'Tough loss'} vs ${match.opponent_name}`,
      body: `${match.outcome === 'win' ? 'Gained' : 'Played for'} ${match.points_awarded} competitive points.${match.notes ? ` ${match.notes}` : ''}`,
      created_at: match.recorded_at,
      accent: match.outcome === 'win' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700',
    });
  }

  return feed.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
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
      out.push(rowToLeaderboard({
        ...(s as any),
        squad_id: (s as any).id,
        member_count: 0,
        total_xp: 0,
      }));
    }
  }
  return out.sort((a, b) => (b.rating - a.rating) || (b.points - a.points) || (b.total_xp - a.total_xp)).slice(0, limit);
}
