import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { SportSelector } from '@/components/SportSelector';
import { GameCard } from '@/components/GameCard';
import { XPRoadDialog } from '@/components/XPRoadDialog';
import { Bell, MapPin, Plus, User, History, MessageCircle, Users2 } from 'lucide-react';
import spotupLogo from '@/assets/spotup-logo.png';

export default function Home() {
  const navigate = useNavigate();
  const { user, selectedSport, setSelectedSport, games, unreadCount, gamesLoading, gamesError, refreshGames } = useApp();

  const [xpOpen, setXpOpen] = useState(false);

  const filteredGames = selectedSport === 'all'
    ? games
    : games.filter(g => g.sport === selectedSport);

  const upcomingGames = filteredGames
    .filter(g => g.status === 'scheduled')
    .sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));

  const liveGames = filteredGames
    .filter(g => g.status === 'live')
    .sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));

  const headerXP = useMemo(() => user?.xp ?? 0, [user?.xp]);

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={spotupLogo} alt="SpotUp" className="w-10 h-10 rounded-xl shrink-0" />
            <h1 className="text-xl font-bold text-foreground truncate">SpotUp</h1>
          </div>

          {/* Make header actions scrollable on mobile so they never overlap */}
          <div className="flex items-center gap-2 max-w-[65vw] overflow-x-auto no-scrollbar">
            {/* XP Road: remove Trophy icon, show just number + XP */}
            <button
              onClick={() => setXpOpen(true)}
              className="shrink-0 px-3 py-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Open XP Road"
            >
              <span className="text-sm font-semibold text-foreground">
                {headerXP.toLocaleString()} XP
              </span>
            </button>

            {/* Squads */}
            <button
              onClick={() => navigate('/squads')}
              className="shrink-0 p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Squads"
            >
              <Users2 className="w-5 h-5 text-foreground" />
            </button>

            {/* Friends: use different icon than Squads */}
            <button
              onClick={() => navigate('/friends')}
              className="shrink-0 p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Friends"
            >
              <User className="w-5 h-5 text-foreground" />
            </button>

            {/* Messages */}
            <button
              onClick={() => navigate('/messages')}
              className="shrink-0 p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Messages"
            >
              <MessageCircle className="w-5 h-5 text-foreground" />
            </button>

            {/* History */}
            <button
              onClick={() => navigate('/history')}
              className="shrink-0 p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
              aria-label="Game History"
            >
              <History className="w-5 h-5 text-foreground" />
            </button>

            {/* Notifications */}
            <button
              onClick={() => navigate('/notifications')}
              className="shrink-0 p-2 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <SportSelector value={selectedSport} onChange={setSelectedSport} />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/map')}
              className="rounded-xl"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Map
            </Button>
            <Button
              variant="hero"
              onClick={() => navigate('/create')}
              className="rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Host
            </Button>
          </div>
        </div>

        {gamesError && (
          <div className="glass-card p-4">
            <p className="text-sm text-destructive">{gamesError}</p>
            <Button variant="secondary" className="mt-3" onClick={refreshGames}>
              Retry
            </Button>
          </div>
        )}

        {gamesLoading ? (
          <div className="text-muted-foreground text-sm">Loading games…</div>
        ) : (
          <>
            {liveGames.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-bold">Live Now</h2>
                <div className="grid gap-3">
                  {liveGames.map(g => (
                    <GameCard key={g.id} game={g} />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-lg font-bold">Upcoming</h2>
              {upcomingGames.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <p className="font-semibold">No games yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tap Host to create one.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {upcomingGames.map(g => (
                    <GameCard key={g.id} game={g} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <XPRoadDialog open={xpOpen} onOpenChange={setXpOpen} />
    </div>
  );
}
