import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { mockTournaments, mockUsers } from '@/data/mockData';
import { Tournament, TournamentFormat, TOURNAMENT_FORMATS, SPORTS, canCreateTournament, canJoinTournament } from '@/types';
import { format } from 'date-fns';
import { 
  Trophy, 
  Plus, 
  MapPin, 
  Calendar, 
  Users, 
  Shield, 
  Lock,
  ChevronDown,
  Star,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';

type DistanceFilter = 'nearby' | '5mi' | '10mi';
type DateFilter = 'week' | 'month';

export default function Tournaments() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'join' | 'host'>('join');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('nearby');
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [formatFilter, setFormatFilter] = useState<TournamentFormat | 'all'>('all');

  const canCreate = user ? canCreateTournament(user) : { allowed: false, requirements: { reliability: false, hostRating: false, gamesHosted: false } };

  // Filter tournaments
  const filteredTournaments = mockTournaments.filter(t => {
    if (formatFilter !== 'all' && t.format !== formatFilter) return false;
    // In a real app, filter by date and distance
    return true;
  });

  const TournamentCard = ({ tournament }: { tournament: Tournament }) => {
    const sportData = SPORTS.find(s => s.id === tournament.sport);
    const slotsRemaining = tournament.teamCount - tournament.teams.length;
    const canJoin = user ? canJoinTournament(user, tournament.minReliability) : false;

    return (
      <button
        onClick={() => navigate(`/tournament/${tournament.id}`)}
        className="glass-card w-full p-4 text-left transition-all hover:bg-secondary/50"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{sportData?.icon}</span>
            <div>
              <h3 className="font-semibold text-foreground">{tournament.name}</h3>
              <p className="text-sm text-muted-foreground">{tournament.format}</p>
            </div>
          </div>
          {tournament.host?.hostReputation?.isTrustedHost && (
            <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full">
              <Shield className="w-3 h-3 text-primary" />
              <span className="text-xs text-primary font-medium">Trusted Host</span>
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{tournament.location.address}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(tournament.dateTime, "MMM d 'at' h:mm a")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{tournament.teams.length}/{tournament.teamCount} teams</span>
            {slotsRemaining > 0 && (
              <span className="text-primary">• {slotsRemaining} slots left</span>
            )}
          </div>
        </div>

        {!canJoin && user && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-500">
            <AlertCircle className="w-3 h-3" />
            <span>Min {tournament.minReliability}% reliability required</span>
          </div>
        )}
      </button>
    );
  };

  const TrustedHostRequirements = () => {
    const reliability = user?.reliabilityStats.score ?? 0;
    const hostRating = user?.hostReputation?.rating ?? 0;
    const gamesHosted = user?.hostReputation?.totalHosted ?? 0;

    return (
      <div className="glass-card p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-secondary/60 rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Become a Trusted Tournament Host</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Complete these requirements to unlock tournament creation
        </p>

        <div className="space-y-4 text-left">
          {/* Reliability */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                {canCreate.requirements.reliability ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                Reliability Score ≥ 90%
              </span>
              <span className="text-sm font-medium">{reliability}%</span>
            </div>
            <Progress value={Math.min(reliability / 90 * 100, 100)} className="h-2" />
          </div>

          {/* Host Rating */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                {canCreate.requirements.hostRating ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                Host Rating ≥ 4.0
              </span>
              <span className="text-sm font-medium">{hostRating.toFixed(1)} ★</span>
            </div>
            <Progress value={Math.min(hostRating / 4 * 100, 100)} className="h-2" />
          </div>

          {/* Games Hosted */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                {canCreate.requirements.gamesHosted ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                Games Hosted ≥ 5
              </span>
              <span className="text-sm font-medium">{gamesHosted}</span>
            </div>
            <Progress value={Math.min(gamesHosted / 5 * 100, 100)} className="h-2" />
          </div>
        </div>

        <Button 
          variant="outline" 
          className="mt-6 w-full"
          onClick={() => navigate('/create-game')}
        >
          Host more games to unlock
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">Tournaments</h1>
            </div>
          </div>
          
          {/* Join / Host Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'join' | 'host')}>
            <TabsList className="w-full">
              <TabsTrigger value="join" className="flex-1">Join</TabsTrigger>
              <TabsTrigger value="host" className="flex-1">Host</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="px-4 py-6">
        {activeTab === 'join' ? (
          <>
            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 bg-secondary/60 rounded-lg text-sm whitespace-nowrap">
                  <MapPin className="w-4 h-4" />
                  <span className="capitalize">{distanceFilter === 'nearby' ? 'Nearby' : distanceFilter}</span>
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setDistanceFilter('nearby')}>Nearby</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDistanceFilter('5mi')}>5 miles</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDistanceFilter('10mi')}>10 miles</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 bg-secondary/60 rounded-lg text-sm whitespace-nowrap">
                  <Calendar className="w-4 h-4" />
                  <span>{dateFilter === 'week' ? 'This Week' : 'This Month'}</span>
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setDateFilter('week')}>This Week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDateFilter('month')}>This Month</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 bg-secondary/60 rounded-lg text-sm whitespace-nowrap">
                  <Users className="w-4 h-4" />
                  <span>{formatFilter === 'all' ? 'All Formats' : formatFilter}</span>
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFormatFilter('all')}>All Formats</DropdownMenuItem>
                  {TOURNAMENT_FORMATS.map(f => (
                    <DropdownMenuItem key={f.id} onClick={() => setFormatFilter(f.id)}>
                      {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tournament List */}
            <div className="space-y-4">
              {filteredTournaments.length > 0 ? (
                filteredTournaments.map(tournament => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))
              ) : (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tournaments found</p>
                  <p className="text-sm text-muted-foreground mt-1">Check back later or expand your filters</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {canCreate.allowed ? (
              <div className="space-y-6">
                <div className="glass-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">You're a Trusted Host!</p>
                    <p className="text-sm text-muted-foreground">You can create tournaments</p>
                  </div>
                </div>

                <Button 
                  className="w-full h-14 text-lg"
                  onClick={() => navigate('/create-tournament')}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Tournament
                </Button>

                {/* My Hosted Tournaments */}
                <div>
                  <h3 className="font-semibold mb-3">My Tournaments</h3>
                  {mockTournaments.filter(t => t.hostId === user?.id).length > 0 ? (
                    <div className="space-y-3">
                      {mockTournaments
                        .filter(t => t.hostId === user?.id)
                        .map(tournament => (
                          <TournamentCard key={tournament.id} tournament={tournament} />
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      You haven't hosted any tournaments yet
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <TrustedHostRequirements />
            )}
          </>
        )}
      </main>
    </div>
  );
}
