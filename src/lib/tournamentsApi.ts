import { supabase } from '@/lib/supabaseClient';
import type { Sport, TournamentFormat, SeriesType, TeamCount, PointsStyle } from '@/types';

export type TournamentJoinMode = 'solo' | 'squad' | 'either';
export type TournamentStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type TournamentRegistrationStatus =
  | 'pending'
  | 'registered'
  | 'checked_in'
  | 'eliminated'
  | 'withdrawn'
  | 'disqualified'
  | 'champion';
export type TournamentEntryType = 'solo' | 'squad';
export type TournamentMatchStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'cancelled';
export type TournamentBracketSide = 'main' | 'winners' | 'losers' | 'finals' | 'placement';

export type TournamentRow = {
  id: string;
  host_id: string;
  name: string;
  sport: Sport;
  format: TournamentFormat;
  series_type: SeriesType;
  team_count: TeamCount | string;
  points_style: PointsStyle;
  is_private: boolean;
  join_mode: TournamentJoinMode;
  status: TournamentStatus;
  ends_at: string | null;
  location: Record<string, unknown> | null;
  starts_at: string;
  notes: string | null;
  created_at: string;
  registration_closes_at?: string | null;
  bracket_generated_at?: string | null;
  completed_at?: string | null;
  winner_registration_id?: string | null;
  settings?: Record<string, unknown> | null;
};

export type TournamentRegistrationRow = {
  id: string;
  tournament_id: string;
  user_id: string | null;
  squad_id: string | null;
  status: TournamentRegistrationStatus;
  created_at: string;
  seed?: number | null;
  checked_in_at?: string | null;
  eliminated_at?: string | null;
  final_rank?: number | null;
  roster_snapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type TournamentRegistrationDetailRow = TournamentRegistrationRow & {
  entry_type: TournamentEntryType;
  display_name: string;
  user_profile_photo_url?: string | null;
  squad_primary_color?: string | null;
  squad_secondary_color?: string | null;
};

export type TournamentMatchRow = {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  bracket_side: TournamentBracketSide;
  stage_label?: string | null;
  status: TournamentMatchStatus;
  best_of: number;
  participant_1_registration_id?: string | null;
  participant_2_registration_id?: string | null;
  participant_1_score?: number | null;
  participant_2_score?: number | null;
  winner_registration_id?: string | null;
  loser_registration_id?: string | null;
  next_match_id?: string | null;
  next_match_slot?: 1 | 2 | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  source: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type TournamentMatchDetailRow = TournamentMatchRow & {
  participant_1_name?: string | null;
  participant_2_name?: string | null;
  winner_name?: string | null;
  loser_name?: string | null;
};

function isDupError(error: unknown): boolean {
  const maybeError = error as { message?: string; code?: string } | null;
  const msg = maybeError?.message ?? '';
  const code = maybeError?.code ?? '';
  return (
    String(code) === '23505' ||
    String(msg).toLowerCase().includes('duplicate') ||
    String(msg).toLowerCase().includes('unique')
  );
}

function normalizeTournamentRows(rows: TournamentRow[] | null | undefined): TournamentRow[] {
  return (rows ?? []).map((row) => ({
    ...row,
    settings: row.settings ?? {},
    location: row.location ?? {},
  }));
}

export function getTournamentCapacity(tournament: Pick<TournamentRow, 'team_count' | 'settings'>): number {
  const fromSettings = Number((tournament.settings ?? {})['capacity']);
  if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;

  const parsed = Number(String(tournament.team_count).replace(/[^0-9]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function fetchPublicTournaments(): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_private', false)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return normalizeTournamentRows((data ?? []) as TournamentRow[]);
}

export async function fetchTournaments(): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return normalizeTournamentRows((data ?? []) as TournamentRow[]);
}

export async function fetchTournamentById(id: string): Promise<TournamentRow> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizeTournamentRows([data as TournamentRow])[0];
}

export async function createTournament(args: {
  hostId: string;
  name: string;
  sport: Sport;
  format: TournamentFormat;
  seriesType: SeriesType;
  teamCount: TeamCount;
  pointsStyle: PointsStyle;
  isPrivate: boolean;
  joinMode: TournamentJoinMode;
  location: Record<string, unknown>;
  startsAtISO: string;
  notes: string | null;
  registrationClosesAtISO?: string | null;
}): Promise<TournamentRow> {
  const { data, error } = await supabase
    .rpc('create_tournament_secure', {
      p_name: args.name.trim(),
      p_sport: args.sport,
      p_format: args.format,
      p_series_type: args.seriesType,
      p_team_count: String(args.teamCount),
      p_points_style: args.pointsStyle,
      p_join_mode: args.joinMode,
      p_is_private: args.isPrivate,
      p_location: args.location,
      p_starts_at: args.startsAtISO,
      p_notes: args.notes,
      p_registration_closes_at: args.registrationClosesAtISO ?? null,
    })
    .single();

  if (error) throw error;
  return normalizeTournamentRows([data as TournamentRow])[0];
}

export async function registerForTournament(args: { tournamentId: string; userId: string }): Promise<TournamentRegistrationRow | null> {
  const { data, error } = await supabase
    .rpc('register_for_tournament_secure', {
      p_tournament_id: args.tournamentId,
    })
    .maybeSingle();

  if (error && !isDupError(error)) throw error;
  return (data as TournamentRegistrationRow | null) ?? null;
}

export async function registerSquadForTournament(args: { tournamentId: string; squadId: string }): Promise<TournamentRegistrationRow | null> {
  const { data, error } = await supabase
    .rpc('register_squad_for_tournament_secure', {
      p_tournament_id: args.tournamentId,
      p_squad_id: args.squadId,
    })
    .maybeSingle();

  if (error && !isDupError(error)) throw error;
  return (data as TournamentRegistrationRow | null) ?? null;
}


export async function reseedTournament(args: { tournamentId: string; method: 'ranking' | 'created_at' | 'random' }): Promise<TournamentRegistrationDetailRow[]> {
  const { data, error } = await supabase
    .rpc('reseed_tournament_secure', {
      p_tournament_id: args.tournamentId,
      p_method: args.method,
    });

  if (error) throw error;
  return (data ?? []) as TournamentRegistrationDetailRow[];
}

export async function generateTournamentBracket(args: { tournamentId: string }): Promise<TournamentMatchDetailRow[]> {
  const { data, error } = await supabase
    .rpc('generate_tournament_bracket_secure', {
      p_tournament_id: args.tournamentId,
    });

  if (error) throw error;
  return (data ?? []) as TournamentMatchDetailRow[];
}

export async function lockTournamentRegistration(args: { tournamentId: string }): Promise<TournamentRow> {
  const { data, error } = await supabase
    .rpc('lock_tournament_registration_secure', {
      p_tournament_id: args.tournamentId,
    })
    .single();

  if (error) throw error;
  return normalizeTournamentRows([data as TournamentRow])[0];
}

export async function startTournament(args: { tournamentId: string }): Promise<TournamentRow> {
  const { data, error } = await supabase
    .rpc('start_tournament_secure', {
      p_tournament_id: args.tournamentId,
    })
    .single();

  if (error) throw error;
  return normalizeTournamentRows([data as TournamentRow])[0];
}

export async function cancelTournament(args: { tournamentId: string; reason?: string | null }): Promise<TournamentRow> {
  const { data, error } = await supabase
    .rpc('cancel_tournament_secure', {
      p_tournament_id: args.tournamentId,
      p_reason: args.reason ?? null,
    })
    .single();

  if (error) throw error;
  return normalizeTournamentRows([data as TournamentRow])[0];
}

export async function fetchTournamentRegistrationCount(tournamentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('status', ['pending', 'registered', 'checked_in', 'champion']);

  if (error) throw error;
  return count ?? 0;
}

export async function fetchTournamentRegistrations(tournamentId: string): Promise<TournamentRegistrationDetailRow[]> {
  const { data, error } = await supabase
    .rpc('list_tournament_registrations_secure', {
      p_tournament_id: tournamentId,
    });

  if (error) throw error;
  return (data ?? []) as TournamentRegistrationDetailRow[];
}

export async function fetchTournamentMatches(tournamentId: string): Promise<TournamentMatchDetailRow[]> {
  const { data, error } = await supabase
    .rpc('list_tournament_matches_secure', {
      p_tournament_id: tournamentId,
    });

  if (error) throw error;
  return (data ?? []) as TournamentMatchDetailRow[];
}

export async function isUserOrSquadRegistered(args: { tournamentId: string; userId: string }): Promise<boolean> {
  const { data: mems, error: memErr } = await supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', args.userId);

  if (memErr) throw memErr;

  const squadIds = (mems ?? []).map((m: { squad_id: string | null }) => m.squad_id).filter(Boolean) as string[];

  let q = supabase
    .from('tournament_registrations')
    .select('id')
    .eq('tournament_id', args.tournamentId)
    .in('status', ['pending', 'registered', 'checked_in', 'champion']);

  if (squadIds.length > 0) {
    q = q.or(`user_id.eq.${args.userId},squad_id.in.(${squadIds.join(',')})`);
  } else {
    q = q.eq('user_id', args.userId);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function fetchMyTournaments(userId: string): Promise<TournamentRow[]> {
  const { data: hosted, error: hostErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('host_id', userId);

  if (hostErr) throw hostErr;

  const { data: regsUser, error: regUserErr } = await supabase
    .from('tournament_registrations')
    .select('tournament_id')
    .eq('user_id', userId)
    .in('status', ['pending', 'registered', 'checked_in', 'champion']);

  if (regUserErr) throw regUserErr;

  const { data: mems, error: memErr } = await supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', userId);

  if (memErr) throw memErr;

  const squadIds = (mems ?? []).map((m: { squad_id: string | null }) => m.squad_id).filter(Boolean) as string[];

  let regsSquad: { tournament_id: string }[] = [];
  if (squadIds.length > 0) {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('tournament_id')
      .in('squad_id', squadIds)
      .in('status', ['pending', 'registered', 'checked_in', 'champion']);
    if (error) throw error;
    regsSquad = (data ?? []) as { tournament_id: string }[];
  }

  const ids = new Set<string>();
  for (const t of hosted ?? []) ids.add((t as TournamentRow).id);
  for (const r of regsUser ?? []) ids.add(r.tournament_id);
  for (const r of regsSquad ?? []) ids.add(r.tournament_id);

  const allIds = Array.from(ids);
  if (allIds.length === 0) return [];

  const { data: all, error: allErr } = await supabase
    .from('tournaments')
    .select('*')
    .in('id', allIds)
    .order('starts_at', { ascending: true });

  if (allErr) throw allErr;
  return normalizeTournamentRows((all ?? []) as TournamentRow[]);
}
