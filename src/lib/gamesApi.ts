import type { Game, SkillLevel, Sport } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchProfileById, fetchProfilesByIds } from '@/lib/profileApi';

// DB shape (public.games)
export type GameRow = {
  id: string;
  host_id: string;
  sport: Sport;
  title: string;
  description: string | null;
  date_time: string;
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
  created_at: string;
};

function rowToGame(row: GameRow): Game {
  const playerIds = Array.from(new Set([row.host_id, ...((row.player_ids ?? []) as string[])]));

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
    playerIds,
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

async function hydrateGame(game: Game): Promise<Game> {
  try {
    const [players, host] = await Promise.all([
      fetchProfilesByIds(game.playerIds ?? []),
      fetchProfileById(game.hostId),
    ]);

    return {
      ...game,
      players,
      host: host ?? undefined,
    };
  } catch {
    return game;
  }
}

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const base = (data as GameRow[]).map(rowToGame);
  return await Promise.all(base.map(hydrateGame));
}

export type CreateGameInput = Omit<
  Game,
  'id' | 'createdAt' | 'host' | 'players' | 'postGameVotes' | 'completedAt'
>;

export async function createGame(input: CreateGameInput): Promise<Game> {
  const playerIds = Array.from(new Set([input.hostId, ...(input.playerIds ?? [])]));

  const insertRow = {
    host_id: input.hostId,
    sport: input.sport,
    title: input.title,
    description: input.description || null,
    date_time: input.dateTime.toISOString(),
    duration: input.duration,
    skill_requirement: input.skillRequirement,
    max_players: input.maxPlayers,
    player_ids: playerIds,
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

  const { data, error } = await supabase.from('games').insert(insertRow).select('*').single();
  if (error) throw error;

  return await hydrateGame(rowToGame(data as GameRow));
}

export async function updateGame(
  gameId: string,
  patch: Partial<Pick<Game, 'sport' | 'title' | 'description' | 'dateTime' | 'duration' | 'skillRequirement' | 'maxPlayers' | 'isPrivate' | 'location'>>
): Promise<Game> {
  const updateRow: any = {};

  if (patch.sport) updateRow.sport = patch.sport;
  if (patch.title !== undefined) updateRow.title = patch.title;
  if (patch.description !== undefined) updateRow.description = patch.description || null;
  if (patch.dateTime) updateRow.date_time = patch.dateTime.toISOString();
  if (patch.duration !== undefined) updateRow.duration = patch.duration;
  if (patch.skillRequirement) updateRow.skill_requirement = patch.skillRequirement;
  if (patch.maxPlayers !== undefined) updateRow.max_players = patch.maxPlayers;
  if (patch.isPrivate !== undefined) updateRow.is_private = patch.isPrivate;

  if (patch.location) {
    updateRow.location_latitude = patch.location.latitude;
    updateRow.location_longitude = patch.location.longitude;
    updateRow.location_area_name = patch.location.areaName;
  }

  const { data, error } = await supabase
    .from('games')
    .update(updateRow)
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}

export async function deleteGame(gameId: string): Promise<void> {
  const { error } = await supabase.from('games').delete().eq('id', gameId);
  if (error) throw error;
}

/**
 * Secure join/leave/check-in use RPCs that enforce auth.uid() on the server.
 */

export async function joinGame(gameId: string, _userId: string, _isPrivate: boolean): Promise<Game> {
  const { data, error } = await supabase.rpc('join_or_request_game', { p_game_id: gameId }).single();
  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}

export async function leaveGame(gameId: string, _userId: string): Promise<Game> {
  const { data, error } = await supabase.rpc('leave_game', { p_game_id: gameId }).single();
  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
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
  return await hydrateGame(rowToGame(data as GameRow));
}

export async function toggleCheckIn(gameId: string, _userId: string, checkedIn: boolean): Promise<Game> {
  const { data, error } = await supabase
    .rpc('toggle_check_in', { p_game_id: gameId, p_checked_in: checkedIn })
    .single();

  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}

export async function setRunsStarted(gameId: string, runsStarted: boolean): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .update({ runs_started: runsStarted })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}

export async function endGame(gameId: string): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .update({ status: 'finished', ended_at: new Date().toISOString(), runs_started: false })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}
