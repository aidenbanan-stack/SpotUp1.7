import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { SportSelector } from '@/components/SportSelector';
import { GameCard } from '@/components/GameCard';
import { GoogleMap } from '@/components/GoogleMap';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Filter, Navigation, X, Key } from 'lucide-react';
import { Game, SkillLevel, SKILL_LEVELS } from '@/types';
import { hasGoogleMapsKey } from '@/lib/env';

export default function MapView() {
  const navigate = useNavigate();
  const { selectedSport, setSelectedSport, games } = useApp();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [skillFilter, setSkillFilter] = useState<SkillLevel | 'all'>('all');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      if (selectedSport !== 'all' && game.sport !== selectedSport) return false;
      if (skillFilter !== 'all' && game.skillRequirement !== skillFilter) return false;
      if (privacyFilter === 'public' && game.isPrivate) return false;
      if (privacyFilter === 'private' && !game.isPrivate) return false;
      return true;
    });
  }, [games, selectedSport, skillFilter, privacyFilter]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background via-background/95 to-transparent">
        <div className="px-4 py-3 safe-top">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-xl bg-secondary/80 backdrop-blur-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold flex-1">Find Games</h1>
            <button
              onClick={() => setShowFilters(true)}
              className="p-2 rounded-xl bg-secondary/80 backdrop-blur-sm relative"
            >
              <Filter className="w-5 h-5" />
              {(skillFilter !== 'all' || privacyFilter !== 'all') && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />
              )}
            </button>
          </div>
          <SportSelector
            selected={selectedSport}
            onChange={setSelectedSport}
            showAll
          />
        </div>
      </header>

      {/* Map Area */}
      <div className="relative h-screen pt-32">
        {!hasGoogleMapsKey ? (
          /* API Key Missing */
          <div className="flex flex-col items-center justify-center h-full px-6 bg-secondary/30">
            <div className="glass-card p-6 w-full max-w-md space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <Key className="w-6 h-6" />
                <h2 className="text-lg font-bold">Google Maps Not Configured</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                This app uses a single Google Maps key for all users. To enable maps, set{' '}
                <span className="font-mono">VITE_GOOGLE_MAPS_API_KEY</span> in your deployment environment
                (for Vercel: Project Settings → Environment Variables) and redeploy.
              </p>
              <div className="text-xs text-muted-foreground bg-secondary/60 rounded-lg p-3">
                Tip: keep the key restricted in Google Cloud by HTTP referrers and enabled APIs (Maps JavaScript, Places).
              </div>
            </div>
          </div>
        ) : (
          /* Google Map */
          <div className="absolute inset-0 pt-32">
            <GoogleMap
              games={filteredGames}
              selectedGame={selectedGame}
              onGameSelect={setSelectedGame}
            />
            
            {/* Locate me button */}
            <button className="absolute bottom-32 right-4 p-3 bg-card rounded-xl shadow-card border border-border/50 z-30">
              <Navigation className="w-5 h-5 text-primary" />
            </button>

            {/* Game count badge */}
            <div className="absolute bottom-32 left-4 glass-card px-4 py-2 z-30">
              <p className="text-sm">
                <span className="font-bold text-primary">{filteredGames.length}</span>
                <span className="text-muted-foreground"> games nearby</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Game Detail Sheet */}
      <Sheet open={!!selectedGame} onOpenChange={() => setSelectedGame(null)}>
        <SheetContent side="bottom" className="bg-card border-border/50 rounded-t-3xl max-h-[70vh]">
          <SheetHeader className="sr-only">
            <SheetTitle>Game Details</SheetTitle>
          </SheetHeader>
          {selectedGame && (
            <div className="py-2">
              <GameCard game={selectedGame} />
              <div className="flex gap-3 mt-4">
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={() => navigate(`/game/${selectedGame.id}`)}
                >
                  {selectedGame.isPrivate ? 'Request to Join' : 'Join Game'}
                </Button>
                <Button variant="outline" onClick={() => setSelectedGame(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Filters Sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="bottom" className="bg-card border-border/50 rounded-t-3xl">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Filters</SheetTitle>
              <button onClick={() => setShowFilters(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </SheetHeader>
          <div className="py-6 space-y-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Skill Level
              </label>
              <Select value={skillFilter} onValueChange={(v) => setSkillFilter(v as any)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {SKILL_LEVELS.map(level => (
                    <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Privacy
              </label>
              <div className="flex gap-2">
                {(['all', 'public', 'private'] as const).map(option => (
                  <Button
                    key={option}
                    variant={privacyFilter === option ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrivacyFilter(option)}
                    className="flex-1 capitalize"
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSkillFilter('all');
                  setPrivacyFilter('all');
                }}
              >
                Clear All
              </Button>
              <Button className="flex-1" onClick={() => setShowFilters(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
