import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Lock, Trophy, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SPORTS } from '@/types';
import {
  fetchTournamentById,
  isUserOrSquadRegistered,
  registerForTournament,
  registerSquadForTournament,
  type TournamentRow,
} from '@/lib/tournamentsApi';
import { fetchMySquads, type SquadWithMeta } from '@/lib/squadsApi';
import { toast } from 'sonner';

function formatWhen(iso: string): string {
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

export default function TournamentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  const [pickOpen, setPickOpen] = useState(false);
  const [mySquads, setMySquads] = useState<SquadWithMeta[]>([]);
  const [loadingSquads, setLoadingSquads] = useState(false);

  const canJoinAsSquad = useMemo(() => {
    return tournament?.join_mode === 'squad' || tournament?.join_mode === 'either';
  }, [tournament?.join_mode]);

  const canJoinAsSolo = useMemo(() => {
    return tournament?.join_mode === 'solo' || tournament?.join_mode === 'either';
  }, [tournament?.join_mode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const t = await fetchTournamentById(id);
        if (cancelled) return;
        setTournament(t);

        if (user?.id) {
          const r = await isUserOrSquadRegistered({ tournamentId: id, userId: user.id });
          if (!cancelled) setRegistered(r);
        } else {
          if (!cancelled) setRegistered(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setTournament(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  async function loadSquadsIfNeeded() {
    if (!user?.id) return;
    if (mySquads.length > 0) return;

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

  async function onJoinSolo() {
    if (!id) return;
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }
    try {
      setBusy(true);
      await registerForTournament({ tournamentId: id, userId: user.id });
      setRegistered(true);
      toast.success('Joined tournament!');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not join: ${e.message}` : 'Could not join. Check Supabase tables / RLS.');
    } finally {
      setBusy(false);
    }
  }

  async function onJoinSquad(squadId: string) {
    if (!id) return;
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }
    try {
      setBusy(true);
      await registerSquadForTournament({ tournamentId: id, squadId });
      setRegistered(true);
      setPickOpen(false);
      toast.success('Squad joined tournament!');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not join: ${e.message}` : 'Could not join. Check Supabase tables / RLS.');
    } finally {
      setBusy(false);
    }
  }

  async function onJoinPressed() {
    if (!tournament) return;
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }

    // If only solo
    if (tournament.join_mode === 'solo') {
      await onJoinSolo();
      return;
    }

    // If only squad
    if (tournament.join_mode === 'squad') {
      await loadSquadsIfNeeded();
      setPickOpen(true);
      return;
    }

    // Either: open picker with both options
    await loadSquadsIfNeeded();
    setPickOpen(true);
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

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">
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
                  <p className="text-lg font-bold truncate">{tournament.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(SPORTS as any)[tournament.sport]?.label ?? tournament.sport}
                  </p>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatWhen(tournament.starts_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {(tournament.location as any)?.areaName ?? (tournament.location as any)?.name ?? 'Location TBD'}
                      </span>
                    </div>

                    {tournament.is_private ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Lock className="w-4 h-4" />
                        <span>Private tournament</span>
                      </div>
                    ) : null}

                    {tournament.join_mode !== 'solo' ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>
                          {tournament.join_mode === 'squad' ? 'Squad tournament' : 'Join as a squad or as yourself'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Teams</p>
                  <p className="text-sm text-muted-foreground">{tournament.team_count} total</p>
                </div>

                <Trophy className="w-6 h-6 text-primary" />
              </div>

              {tournament.notes ? (
                <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{tournament.notes}</div>
              ) : null}

              <div className="mt-5">
                {registered ? (
                  <Button className="w-full" disabled>
                    <Users className="w-4 h-4 mr-2" />
                    You&apos;re registered
                  </Button>
                ) : (
                  <Button className="w-full" onClick={onJoinPressed} disabled={busy}>
                    <Users className="w-4 h-4 mr-2" />
                    {busy ? 'Joining...' : 'Join tournament'}
                  </Button>
                )}
              </div>
            </div>

            <Dialog open={pickOpen} onOpenChange={setPickOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Join tournament</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  {canJoinAsSolo ? (
                    <Button className="w-full" variant="secondary" onClick={onJoinSolo} disabled={busy}>
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
                              disabled={busy}
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
          </>
        )}
      </main>
    </div>
  );
}
