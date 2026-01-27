import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { SportSelector } from '@/components/SportSelector';
import { GameCard } from '@/components/GameCard';
import { XPRoadDialog } from '@/components/XPRoadDialog';
import { Bell, MapPin, Plus, Trophy, Users, History, MessageCircle, Users2 } from 'lucide-react';
import spotupLogo from '@/assets/spotup-logo.png';

export default function Home() {
  const navigate = useNavigate();
  const { user, selectedSport, setSelectedSport, games, unreadCount, gamesLoading, gamesError, refreshGames } = useApp();

  const [xpOpen, setXpOpen] = useState(false);

  const filteredGames = selectedSport === 'all' 
    ? games 
    : games.filter(g => g.sport === selectedSport);

  const upcomingGames = filteredGames
    .filter(g => g.dateTime > new Date())
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
    .slice(0, 3);

  const headerXP = useMemo(() => user?.xp ?? 0, [user?.xp]);

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={spotupLogo} alt="SpotUp" className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="text-xl font-bold text-foreground">SpotUp</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* XP Road */}
            <button
              onClick={() => setXpOpen(true)}
              className="px-3 py-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors flex items-center gap-2"
              aria-label="Open XP Road"
            >
              <Trophy className="w-5 h-5 text-foreground" />
              <span className="text-sm font-semibold text-foreground hidden sm:inline">{headerXP.toLocaleString()} XP</span>
            </button>

            {/* Friends */}
            <button
              onClick={() => navigate('/friends')}
              className="p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Friends"
            >
              <Users className="w-5 h-5 text-foreground" />
            </button>

            {/* Game History */}
            <button
              onClick={() => navigate('/history')}
              className="p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Game history"
            >
              <History className="w-5 h-5 text-foreground" />
            </button>

            {/* Messages */}
            <button
              onClick={() => navigate('/messages')}
              className="p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Messages"
            >
              <MessageCircle className="w-5 h-5 text-foreground" />
            </button>

            {/* Squads */}
            <button
              onClick={() => navigate('/squads')}
              className="p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Squads"
            >
              <Users2 className="w-5 h-5 text-foreground" />
            </button>

            {/* Notifications */}
            <button 
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <XPRoadDialog open={xpOpen} onOpenChange={setXpOpen} />

      <main className="px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <section className="animate-fade-in">
          <p className="text-muted-foreground mb-1">Welcome back,</p>
          <h2 className="text-2xl font-bold text-foreground">{user?.username} 👋</h2>
        </section>

        {/* Sport Selector */}
        <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">BROWSE BY SPORT</h3>
          <SportSelector
            selected={selectedSport}
            onChange={setSelectedSport}
            showAll
          />
        </section>

        {/* Action Buttons */}
        <section className="grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <Button
            variant="hero"
            size="xl"
            className="flex-col h-auto py-6"
            onClick={() => navigate('/map')}
          >
            <MapPin className="w-6 h-6 mb-1" />
            <span>Find Games</span>
          </Button>
          <Button
            variant="glass"
            size="xl"
            className="flex-col h-auto py-6 border-primary/30"
            onClick={() => navigate('/create-game')}
          >
            <Plus className="w-6 h-6 mb-1" />
            <span>Host a Game</span>
          </Button>
        </section>

        {/* Upcoming Games */}
        <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              UPCOMING GAMES NEAR YOU
            </h3>
            <Button variant="link" size="sm" onClick={() => navigate('/map')}>
              See all
            </Button>
          </div>

          {gamesLoading && (
            <div className="glass-card p-4 text-sm text-muted-foreground mb-3">
              Loading games...
            </div>
          )}

          {gamesError && (
            <div className="glass-card p-4 text-sm mb-3">
              <p className="text-destructive font-medium mb-2">Could not load games from Supabase.</p>
              <p className="text-muted-foreground break-words">{gamesError}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refreshGames()}>
                Retry
              </Button>
            </div>
          )}

          {upcomingGames.length > 0 ? (
            <div className="space-y-3">
              {upcomingGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  variant="compact"
                  onClick={() => navigate(`/game/${game.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground mb-4">No upcoming games found</p>
              <Button variant="default" onClick={() => navigate('/create-game')}>
                Be the first to host!
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
