import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GameCard } from '@/components/GameCard';
import { useApp } from '@/context/AppContext';
import { ArrowLeft } from 'lucide-react';

export default function GameHistory() {
  const navigate = useNavigate();
  const { user, games } = useApp();

  const myGames = useMemo(() => {
    if (!user) return [];
    return games
      .filter(g => g.playerIds.includes(user.id) || g.hostId === user.id)
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  }, [games, user]);

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Game History</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-4">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">
            This replaces the old “My Games” button. It shows every game you hosted or joined.
          </p>
        </div>

        {myGames.length > 0 ? (
          <div className="space-y-3">
            {myGames.map(game => (
              <GameCard key={game.id} game={game} variant="compact" onClick={() => navigate(`/game/${game.id}`)} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground mb-4">No games yet</p>
            <Button onClick={() => navigate('/create-game')}>Host your first game</Button>
          </div>
        )}
      </main>
    </div>
  );
}
