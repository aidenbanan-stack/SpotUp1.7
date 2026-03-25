import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { SportBadge } from '@/components/SportIcon';
import { ArrowLeft, Users, CheckCircle2, Clock, Play, Pause, Flag, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { endGame, fetchGameById, setRunsStarted, toggleCheckIn } from '@/lib/gamesApi';
import { supabase } from '@/lib/supabaseClient';

export default function LiveGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, setGames, user } = useApp();
  const [busy, setBusy] = useState(false);

  const game = games.find(g => g.id === id);

  const isHost = useMemo(() => !!user && !!game && game.hostId === user.id, [user, game]);

  // Realtime: when host ends game, everyone gets the update
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`game:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` },
        async () => {
          try {
            const fresh = await fetchGameById(id);
            setGames(prev => prev.map(g => (g.id === id ? fresh : g)));
          } catch {
            // ignore
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, setGames]);

  const checkedInIds = game?.checkedInIds ?? [];
  const signedUpIds = game?.playerIds ?? [];
  const notCheckedInIds = signedUpIds.filter(pid => !checkedInIds.includes(pid));

  const resolveName = (userId: string) => {
    const u = game?.players?.find(p => p.id === userId);
    return u?.username ?? 'Player';
  };

  const handleCheckInToggle = async (targetUserId: string) => {
    if (!user || !game) {
      toast.error('Please sign in first.');
      return;
    }
    if (!isHost) {
      toast.error('Only the host can check players in.');
      return;
    }

    const targetIsCheckedIn = game.checkedInIds.includes(targetUserId);

    try {
      setBusy(true);
      const updated = await toggleCheckIn(game.id, targetUserId);
      setGames(games.map(g => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success(targetIsCheckedIn ? 'Check-in removed.' : 'Player checked in.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update check-in.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRunsToggle = async () => {
    if (!user || !game || !isHost) return;
    try {
      setBusy(true);
      const updated = await setRunsStarted(game.id, !game.runsStarted);
      setGames(games.map(g => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success(!game.runsStarted ? 'Runs started.' : 'Runs paused.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update runs.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEndGame = async () => {
    if (!user || !game || !isHost) return;
    try {
      setBusy(true);
      const updated = await endGame(game.id);
      setGames(games.map(g => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Game ended. Postgame voting is open.');      navigate(`/game/${game.id}/postgame`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to end game.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-background p-6 safe-top">
        <div className="max-w-lg mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-muted-foreground" />
            <p className="mt-2 font-semibold">Game not found</p>
            <p className="text-sm text-muted-foreground mt-1">It may have been deleted.</p>
          </div>
        </div>
      </div>
    );
  }

  const showPostGameCTA = game.status === 'finished' || game.status === 'completed';

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <SportBadge sport={game.sport} />
            <h1 className="text-lg font-bold truncate">{game.title}</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {showPostGameCTA && (
          <div className="glass-card p-4">
            <p className="font-semibold text-foreground">Game ended</p>
            <p className="text-sm text-muted-foreground mt-1">
              Postgame voting is open for everyone who played.
            </p>
            <Button
              className="mt-3 w-full"
              variant="hero"
              onClick={() => navigate(`/game/${game.id}/postgame`)}
            >
              Go to voting
            </Button>
          </div>
        )}

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground">Status</p>
            <p className="text-sm text-muted-foreground">
              {game.status === 'live' ? 'Live' : game.status === 'finished' || game.status === 'completed' ? 'Finished' : 'Scheduled'}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-foreground">Check-in</p>
            {isHost ? (
              <span className="text-sm text-muted-foreground">Use the player list below to check players in.</span>
            ) : (
              <span className="text-sm text-muted-foreground">The host must check you in when you arrive.</span>
            )}
          </div>

          {isHost && (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={handleRunsToggle} disabled={busy}>
                {game.runsStarted ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {game.runsStarted ? 'Pause runs' : 'Start runs'}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleEndGame} disabled={busy || game.status === 'finished' || game.status === 'completed'}>
                <Flag className="w-4 h-4 mr-2" />
                End game
              </Button>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" />
            <p className="font-semibold">Checked in ({checkedInIds.length})</p>
          </div>
          {checkedInIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one checked in yet.</p>
          ) : (
            <div className="space-y-2">
              {checkedInIds.map(pid => (
                <div key={pid} className="flex items-center justify-between gap-3">
                  <p className="text-sm">{resolveName(pid)}</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {isHost && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleCheckInToggle(pid)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <p className="font-semibold mb-3">Not checked in ({notCheckedInIds.length})</p>
          {notCheckedInIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is checked in.</p>
          ) : (
            <div className="space-y-2">
              {notCheckedInIds.map(pid => (
                <div key={pid} className="text-sm text-muted-foreground">
                  {resolveName(pid)}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
