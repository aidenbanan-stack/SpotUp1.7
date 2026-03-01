import { supabase } from '@/lib/supabaseClient';
import type { Sport, TournamentFormat, SeriesType, TeamCount, PointsStyle } from '@/types';

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
  location: any;
  starts_at: string;
  notes: string | null;
  created_at: string;
};

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
      location: args.location,
      starts_at: args.startsAtISO,
      notes: args.notes,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as TournamentRow;
}

export async function registerForTournament(args: { tournamentId: string; userId: string }): Promise<void> {
  const { error } = await supabase.from('tournament_registrations').insert({
    tournament_id: args.tournamentId,
    user_id: args.userId,
    status: 'registered',
  });

  if (error) {
    const msg = (error as any)?.message ?? '';
    const code = (error as any)?.code ?? '';
    const isDup =
      String(code) === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique');
    if (!isDup) throw error;
  }
}

export async function fetchTournamentRegistrationCount(tournamentId: string): Promise<number> {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact' })
    .eq('tournament_id', tournamentId);

  if (error) throw error;
  return (data as any)?.length ?? 0;
}

export async function isUserRegistered(args: { tournamentId: string; userId: string }): Promise<boolean> {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id')
    .eq('tournament_id', args.tournamentId)
    .eq('user_id', args.userId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}
