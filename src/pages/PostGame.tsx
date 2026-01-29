import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { mockUsers } from '@/data/mockData';
import { PostGameVoting } from '@/components/PostGameVoting';
import { submitPostGameVotes } from '@/lib/gamesApi';

function resolveUser(userId) {
  return mockUsers.find((m) => m.id === userId);
}

const CATEGORY_LABELS = {
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

  const game = games.find((g) => g.id === id);

  const players = useMemo(() => {
    if (!game) return [];
    const ids = (game.checkedInIds?.length ? game.checkedInIds : game.playerIds) ?? [];
    const resolved = ids.map((pid) => resolveUser(pid)).filter(Boolean);
    return resolved;
  }, [game]);

  const hasVotedAll = useMemo(() => {
    if (!game || !user) return false;
    const rec = (game.postGameVoters && game.postGameVoters[user.id]) ? game.postGameVoters[user.id] : {};
    const needed = Object.keys(CATEGORY_LABELS);
    return needed.every((k) => !!rec[k]);
  }, [game, user]);

  const voteResults = useMemo(() => {
    if (!game || !game.postGameVotes) return null;

    const results = {};
    for (const [cat, bucket] of Object.entries(game.postGameVotes)) {
      const entries = Object.entries(bucket || {});
      if (!entries.length) {
        results[cat] = null;
        continue;
      }
      entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
      results[cat] = { userId: entries[0][0], count: entries[0][1] };
    }
    return results;
  }, [game]);

  const handleVoteComplete = async (votes) => {
    if (!user || !game) {
      toast.error('Please sign in first.');
      return;
    }
    try {
      setBusy(true);
      const updated = await submitPostGameVotes(game.id, user.id, votes);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
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
                <div className="text-sm text-muted-foreground">
                  It may have been deleted or you followed an invalid link.
                </div>
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
            Vote for players who stood out in each category.
          </div>
        </section>

        <PostGameVoting
          players={players}
          categoryLabels={CATEGORY_LABELS}
          hasVotedAll={hasVotedAll}
          voteResults={voteResults}
          onVoteComplete={handleVoteComplete}
          disabled={busy}
        />
      </main>
    </div>
  );
}
