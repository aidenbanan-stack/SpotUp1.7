import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Copy,
  Lock,
  LogOut,
  MapPin,
  ShieldAlert,
  Trophy,
  Users,
  Wand2,
  Play,
  Ban,
  CheckCircle2,
  Swords,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { SPORTS } from '@/types';
import {
  cancelTournament,
  fetchTournamentById,
  fetchTournamentMatches,
  fetchTournamentRegistrations,
  generateTournamentBracket,
  getPrivateTournamentAccessCode,
  getTournamentCapacity,
  isTournamentRegistrationLocked,
  isUserOrSquadRegistered,
  lockTournamentRegistration,
  registerForTournament,
  registerSquadForTournament,
  reseedTournament,
  startTournament,
  startTournamentMatch,
  submitTournamentMatchResult,
  unregisterFromTournament,
  type TournamentMatchDetailRow,
  type TournamentRegistrationDetailRow,
  type TournamentRow,
} from '@/lib/tournamentsApi';
import { fetchMySquads, type SquadWithMeta } from '@/lib/squadsApi';
import { toast } from 'sonner';

function formatWhen(iso?: string | null): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCompact(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function tournamentStatusLabel(status: TournamentRow['status']): string {
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  return status;
}

function matchStatusLabel(status: TournamentMatchDetailRow['status']): string {
  if (status === 'ready') return 'Ready';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Pending';
}

export default function TournamentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistrationDetailRow[]>([]);
  const [matches, setMatches] = useState<TournamentMatchDetailRow[]>([]);
  const [registered, setRegistered] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [mySquads, setMySquads] = useState<SquadWithMeta[]>([]);
  const [loadingSquads, setLoadingSquads] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [privateCode, setPrivateCode] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatchDetailRow | null>(null);
  const [participant1Score, setParticipant1Score] = useState('');
  const [participant2Score, setParticipant2Score] = useState('');

  const isHost = !!user?.id && user.id === tournament?.host_id;
  const canJoinAsSquad = tournament?.join_mode === 'squad' || tournament?.join_mode === 'either';
  const canJoinAsSolo = tournament?.join_mode === 'solo' || tournament?.join_mode === 'either';
  const registrationLocked = isTournamentRegistrationLocked(tournament);
  const capacity = useMemo(() => (tournament ? getTournamentCapacity(tournament) : 0), [tournament]);

  const activeRegistrations = useMemo(
    () => registrations.filter((entry) => ['pending', 'registered', 'checked_in', 'champion'].includes(entry.status)).length,
    [registrations],
  );

  const mySquadIds = useMemo(() => new Set(mySquads.map((s) => s.id)), [mySquads]);

  const myRegistration = useMemo(() => {
    if (!user?.id) return null;
    return (
      registrations.find((entry) => entry.user_id === user.id) ??
      registrations.find((entry) => !!entry.squad_id && mySquadIds.has(entry.squad_id)) ??
      null
    );
  }, [mySquadIds, registrations, user?.id]);

  const championRegistration = useMemo(() => {
    if (!tournament?.winner_registration_id) return null;
    return registrations.find((entry) => entry.id === tournament.winner_registration_id) ?? null;
  }, [registrations, tournament?.winner_registration_id]);

  const leaveDisabledReason = useMemo(() => {
    if (!tournament || !myRegistration) return null;
    if (isHost) return 'Hosts cannot leave their own tournament';
    if (tournament.status !== 'scheduled') return 'You can only leave before the tournament starts';
    if (tournament.bracket_generated_at) return 'You can no longer leave after the bracket is generated';
    return null;
  }, [isHost, myRegistration, tournament]);

  const joinDisabledReason = useMemo(() => {
    if (!tournament) return 'Tournament not found';
    if (registered) return 'You are already registered';
    if (tournament.status !== 'scheduled') return 'This tournament is not accepting registrations';
    if (registrationLocked) return 'Registration is closed';
    if (capacity > 0 && activeRegistrations >= capacity) return 'Tournament is full';
    return null;
  }, [activeRegistrations, capacity, registered, registrationLocked, tournament]);

  const bracketRounds = useMemo(() => {
    const grouped = new Map<number, TournamentMatchDetailRow[]>();
    for (const match of matches) {
      if (match.bracket_side !== 'main') continue;
      const list = grouped.get(match.round_number) ?? [];
      list.push(match);
      grouped.set(match.round_number, list);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, items]) => ({ round, items: items.sort((a, b) => a.match_number - b.match_number) }));
  }, [matches]);

  async function loadMySquads() {
    if (!user?.id) {
      setMySquads([]);
      return;
    }
    try {
      setLoadingSquads(true);
      const squads = await fetchMySquads(user.id);
      setMySquads(squads);
    } catch (e) {
      console.error(e);
      setMySquads([]);
    } finally {
      setLoadingSquads(false);
    }
  }

  async function refresh() {
    if (!id) return;
    setLoading(true);
    try {
      const [t, regs, m] = await Promise.all([
        fetchTournamentById(id),
        fetchTournamentRegistrations(id),
        fetchTournamentMatches(id),
      ]);
      setTournament(t);
      setRegistrations(regs);
      setMatches(m);

      if (user?.id) {
        const [r] = await Promise.all([
          isUserOrSquadRegistered({ tournamentId: id, userId: user.id }),
          loadMySquads(),
        ]);
        setRegistered(r);
      } else {
        setRegistered(false);
        setMySquads([]);
      }
    } catch (e) {
      console.error(e);
      setTournament(null);
      setRegistrations([]);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    async function loadCode() {
      if (!tournament?.id || !tournament.is_private || !user?.id) {
        setPrivateCode(null);
        return;
      }
      try {
        const code = await getPrivateTournamentAccessCode({ tournamentId: tournament.id });
        setPrivateCode(code);
      } catch {
        setPrivateCode(null);
      }
    }
    void loadCode();
  }, [tournament?.id, tournament?.is_private, user?.id, registered, isHost]);

  async function runHostAction(actionKey: string, action: () => Promise<void>, successMessage: string) {
    try {
      setBusyAction(actionKey);
      await action();
      await refresh();
      toast.success(successMessage);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not complete action: ${e.message}` : 'Tournament action failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onJoinSolo() {
    if (!id || !user?.id) {
      toast.error('Please sign in first');
      return;
    }
    try {
      setBusyAction('join_solo');
      await registerForTournament({ tournamentId: id, userId: user.id });
      await refresh();
      setRegistered(true);
      setPickOpen(false);
      toast.success('Joined tournament!');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not join: ${e.message}` : 'Could not join tournament.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onJoinSquad(squadId: string) {
    if (!id || !user?.id) {
      toast.error('Please sign in first');
      return;
    }
    try {
      setBusyAction('join_squad');
      await registerSquadForTournament({ tournamentId: id, squadId });
      await refresh();
      setRegistered(true);
      setPickOpen(false);
      toast.success('Squad joined tournament!');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not join: ${e.message}` : 'Could not join tournament.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onLeaveTournament() {
    if (!id || !myRegistration) return;
    try {
      setBusyAction('leave');
      await unregisterFromTournament({
        tournamentId: id,
        squadId: myRegistration.entry_type === 'squad' ? myRegistration.squad_id : null,
      });
      await refresh();
      setRegistered(false);
      toast.success(myRegistration.entry_type === 'squad' ? 'Squad removed from tournament' : 'You left the tournament');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not leave: ${e.message}` : 'Could not leave tournament.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onJoinPressed() {
    if (!tournament) return;
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }
    if (joinDisabledReason) {
      toast.error(joinDisabledReason);
      return;
    }

    if (tournament.join_mode === 'solo') {
      await onJoinSolo();
      return;
    }

    if (mySquads.length === 0) {
      await loadMySquads();
    }
    setPickOpen(true);
  }

  async function copyPrivateCode() {
    if (!privateCode) return;
    try {
      await navigator.clipboard.writeText(privateCode);
      toast.success('Private code copied');
    } catch {
      toast.error('Could not copy code');
    }
  }

  function openScoreDialog(match: TournamentMatchDetailRow) {
    setSelectedMatch(match);
    setParticipant1Score(match.participant_1_score != null ? String(match.participant_1_score) : '');
    setParticipant2Score(match.participant_2_score != null ? String(match.participant_2_score) : '');
    setScoreOpen(true);
  }

  async function onStartMatch(matchId: string) {
    try {
      setBusyAction(`start_match_${matchId}`);
      await startTournamentMatch({ matchId });
      await refresh();
      toast.success('Match started');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not start match: ${e.message}` : 'Could not start match.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onSubmitMatchResult() {
    if (!selectedMatch) return;

    const p1 = Number(participant1Score);
    const p2 = Number(participant2Score);

    if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < 0 || p2 < 0) {
      toast.error('Enter valid non-negative scores');
      return;
    }

    if (p1 === p2) {
      toast.error('Scores cannot be tied');
      return;
    }

    try {
      setBusyAction(`submit_match_${selectedMatch.id}`);
      const result = await submitTournamentMatchResult({
        matchId: selectedMatch.id,
        participant1Score: p1,
        participant2Score: p2,
      });
      await refresh();
      setScoreOpen(false);
      setSelectedMatch(null);
      toast.success(result.tournament.status === 'completed' ? 'Match submitted. Tournament completed!' : 'Match result submitted');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not submit result: ${e.message}` : 'Could not submit result.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Tournament</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-5 max-w-3xl mx-auto space-y-4">
        {loading ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading tournament...</p>
          </div>
        ) : !tournament ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">Tournament not found</p>
            <p className="text-sm text-muted-foreground mt-1">It may have been deleted or you may not have access.</p>
          </div>
        ) : (
          <>
            <div className="glass-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center text-lg">
                  {(SPORTS as any)[tournament.sport]?.icon ?? '🏆'}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold truncate">{tournament.name}</p>
                    <span className="px-2 py-0.5 rounded-lg bg-secondary/60 text-xs">{tournamentStatusLabel(tournament.status)}</span>
                    {tournament.is_private ? <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-xs text-primary">Private</span> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{(SPORTS as any)[tournament.sport]?.label ?? tournament.sport}</p>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatWhen(tournament.starts_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{(tournament.location as any)?.areaName ?? (tournament.location as any)?.name ?? 'Location TBD'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{activeRegistrations}/{capacity || tournament.team_count} filled</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span>
                        {registrationLocked
                          ? `Registration closed ${formatCompact(tournament.registration_closes_at)}`
                          : `Registration open${tournament.registration_closes_at ? ` until ${formatCompact(tournament.registration_closes_at)}` : ''}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {tournament.status === 'completed' && championRegistration ? (
              <div className="glass-card p-5 bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tournament champion</p>
                    <p className="text-xl font-bold text-primary">{championRegistration.display_name}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {tournament.is_private && privateCode ? (
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Private access code</p>
                    <p className="text-sm text-muted-foreground">
                      Share this code with players you want to invite into the tournament.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={copyPrivateCode}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div className="rounded-xl border border-border/60 px-4 py-3 text-lg font-bold tracking-[0.3em]">
                  {privateCode}
                </div>
              </div>
            ) : null}

            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">Overview</p>
                  <p className="text-sm text-muted-foreground">
                    {tournament.format} • {tournament.series_type === 'best_of_3' ? 'Best of 3' : 'Single elimination'} • {tournament.join_mode}
                  </p>
                </div>
                <Trophy className="w-6 h-6 text-primary" />
              </div>

              {tournament.notes ? (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.notes}</div>
              ) : null}

              {registered && myRegistration ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm">
                    <p className="font-medium text-primary">You&apos;re in this tournament</p>
                    <p className="text-muted-foreground mt-1">
                      {myRegistration.entry_type === 'squad'
                        ? `${myRegistration.display_name} is registered as your squad entry.`
                        : 'Your solo entry is confirmed.'}
                    </p>
                  </div>
                  <Button className="w-full" variant="outline" onClick={onLeaveTournament} disabled={!!busyAction || !!leaveDisabledReason}>
                    <LogOut className="w-4 h-4 mr-2" />
                    {busyAction === 'leave' ? 'Leaving...' : leaveDisabledReason ? leaveDisabledReason : 'Leave tournament'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button className="w-full" onClick={onJoinPressed} disabled={!!busyAction || !!joinDisabledReason}>
                    <Users className="w-4 h-4 mr-2" />
                    {busyAction === 'join_solo' || busyAction === 'join_squad'
                      ? 'Joining...'
                      : joinDisabledReason ?? 'Join tournament'}
                  </Button>
                  {joinDisabledReason ? <p className="text-xs text-muted-foreground">{joinDisabledReason}</p> : null}
                </div>
              )}
            </div>

            {isHost ? (
              <div className="glass-card p-5 space-y-4">
                <div>
                  <p className="font-semibold">Host controls</p>
                  <p className="text-sm text-muted-foreground">Manage registration, seeding, bracket generation, and tournament state.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => runHostAction('seed_ranking', () => reseedTournament({ tournamentId: tournament.id, method: 'ranking' }).then(() => Promise.resolve()), 'Entrants seeded by ranking')}
                    disabled={!!busyAction || tournament.status !== 'scheduled'}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    {busyAction === 'seed_ranking' ? 'Seeding...' : 'Seed by ranking'}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => runHostAction('seed_random', () => reseedTournament({ tournamentId: tournament.id, method: 'random' }).then(() => Promise.resolve()), 'Entrants randomized')}
                    disabled={!!busyAction || tournament.status !== 'scheduled'}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    {busyAction === 'seed_random' ? 'Randomizing...' : 'Randomize seeds'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => runHostAction('lock', () => lockTournamentRegistration({ tournamentId: tournament.id }).then(() => Promise.resolve()), 'Registration locked')}
                    disabled={!!busyAction || tournament.status !== 'scheduled' || registrationLocked}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {busyAction === 'lock' ? 'Locking...' : 'Lock registration now'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => runHostAction('bracket', () => generateTournamentBracket({ tournamentId: tournament.id }).then(() => Promise.resolve()), 'Bracket generated')}
                    disabled={!!busyAction || tournament.status !== 'scheduled' || activeRegistrations < 2}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    {busyAction === 'bracket' ? 'Generating...' : 'Generate bracket'}
                  </Button>

                  <Button
                    onClick={() => runHostAction('start', () => startTournament({ tournamentId: tournament.id }).then(() => Promise.resolve()), 'Tournament started')}
                    disabled={!!busyAction || tournament.status !== 'scheduled' || activeRegistrations < 2}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {busyAction === 'start' ? 'Starting...' : 'Start tournament'}
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => setCancelOpen(true)}
                    disabled={!!busyAction || tournament.status === 'completed' || tournament.status === 'cancelled'}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Cancel tournament
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Entrants</p>
                  <p className="text-sm text-muted-foreground">Seeds are shown after the host runs seeding.</p>
                </div>
                <span className="text-sm text-muted-foreground">{activeRegistrations} registered</span>
              </div>

              {registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entrants yet.</p>
              ) : (
                <div className="space-y-2">
                  {registrations.map((entry) => {
                    const isMine = myRegistration?.id === entry.id;
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {entry.display_name}
                            {isMine ? <span className="ml-2 text-xs text-primary">• You</span> : null}
                          </p>
                          <p className="text-xs text-muted-foreground">{entry.entry_type === 'squad' ? 'Squad entry' : 'Solo entry'} • {entry.status}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{entry.seed ? `#${entry.seed}` : 'Unseeded'}</p>
                          <p className="text-xs text-muted-foreground">{formatCompact(entry.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Bracket preview</p>
                  <p className="text-sm text-muted-foreground">Start matches, submit scores, and watch winners advance automatically.</p>
                </div>
                <span className="text-sm text-muted-foreground">{matches.length} matches</span>
              </div>

              {bracketRounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bracket yet. The host can seed entrants and generate the bracket.</p>
              ) : (
                <div className="space-y-4">
                  {bracketRounds.map((round) => (
                    <div key={round.round} className="space-y-2">
                      <p className="text-sm font-semibold text-muted-foreground">{round.items[0]?.stage_label ?? `Round ${round.round}`}</p>
                      <div className="space-y-2">
                        {round.items.map((match) => {
                          const canManageMatch = isHost && tournament.status === 'active' && !['completed', 'cancelled'].includes(match.status);
                          const canStart = canManageMatch && match.status === 'ready';
                          const canSubmit = canManageMatch && ['ready', 'in_progress'].includes(match.status) && !!match.participant_1_registration_id && !!match.participant_2_registration_id;
                          const isP1Winner = !!match.winner_registration_id && match.winner_registration_id === match.participant_1_registration_id;
                          const isP2Winner = !!match.winner_registration_id && match.winner_registration_id === match.participant_2_registration_id;

                          return (
                            <div key={match.id} className="rounded-xl border border-border/60 p-3 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">Match {match.match_number}</p>
                                  <p className="text-xs text-muted-foreground">Best of {match.best_of}</p>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-lg bg-secondary/60">{matchStatusLabel(match.status)}</span>
                              </div>

                              <div className="space-y-2 text-sm">
                                <div className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 ${isP1Winner ? 'bg-primary/10' : 'bg-secondary/30'}`}>
                                  <span className="truncate font-medium">{match.participant_1_name ?? 'TBD'}</span>
                                  <span className="text-muted-foreground">{match.participant_1_score ?? '—'}</span>
                                </div>
                                <div className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 ${isP2Winner ? 'bg-primary/10' : 'bg-secondary/30'}`}>
                                  <span className="truncate font-medium">{match.participant_2_name ?? 'TBD'}</span>
                                  <span className="text-muted-foreground">{match.participant_2_score ?? '—'}</span>
                                </div>
                              </div>

                              {match.winner_name ? <p className="text-xs text-primary font-medium">Winner: {match.winner_name}</p> : null}

                              {canManageMatch ? (
                                <div className="flex flex-wrap gap-2">
                                  {canStart ? (
                                    <Button size="sm" variant="secondary" onClick={() => onStartMatch(match.id)} disabled={!!busyAction}>
                                      <Swords className="w-4 h-4 mr-2" />
                                      {busyAction === `start_match_${match.id}` ? 'Starting...' : 'Start match'}
                                    </Button>
                                  ) : null}
                                  {canSubmit ? (
                                    <Button size="sm" onClick={() => openScoreDialog(match)} disabled={!!busyAction}>
                                      <CheckCircle2 className="w-4 h-4 mr-2" />
                                      {busyAction === `submit_match_${match.id}` ? 'Submitting...' : 'Report result'}
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Dialog open={pickOpen} onOpenChange={setPickOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Join tournament</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  {canJoinAsSolo ? (
                    <Button className="w-full" variant="secondary" onClick={onJoinSolo} disabled={!!busyAction}>
                      Join as me
                    </Button>
                  ) : null}

                  {canJoinAsSquad ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Join with a squad</p>

                      {loadingSquads ? (
                        <div className="text-sm text-muted-foreground">Loading squads...</div>
                      ) : mySquads.length === 0 ? (
                        <div className="glass-card p-3 text-sm text-muted-foreground">
                          You don&apos;t have any squads yet. Create or join a squad first.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {mySquads.map((s) => (
                            <Button
                              key={s.id}
                              className="w-full justify-between"
                              variant="outline"
                              onClick={() => onJoinSquad(s.id)}
                              disabled={!!busyAction}
                            >
                              <span className="truncate">{s.name}</span>
                              <span className="text-xs text-muted-foreground">{s.member_count} members</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Submit match result</DialogTitle>
                </DialogHeader>
                {selectedMatch ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">{selectedMatch.participant_1_name ?? 'Participant 1'}</p>
                        <Input
                          inputMode="numeric"
                          type="number"
                          min="0"
                          value={participant1Score}
                          onChange={(e) => setParticipant1Score(e.target.value)}
                          placeholder="Score"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{selectedMatch.participant_2_name ?? 'Participant 2'}</p>
                        <Input
                          inputMode="numeric"
                          type="number"
                          min="0"
                          value={participant2Score}
                          onChange={(e) => setParticipant2Score(e.target.value)}
                          placeholder="Score"
                        />
                      </div>
                    </div>
                    <Button className="w-full" onClick={onSubmitMatchResult} disabled={!!busyAction}>
                      {busyAction === `submit_match_${selectedMatch.id}` ? 'Submitting...' : 'Submit result'}
                    </Button>
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>

            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Cancel tournament</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">This will cancel the tournament and mark any unfinished bracket matches as cancelled.</p>
                  <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Optional reason" />
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={!!busyAction}
                    onClick={() => {
                      void runHostAction(
                        'cancel',
                        () => cancelTournament({ tournamentId: tournament.id, reason: cancelReason.trim() || null }).then(() => Promise.resolve()),
                        'Tournament cancelled',
                      ).then(() => {
                        setCancelOpen(false);
                        setCancelReason('');
                      });
                    }}
                  >
                    {busyAction === 'cancel' ? 'Cancelling...' : 'Confirm cancellation'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  );
}
