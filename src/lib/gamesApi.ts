import type { Game, SkillLevel, Sport } from '@/types';
import { supabase } from '@/lib/supabaseClient';

// DB shape (public.games)
export type GameRow = {
  id: string;
  host_id: string;
  sport: Sport;
  title: string;
  description: string | null;
  date_time: string; // timestamptz
  duration: number;
  skill_requirement: SkillLevel;
  max_players: number;
  player_ids: string[];
  pending_request_ids: string[];
  is_private: boolean;
  status: 'scheduled' | 'live' | 'finished';
  checked_in_ids: string[];
  runs_started: boolean;
  ended_at: string | null;
  post_game_votes: any | null;
  post_game_voters: any | null;
  location_latitude: number;
  location_longitude: number;
  location_area_name: string;
  created_at: string; // timestamptz
};

function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    hostId: row.host_id,
    sport: row.sport,
    title: row.title,
    description: row.description ?? '',
    dateTime: new Date(row.date_time),
    duration: row.duration,
    skillRequirement: row.skill_requirement,
    maxPlayers: row.max_players,
    playerIds: row.player_ids ?? [],
    pendingRequestIds: row.pending_request_ids ?? [],
    isPrivate: row.is_private,
    status: row.status ?? 'scheduled',
    checkedInIds: row.checked_in_ids ?? [],
    runsStarted: row.runs_started ?? false,
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    postGameVotes: (row.post_game_votes ?? undefined) as any,
    postGameVoters: (row.post_game_voters ?? undefined) as any,
    location: {
      latitude: row.location_latitude,
      longitude: row.location_longitude,
      areaName: row.location_area_name,
    },
    createdAt: new Date(row.created_at),
  };
}

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as GameRow[]).map(rowToGame);
}

export type CreateGameInput = Omit<
  Game,
  'id' | 'createdAt' | 'host' | 'players' | 'postGameVotes' | 'completedAt'
>;

export async function createGame(input: CreateGameInput): Promise<Game> {
  const insertRow = {
    host_id: input.hostId,
    sport: input.sport,
    title: input.title,
    description: input.description || null,
    date_time: input.dateTime.toISOString(),
    duration: input.duration,
    skill_requirement: input.skillRequirement,
    max_players: input.maxPlayers,
    player_ids: input.playerIds,
    pending_request_ids: input.pendingRequestIds,
    is_private: input.isPrivate,
    status: input.status ?? 'scheduled',
    checked_in_ids: input.checkedInIds ?? [],
    runs_started: input.runsStarted ?? false,
    ended_at: input.endedAt ? input.endedAt.toISOString() : null,
    post_game_votes: input.postGameVotes ?? null,
    post_game_voters: input.postGameVoters ?? null,
    location_latitude: input.location.latitude,
    location_longitude: input.location.longitude,
    location_area_name: input.location.areaName,
  };

  const { data, error } = await supabase
    .from('games')
    .insert(insertRow)
    .select('*')
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}

/**
 * SECURE JOIN / LEAVE / CHECK-IN
 * These call Postgres RPC functions that enforce permissions via auth.uid().
 * Do not trust client-provided userId or isPrivate.
 */

export async function joinGame(
  gameId: string,
  _userId: string,
  _isPrivate: boolean
): Promise<Game> {
  const { data, error } = await supabase
    .rpc('join_or_request_game', { p_game_id: gameId })
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}

export async function leaveGame(gameId: string, _userId: string): Promise<Game> {
  const { data, error } = await supabase
    .rpc('leave_game', { p_game_id: gameId })
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}

export async function setGameStatus(
  gameId: string,
  status: 'scheduled' | 'live' | 'finished'
): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .update({ status })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}

export async function toggleCheckIn(
  gameId: string,
  _userId: string,
  checkedIn: boolean
): Promise<Game> {
  const { data, error } = await supabase
    .rpc('toggle_check_in', { p_game_id: gameId, p_checked_in: checkedIn })
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}

export async function setRunsStarted(gameId: string, runsStarted: boolean): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .update({ runs_started: runsStarted })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}

export async function endGame(gameId: string): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .update({ status: 'finished', ended_at: new Date().toISOString(), runs_started: false })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}

type PostGameVoteCategory =
  | 'best_shooter'
  | 'best_passer'
  | 'best_all_around'
  | 'best_scorer'
  | 'best_defender';

type PostGameVotes = Record<PostGameVoteCategory, Record<string, number>>;
type PostGameVoters = Record<string, Partial<Record<PostGameVoteCategory, string>>>;

export async function submitPostGameVotes(
  gameId: string,
  voterId: string,
  votes: { category: PostGameVoteCategory; votedUserId: string }[]
): Promise<Game> {
  const { data: existing, error: fetchError } = await supabase
    .from('games')
    .select('post_game_votes, post_game_voters')
    .eq('id', gameId)
    .single();

  if (fetchError) throw fetchError;

  const currentVotes: PostGameVotes =
    (existing?.post_game_votes as PostGameVotes) ?? {
      best_shooter: {},
      best_passer: {},
      best_all_around: {},
      best_scorer: {},
      best_defender: {},
    };

  const currentVoters: PostGameVoters = (existing?.post_game_voters as PostGameVoters) ?? {};

  const voterRecord = currentVoters[voterId] ?? {};
  // Prevent double-voting per category.
  const filtered = votes.filter((v) => !voterRecord[v.category]);

  if (filtered.length === 0) {
    // No-op, but return latest game row
    const { data, error } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (error) throw error;
    return rowToGame(data as GameRow);
  }

  const nextVotes: PostGameVotes = { ...currentVotes } as any;
  for (const v of filtered) {
    const bucket = { ...(nextVotes[v.category] ?? {}) };
    bucket[v.votedUserId] = (bucket[v.votedUserId] ?? 0) + 1;
    nextVotes[v.category] = bucket;
  }

  const nextVoters: PostGameVoters = { ...currentVoters, [voterId]: { ...voterRecord } };
  for (const v of filtered) {
    nextVoters[voterId][v.category] = v.votedUserId;
  }

  const { data, error } = await supabase
    .from('games')
    .update({ post_game_votes: nextVotes, post_game_voters: nextVoters })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) throw error;
  return rowToGame(data as GameRow);
}
