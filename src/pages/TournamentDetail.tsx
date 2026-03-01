import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Lock, Trophy, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { SPORTS } from '@/types';
import {
  fetchTournamentById,
  isUserRegistered,
  registerForTournament,
  type TournamentRow,
} from '@/lib/tournamentsApi';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function TournamentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

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
          const r = await isUserRegistered({ tournamentId: id, userId: user.id });
          if (!cancelled) setRegistered(r);
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

  async function onRegister() {
    if (!id || !user?.id) return;
    try {
      setBusy(true);
      await registerForTournament({ tournamentId: id, userId: user.id });
      setRegistered(true);
    } catch (e) {
      console.error(e);
      alert('Could not register. Check Supabase tables / RLS.');
    } finally {
      setBusy(false);
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
                      <span>{(tournament.location as any)?.areaName ?? 'Location TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Trophy className="w-4 h-4" />
                      <span>
                        {tournament.format} · {tournament.series_type} · {tournament.team_count} teams · {tournament.points_style}
                      </span>
                    </div>
                    {tournament.is_private ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Lock className="w-4 h-4" />
                        <span>Private</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {tournament.notes ? (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{tournament.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <p className="font-semibold">Registration</p>
              </div>

              <p className="text-sm text-muted-foreground mt-2">
                Registering reserves your spot for updates. Brackets and teams will appear here once added.
              </p>

              {!user?.id ? (
                <Button className="w-full mt-4 h-12" onClick={() => navigate('/')} disabled>
                  Sign in to register
                </Button>
              ) : registered ? (
                <Button className="w-full mt-4 h-12" variant="secondary" disabled>
                  Registered ✓
                </Button>
              ) : (
                <Button className="w-full mt-4 h-12" onClick={onRegister} disabled={busy}>
                  Register
                </Button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
