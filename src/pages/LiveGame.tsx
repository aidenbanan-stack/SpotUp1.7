
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { SportBadge } from '@/components/SportIcon';
import { ArrowLeft, Users, CheckCircle2, Clock, Play, Pause, Flag, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { mockUsers } from '@/data/mockData';
import { endGame, setRunsStarted, toggleCheckIn } from '@/lib/gamesApi';

function resolveName(userId: string) {
  const u = mockUsers.find(m => m.id === userId);
  return u?.username ?? `Player ${userId}`;
}

export default function LiveGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, setGames, user } = useApp();
  const [busy, setBusy] = useState(false);

  const game = games.find(g => g.id === id);

  const isHost = useMemo(() => !!user && !!game && game.hostId === user.id, [user, game]);
  const isJoined = useMemo(() => !!user && !!game && game.playerIds.includes(user.id), [user, game]);
  const isCheckedIn = useMemo(() => !!user && !!game && game.checkedInIds.includes(user.id), [user, game]);

  const checkedInIds = game?.checkedInIds ?? [];
  const signedUpIds = game?.playerIds ?? [];
  const pendingIds = game?.pendingRequestIds ?? [];
  const notCheckedInIds = signedUpIds.filter(pid => !checkedInIds.includes(pid));

  const handleCheckInToggle = async () => {
    if (!user || !game) {
      toast.error('Please sign in first.');
      return;
    }
    if (!isJoined && !isHost) {
      toast.error('You need to be signed up to check in.');
      return;
    }
    try {
      setBusy(true);
      const updated = await toggleCheckIn(game.id, user.id, !isCheckedIn);
      setGames(games.map(g => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success(!isCheckedIn ? 'Checked in!' : 'Check-in removed.');
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
      toast.success('Game ended. Postgame voting is open.');
      navigate(`/game/${game.id}/postgame`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to end game.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="rounded-2xl border border-border/50 p-5 bg-card">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-semibold">Game not found</div>
                <div className="text-sm text-muted-foreground">It may have been deleted or you followed an invalid link.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(`/game/${game.id}`)} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Game
          </Button>
          <div className="flex items-center gap-2">
            <SportBadge sport={game.sport} />
            <span className="text-sm font-medium text-foreground">Live</span>
          </div>
          <div className="w-[72px]" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <section className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-lg font-bold text-foreground">{game.title}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {game.runsStarted ? 'Runs started' : 'Runs not started'}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {isHost ? (
                <Button onClick={handleRunsToggle} disabled={busy} variant={game.runsStarted ? 'secondary' : 'hero'} className="gap-2">
                  {game.runsStarted ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {game.runsStarted ? 'Pause runs' : 'Start runs'}
                </Button>
              ) : (
                <Button onClick={handleCheckInToggle} disabled={busy || (!isJoined && !isHost)} variant={isCheckedIn ? 'secondary' : 'hero'} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {isCheckedIn ? 'Checked in' : 'Check in'}
                </Button>
              )}

              {isHost && (
                <Button onClick={handleEndGame} disabled={busy} variant="destructive" className="gap-2">
                  <Flag className="w-4 h-4" />
                  End game
                </Button>
              )}
            </div>
          </div>

          {!isHost && !isJoined && (
            <div className="mt-4 text-sm text-muted-foreground">
              You are not signed up for this game yet. Join from the Game page to check in.
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Checked in
              </div>
              <div className="text-sm text-muted-foreground">{checkedInIds.length}</div>
            </div>

            <div className="mt-3 space-y-2">
              {checkedInIds.length === 0 ? (
                <div className="text-sm text-muted-foreground">No one has checked in yet.</div>
              ) : (
                checkedInIds.map(pid => (
                  <div key={pid} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">{resolveName(pid)}</div>
                    <span className="text-xs text-muted-foreground">Arrived</span>
                  </div>
                ))
              )}
            </div>

            {isHost && (
              <div className="mt-4">
                <Button onClick={handleCheckInToggle} disabled={busy} variant={isCheckedIn ? 'secondary' : 'hero'} className="w-full gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {isCheckedIn ? 'Remove my check-in' : 'Check in as host'}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Signed up, not joined yet
              </div>
              <div className="text-sm text-muted-foreground">{notCheckedInIds.length}</div>
            </div>

            <div className="mt-3 space-y-2">
              {notCheckedInIds.length === 0 ? (
                <div className="text-sm text-muted-foreground">Everyone signed up has checked in.</div>
              ) : (
                notCheckedInIds.map(pid => (
                  <div key={pid} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">{resolveName(pid)}</div>
                    <span className="text-xs text-muted-foreground">Not here</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {game.isPrivate && pendingIds.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pending requests
                </div>
                <div className="text-sm text-muted-foreground">{pendingIds.length}</div>
              </div>

              <div className="mt-3 space-y-2">
                {pendingIds.map(pid => (
                  <div key={pid} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">{resolveName(pid)}</div>
                    <span className="text-xs text-muted-foreground">Awaiting approval</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
