import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GameCard } from '@/components/GameCard';
import { useApp } from '@/context/AppContext';
import { ArrowLeft } from 'lucide-react';

type Tab = 'scheduled' | 'active' | 'concluded';

export default function GameHistory() {
  const navigate = useNavigate();
  const { user, games } = useApp();

  const [tab, setTab] = useState<Tab>('scheduled');

  const myGames = useMemo(() => {
    if (!user) return [];
    return games
      .filter(g => g.playerIds.includes(user.id) || g.hostId === user.id)
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  }, [games, user]);

  const filteredMyGames = useMemo(() => {
    if (tab === 'scheduled') return myGames.filter(g => g.status === 'scheduled');

    if (tab === 'concluded') {
      // Concluded: finished games where voting is present (best-effort proxy for "finalized").
      return myGames.filter(g => g.status === 'finished' && !!g.postGameVotes && !!g.postGameVoters);
    }

    // Active: live games, plus finished games where voting is not finalized yet.
    return myGames.filter(g => g.status === 'live' || (g.status === 'finished' && (!g.postGameVotes || !g.postGameVoters)));
  }, [myGames, tab]);

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">My Games</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">
            View games you hosted or joined, separated into Scheduled, Active, and Concluded.
          </p>
        </div>

        <div className="glass-card p-3 flex gap-2">
          <button
            onClick={() => setTab('scheduled')}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold ${tab === 'scheduled' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground'}`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setTab('active')}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold ${tab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground'}`}
          >
            Active
          </button>
          <button
            onClick={() => setTab('concluded')}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold ${tab === 'concluded' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground'}`}
          >
            Concluded
          </button>
        </div>

        {filteredMyGames.length > 0 ? (
          <div className="space-y-3">
            {filteredMyGames.map(game => (
              <GameCard key={game.id} game={game} variant="compact" onClick={() => navigate(`/game/${game.id}`)} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground mb-4">No games in this section</p>
            <Button onClick={() => navigate('/create-game')}>Host a game</Button>
          </div>
        )}
      </main>
    </div>
  );
}
