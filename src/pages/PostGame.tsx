
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { mockUsers } from '@/data/mockData';
import { PostGameVoting } from '@/components/PostGameVoting';
import { submitPostGameVotes } from '@/lib/gamesApi';

function resolveUser(userId: string) {
  return mockUsers.find(m => m.id === userId);
}

const CATEGORY_LABELS: Record<string, string> = {
  best_shooter: 'Best Shooter',
  best_passer: 'Best Passer',
  best_all_around: 'Best All-Around',
  best_scorer: 'Best Scorer',
  best_defender: 'Best Defender',
};

export default function PostGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, setGames, user } = useApp();
  const [busy, setBusy] = useState(false);

  const game = games.find(g => g.id === id);

  const players = useMemo(() => {
    if (!game) return [];
    const ids = (game.checkedInIds?.length ? game.checkedInIds : game.playerIds) ?? [];
    const resolved = ids.map(pid => resolveUser(pid)).filter(Boolean) as any[];
    return resolved;
  }, [game]);

  const hasVotedAll = useMemo(() => {
    if (!game || !user) return false;
    const rec = game.postGameVoters?.[user.id] ?? {};
    const needed = Object.keys(CATEGORY_LABELS);
    return needed.every(k => !!(rec as any)[k]);
  }, [game, user]);

  const voteResults = useMemo(() => {
    if (!game?.postGameVotes) return null;
    const results: Record<string, { userId: string; count: number } | null> = {};
    for (const [cat, bucket] of Object.entries(game.postGameVotes as any)) {
      const entries = Object.entries(bucket as Record<string, number>);
      if (entries.length === 0) {
        results[cat] = null;
        continue;
      }
      entries.sort((a, b) => b[1] - a[1]);
      results[cat] = { userId: entries[0][0], count: entries[0][1] };
    }
    return results;
  }, [game]);

  const handleVoteComplete = async (votes: { category: string; votedUserId: string }[]) => {
    if (!user || !game) {
      toast.error('Please sign in first.');
      return;
    }
    try {
      setBusy(true);
      const updated = await submitPostGameVotes(game.id, user.id, votes as any);
      setGames(games.map(g => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Votes submitted.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit votes.';
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
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Postgame</span>
          </div>
          <div className="w-[72px]" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <section className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="text-lg font-bold text-foreground">{game.title}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Vote on who stood out. Results update as people submit.
          </div>
        </section>

        {!!user ? (
          <section className="rounded-2xl border border-border/50 bg-card p-5">
            <PostGameVoting
              game={game}
              players={players}
              currentUserId={user.id}
              onVoteComplete={handleVoteComplete}
            />
            {busy && <div className="text-xs text-muted-foreground mt-2">Saving...</div>}
            {hasVotedAll && (
              <div className="text-sm text-muted-foreground mt-3">
                You have already voted in all categories.
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="text-sm text-muted-foreground">Please sign in to vote.</div>
          </section>
        )}

        <section className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="font-semibold text-foreground">Current leaders</div>
          <div className="mt-3 space-y-2">
            {!voteResults ? (
              <div className="text-sm text-muted-foreground">No votes yet.</div>
            ) : (
              Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                const winner = (voteResults as any)[cat] as { userId: string; count: number } | null;
                const name = winner ? (resolveUser(winner.userId)?.username ?? `Player ${winner.userId}`) : 'No votes';
                const count = winner ? winner.count : 0;
                return (
                  <div key={cat} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    <div className="text-sm text-muted-foreground">{name}{winner ? ` (${count})` : ''}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
