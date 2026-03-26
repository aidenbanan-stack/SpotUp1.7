import type { Game, SkillLevel, Sport } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchProfileById, fetchProfilesByIds } from '@/lib/profileApi';
import { createNotification } from '@/lib/notificationsApi';

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

export async function fetchGameById(gameId: string): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error) throw error;

  const base = rowToGame(data as GameRow);
  return await hydrateGame(base);
}


/**
 * Accept a game invite.
 * - Public games: joins using join_or_request_game.
 * - Private games: if inviter is the host, joins directly via RPC accept_game_invite (requires SQL).
 *   Otherwise, falls back to join_or_request_game (creates a request).
 */
export async function acceptGameInvite(gameId: string, inviterUserId: string): Promise<Game> {
  // First try special RPC for host-invites (works for private games).
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('accept_game_invite', { p_game_id: gameId, p_inviter_user_id: inviterUserId })
    .single();

  if (!rpcErr && rpcData) {
    return await hydrateGame(rowToGame(rpcData as GameRow));
  }

  // Fallback: behave like a normal join (public joins, private becomes a request).
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user;
  const meId = me?.id ?? '';
  return await joinGame(gameId, meId, true);
}

export type CreateGameInput = Omit<
  Game,
  'id' | 'createdAt' | 'host' | 'players' | 'postGameVotes' | 'completedAt'
> & {
  recurrenceCount?: number;
  recurrenceIntervalDays?: number;
};

export async function createGame(input: CreateGameInput): Promise<Game> {
  const playerIds = Array.from(new Set([input.hostId, ...(input.playerIds ?? [])]));

  const rpcPayload = {
    p_sport: input.sport,
    p_title: input.title,
    p_description: input.description || null,
    p_date_time: input.dateTime.toISOString(),
    p_duration: input.duration,
    p_skill_requirement: input.skillRequirement,
    p_max_players: input.maxPlayers,
    p_is_private: input.isPrivate,
    p_location_latitude: input.location.latitude,
    p_location_longitude: input.location.longitude,
    p_location_area_name: input.location.areaName,
    p_recurrence_count: Math.max(1, Number(input.recurrenceCount ?? 1)),
    p_recurrence_interval_days: Math.max(1, Number(input.recurrenceIntervalDays ?? 7)),
  };

  const { data, error } = await supabase.rpc('create_game_secure', rpcPayload).single();
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

export async function joinGame(gameId: string, userId: string, _isPrivate: boolean): Promise<Game> {
  const { data, error } = await supabase.rpc('join_or_request_game', { p_game_id: gameId }).single();
  if (error) throw error;

  const updated = await hydrateGame(rowToGame(data as GameRow));

  // If this was a private game request (not an auto-join), best-effort notify the host.
  try {
    const isPending = (updated.pendingRequestIds ?? []).includes(userId);
    const isJoined = (updated.playerIds ?? []).includes(userId);
    if (updated.isPrivate && isPending && !isJoined && updated.hostId && updated.hostId !== userId) {
      await createNotification({
        userId: updated.hostId,
        type: 'join_request',
        relatedUserId: userId,
        relatedGameId: updated.id,
        message: 'New join request',
      });
    }
  } catch {
    // ignore
  }

  return updated;
}

/**
 * Approve a pending join request (host only).
 * Prefer RPC if installed; fall back to a direct update which should still be protected by RLS.
 */
export async function approveJoinRequest(gameId: string, userIdToApprove: string): Promise<Game> {
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('approve_game_request', { p_game_id: gameId, p_user_id: userIdToApprove })
    .single();

  if (!rpcErr && rpcData) {
    return await hydrateGame(rowToGame(rpcData as GameRow));
  }

  // Fall back: fetch the game row, then update arrays.
  const { data: existing, error: fetchError } = await supabase
    .from('games')
    .select('player_ids,pending_request_ids')
    .eq('id', gameId)
    .single();
  if (fetchError) throw fetchError;

  const currentPlayers = Array.from(new Set((existing?.player_ids ?? []) as string[]));
  const currentPending = ((existing?.pending_request_ids ?? []) as string[]).filter((id) => id !== userIdToApprove);
  const nextPlayers = Array.from(new Set([...currentPlayers, userIdToApprove]));

  const { data, error } = await supabase
    .from('games')
    .update({ player_ids: nextPlayers, pending_request_ids: currentPending })
    .eq('id', gameId)
    .select('*')
    .single();
  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}

/**
 * Reject a pending join request (host only).
 */
export async function rejectJoinRequest(gameId: string, userIdToReject: string): Promise<Game> {
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('reject_game_request', { p_game_id: gameId, p_user_id: userIdToReject })
    .single();

  if (!rpcErr && rpcData) {
    return await hydrateGame(rowToGame(rpcData as GameRow));
  }

  const { data: existing, error: fetchError } = await supabase
    .from('games')
    .select('pending_request_ids')
    .eq('id', gameId)
    .single();
  if (fetchError) throw fetchError;

  const currentPending = ((existing?.pending_request_ids ?? []) as string[]).filter((id) => id !== userIdToReject);

  const { data, error } = await supabase
    .from('games')
    .update({ pending_request_ids: currentPending })
    .eq('id', gameId)
    .select('*')
    .single();
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

export async function toggleCheckIn(gameId: string, targetUserId: string): Promise<Game> {
  const { data, error } = await supabase
    .rpc('toggle_check_in', { p_game_id: gameId, p_target_user_id: targetUserId })
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
    .rpc('end_game_session', { p_game_id: gameId })
    .single();

  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}

/**
 * Host-only: report a signed-up player who did not show up.
 * This updates the reported user's reliability stats in `profiles`.
 * Requires SQL function `report_no_show` (see `supabase_sql_updates.sql`).
 */
export async function reportNoShow(gameId: string, reportedUserId: string): Promise<void> {
  const { error } = await supabase.rpc('report_no_show', { p_game_id: gameId, p_reported_user_id: reportedUserId });
  if (error) throw error;
}

type PostGameVoteCategory =
  | 'most_dominant'
  | 'best_teammate'
  | 'most_clutch'
  | 'winner'
  | 'most_energy'
  | 'bucket_getter'
  | 'lockdown_defender'
  | 'floor_general'
  | 'board_beast'
  | 'sharpshooter'
  | 'finisher'
  | 'playmaker'
  | 'wall'
  | 'ball_winner'
  | 'engine'
  | 'dink_master'
  | 'net_boss'
  | 'rally_king'
  | 'placement_pro'
  | 'unshakeable'
  | 'qb1'
  | 'route_runner'
  | 'hands_team'
  | 'lockdown_db'
  | 'big_play_threat'
  | 'slugger'
  | 'ace'
  | 'gold_glove'
  | 'spark_plug'
  | 'closer'
  | 'kill_leader'
  | 'block_party'
  | 'setter_elite'
  | 'dig_machine'
  | 'serve_specialist'
  | 'handler'
  | 'deep_threat'
  | 'shutdown_defender'
  | 'layout_legend'
  | 'field_general';

type PostGameVotes = Partial<Record<PostGameVoteCategory, Record<string, number>>>;
type PostGameVoters = Record<string, Partial<Record<PostGameVoteCategory, string>>>;

/**
 * Submit postgame votes.
 * Stores aggregated vote counts in games.post_game_votes and a "who voted for who" record in games.post_game_voters
 * so a user cannot vote twice in the same category.
 */
export async function submitPostGameVotes(
  gameId: string,
  _voterId: string,
  votes: { category: PostGameVoteCategory; votedUserId: string }[]
): Promise<Game> {
  const { data, error } = await supabase
    .rpc('submit_post_game_votes', { p_game_id: gameId, p_votes: votes })
    .single();

  if (error) throw error;
  return await hydrateGame(rowToGame(data as GameRow));
}
