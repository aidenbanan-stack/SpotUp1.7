import { supabase } from '@/lib/supabaseClient';
import type { Sport, TournamentFormat, SeriesType, TeamCount, PointsStyle } from '@/types';

export type TournamentJoinMode = 'solo' | 'squad' | 'either';
export type TournamentStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export type TournamentRow = {
  id: string;
  host_id: string;
  name: string;
  sport: Sport;
  format: TournamentFormat;
  series_type: SeriesType;
  team_count: TeamCount;
  points_style: PointsStyle;
  is_private: boolean;
  join_mode: TournamentJoinMode;
  status: TournamentStatus;
  ends_at: string | null;
  location: any;
  starts_at: string;
  notes: string | null;
  created_at: string;
};

export type TournamentRegistrationRow = {
  id: string;
  tournament_id: string;
  user_id: string | null;
  squad_id: string | null;
  status: string;
  created_at: string;
};

export async function fetchPublicTournaments(): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_private', false)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TournamentRow[];
}

export async function fetchTournaments(): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TournamentRow[];
}

export async function fetchTournamentById(id: string): Promise<TournamentRow> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as TournamentRow;
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
  location: any;
  startsAtISO: string;
  notes: string | null;
}): Promise<TournamentRow> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      host_id: args.hostId,
      name: args.name.trim(),
      sport: args.sport,
      format: args.format,
      series_type: args.seriesType,
      team_count: args.teamCount,
      points_style: args.pointsStyle,
      is_private: args.isPrivate,
      join_mode: args.joinMode,
      status: 'scheduled',
      location: args.location,
      starts_at: args.startsAtISO,
      notes: args.notes,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as TournamentRow;
}

function isDupError(error: any): boolean {
  const msg = error?.message ?? '';
  const code = error?.code ?? '';
  return (
    String(code) === '23505' ||
    String(msg).toLowerCase().includes('duplicate') ||
    String(msg).toLowerCase().includes('unique')
  );
}

export async function registerForTournament(args: { tournamentId: string; userId: string }): Promise<void> {
  const { error } = await supabase.from('tournament_registrations').insert({
    tournament_id: args.tournamentId,
    user_id: args.userId,
    squad_id: null,
    status: 'registered',
  });

  if (error && !isDupError(error)) throw error;
}

export async function registerSquadForTournament(args: { tournamentId: string; squadId: string }): Promise<void> {
  const { error } = await supabase.from('tournament_registrations').insert({
    tournament_id: args.tournamentId,
    user_id: null,
    squad_id: args.squadId,
    status: 'registered',
  });

  if (error && !isDupError(error)) throw error;
}

export async function fetchTournamentRegistrationCount(tournamentId: string): Promise<number> {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact' })
    .eq('tournament_id', tournamentId);

  if (error) throw error;
  return (data as any)?.length ?? 0;
}

export async function isUserOrSquadRegistered(args: { tournamentId: string; userId: string }): Promise<boolean> {
  // find user's squads
  const { data: mems, error: memErr } = await supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', args.userId);

  if (memErr) throw memErr;

  const squadIds = (mems ?? []).map((m: any) => m.squad_id).filter(Boolean);

  let q = supabase
    .from('tournament_registrations')
    .select('id')
    .eq('tournament_id', args.tournamentId);

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
  // 1) tournaments I host
  const { data: hosted, error: hostErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('host_id', userId);

  if (hostErr) throw hostErr;

  // 2) tournaments I joined (as user)
  const { data: regsUser, error: regUserErr } = await supabase
    .from('tournament_registrations')
    .select('tournament_id')
    .eq('user_id', userId);

  if (regUserErr) throw regUserErr;

  // 3) tournaments my squads joined
  const { data: mems, error: memErr } = await supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', userId);

  if (memErr) throw memErr;

  const squadIds = (mems ?? []).map((m: any) => m.squad_id).filter(Boolean);

  let regsSquad: any[] = [];
  if (squadIds.length > 0) {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('tournament_id')
      .in('squad_id', squadIds);
    if (error) throw error;
    regsSquad = data ?? [];
  }

  const ids = new Set<string>();
  for (const t of hosted ?? []) ids.add((t as any).id);
  for (const r of regsUser ?? []) ids.add((r as any).tournament_id);
  for (const r of regsSquad ?? []) ids.add((r as any).tournament_id);

  const allIds = Array.from(ids);
  if (allIds.length === 0) return [];

  const { data: all, error: allErr } = await supabase
    .from('tournaments')
    .select('*')
    .in('id', allIds)
    .order('starts_at', { ascending: true });

  if (allErr) throw allErr;
  return (all ?? []) as TournamentRow[];
}
