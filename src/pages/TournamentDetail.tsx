import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { mockTournaments, mockUsers } from '@/data/mockData';
import { 
  Tournament, 
  TournamentTeam, 
  TournamentMatch,
  SPORTS,
  canJoinTournament,
  getPlayersPerTeam
} from '@/types';
import { format } from 'date-fns';
import { 
  ArrowLeft,
  Trophy,
  MapPin,
  Calendar,
  Users,
  Shield,
  Clock,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Play,
  User,
  Crown,
  Target,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function TournamentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'bracket'>('overview');
  const [joinType, setJoinType] = useState<'team' | 'solo'>('team');
  const [teamName, setTeamName] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const tournament = mockTournaments.find(t => t.id === id);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Tournament not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/tournaments')}>
            Back to Tournaments
          </Button>
        </div>
      </div>
    );
  }

  const sportData = SPORTS.find(s => s.id === tournament.sport);
  const isHost = user?.id === tournament.hostId;
  const canJoin = user ? canJoinTournament(user, tournament.minReliability) : false;
  const playersPerTeam = getPlayersPerTeam(tournament.format);
  const slotsRemaining = tournament.teamCount - tournament.teams.length;
  const isOpen = tournament.status === 'open';

  const handleJoinAsTeam = () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }
    toast.success(`Team "${teamName}" registered!`);
    setShowJoinDialog(false);
    setTeamName('');
  };

  const handleJoinSolo = () => {
    toast.success('Added to available players pool!');
    setShowJoinDialog(false);
  };

  const handleCheckIn = (status: 'on_my_way' | 'arrived') => {
    toast.success(status === 'on_my_way' ? 'On your way! 🚗' : 'You\'ve arrived! ✅');
  };

  // Mock bracket data for visualization
  const generateMockBracket = (): TournamentMatch[][] => {
    const rounds: TournamentMatch[][] = [];
    let matchesInRound = tournament.teamCount / 2;
    let roundNumber = 1;

    while (matchesInRound >= 1) {
      const roundMatches: TournamentMatch[] = [];
      for (let i = 0; i < matchesInRound; i++) {
        roundMatches.push({
          id: `${roundNumber}-${i}`,
          roundNumber,
          matchNumber: i + 1,
          status: 'pending',
        });
      }
      rounds.push(roundMatches);
      matchesInRound /= 2;
      roundNumber++;
    }
    return rounds;
  };

  const bracket = generateMockBracket();

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-secondary/60"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-2xl">{sportData?.icon}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
            <p className="text-sm text-muted-foreground">{tournament.format} • {tournament.seriesType === 'best_of_3' ? 'Best of 3' : 'Single Elim'}</p>
          </div>
          {tournament.host?.hostReputation?.isTrustedHost && (
            <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full">
              <Shield className="w-3 h-3 text-primary" />
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="w-full rounded-none border-t border-border/30">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="teams" className="flex-1">Teams</TabsTrigger>
            <TabsTrigger value="bracket" className="flex-1">Bracket</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <main className="px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className={cn(
              'glass-card p-4 flex items-center gap-3',
              isOpen ? 'border-primary/30' : 'border-amber-500/30'
            )}>
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isOpen ? 'bg-primary/10' : 'bg-amber-500/10'
              )}>
                {isOpen ? <Users className="w-5 h-5 text-primary" /> : <Clock className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {isOpen ? `${slotsRemaining} slots remaining` : 'Registration closed'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isOpen ? 'Join now!' : 'Tournament in progress'}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{format(tournament.dateTime, "EEEE, MMMM d, yyyy")}</p>
                  <p className="text-sm text-muted-foreground">{format(tournament.dateTime, "h:mm a")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary" />
                <p className="text-foreground">{tournament.location.address}</p>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <p className="text-foreground">{tournament.teamCount} teams • {playersPerTeam} players per team</p>
              </div>
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-primary" />
                <p className="text-foreground">Play to {tournament.playToScore} • {tournament.pointsStyle === '1s_and_2s' ? '1s and 2s' : '2s and 3s'}</p>
              </div>
              {tournament.makeItTakeIt && (
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary" />
                  <p className="text-foreground">Make-it take-it</p>
                </div>
              )}
            </div>

            {/* Host */}
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground mb-3">Hosted by</p>
              <div className="flex items-center gap-3">
                <img
                  src={tournament.host?.profilePhotoUrl}
                  alt={tournament.host?.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="font-medium">{tournament.host?.username}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{tournament.host?.hostReputation?.rating?.toFixed(1)} ★</span>
                    <span>•</span>
                    <span>{tournament.host?.hostReputation?.totalHosted} hosted</span>
                  </div>
                </div>
                {tournament.host?.hostReputation?.isTrustedHost && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full">
                    <Shield className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary">Trusted</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {tournament.notes && (
              <div className="glass-card p-4">
                <p className="text-sm text-muted-foreground mb-2">Notes</p>
                <p className="text-foreground">{tournament.notes}</p>
              </div>
            )}

            {/* Join Button */}
            {isOpen && !isHost && (
              <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full h-14 text-lg"
                    disabled={!canJoin}
                  >
                    {canJoin ? 'Join Tournament' : `Min ${tournament.minReliability}% reliability required`}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Tournament</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setJoinType('team')}
                        className={cn(
                          'p-4 rounded-xl text-left transition-all',
                          joinType === 'team'
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'bg-secondary/60 border-2 border-transparent'
                        )}
                      >
                        <Users className="w-5 h-5 mb-2" />
                        <p className="font-medium">Join as Team</p>
                        <p className="text-xs text-muted-foreground">Create or join a team</p>
                      </button>
                      <button
                        onClick={() => setJoinType('solo')}
                        className={cn(
                          'p-4 rounded-xl text-left transition-all',
                          joinType === 'solo'
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'bg-secondary/60 border-2 border-transparent'
                        )}
                      >
                        <User className="w-5 h-5 mb-2" />
                        <p className="font-medium">Join Solo</p>
                        <p className="text-xs text-muted-foreground">Get matched with others</p>
                      </button>
                    </div>

                    {joinType === 'team' ? (
                      <div className="space-y-3">
                        <Label>Team Name</Label>
                        <Input
                          placeholder="e.g., Venice Ballers"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          You'll be the team captain and can invite {playersPerTeam - 1} more players.
                        </p>
                        <Button className="w-full" onClick={handleJoinAsTeam}>
                          Create Team
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          You'll be added to the available players pool. The host will assign you to a team before the tournament starts.
                        </p>
                        <Button className="w-full" onClick={handleJoinSolo}>
                          Join as Free Agent
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Host Controls */}
            {isHost && (
              <div className="space-y-3">
                <Button className="w-full" variant="outline">
                  <Crown className="w-4 h-4 mr-2" />
                  Manage Tournament
                </Button>
                {tournament.status === 'roster_locked' && (
                  <Button className="w-full">
                    <Play className="w-4 h-4 mr-2" />
                    Start Tournament
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="space-y-6">
            {/* Registered Teams */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Registered Teams ({tournament.teams.length}/{tournament.teamCount})
              </h3>
              {tournament.teams.length > 0 ? (
                <div className="space-y-3">
                  {tournament.teams.map((team, index) => (
                    <div key={team.id} className="glass-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{team.name}</h4>
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          team.checkInStatus === 'arrived' ? 'bg-green-500/10 text-green-500' :
                          team.checkInStatus === 'on_my_way' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-secondary text-muted-foreground'
                        )}>
                          {team.checkInStatus === 'arrived' ? '✓ Arrived' :
                           team.checkInStatus === 'on_my_way' ? '🚗 On the way' :
                           'Not checked in'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {team.players?.map(player => (
                          <img
                            key={player.id}
                            src={player.profilePhotoUrl}
                            alt={player.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ))}
                        {Array.from({ length: playersPerTeam - (team.players?.length || 0) }).map((_, i) => (
                          <div
                            key={i}
                            className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center"
                          >
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-8 text-center">
                  <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No teams registered yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Be the first to join!</p>
                </div>
              )}
            </div>

            {/* Solo Players */}
            {tournament.soloPlayers.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Available Players ({tournament.soloPlayers.length})
                </h3>
                <div className="glass-card p-4">
                  <div className="flex flex-wrap gap-2">
                    {tournament.soloPlayers.map(({ id, player }) => (
                      <div key={id} className="flex items-center gap-2 px-3 py-2 bg-secondary/60 rounded-full">
                        <img
                          src={player?.profilePhotoUrl || ''}
                          alt={player?.username}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-sm">{player?.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Check-in for participants */}
            {!isHost && tournament.status !== 'open' && (
              <div className="glass-card p-4">
                <h4 className="font-medium mb-3">Check In</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => handleCheckIn('on_my_way')}>
                    🚗 On My Way
                  </Button>
                  <Button onClick={() => handleCheckIn('arrived')}>
                    ✓ I've Arrived
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bracket' && (
          <div className="space-y-6">
            {tournament.teams.length < 2 ? (
              <div className="glass-card p-8 text-center">
                <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Bracket will appear once teams register</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-6 min-w-max">
                  {bracket.map((round, roundIndex) => (
                    <div key={roundIndex} className="flex flex-col gap-4">
                      <h4 className="text-sm font-medium text-muted-foreground text-center">
                        {roundIndex === bracket.length - 1 ? 'Finals' :
                         roundIndex === bracket.length - 2 ? 'Semifinals' :
                         `Round ${roundIndex + 1}`}
                      </h4>
                      <div className="flex flex-col justify-around flex-1 gap-4">
                        {round.map((match) => (
                          <div
                            key={match.id}
                            className="glass-card p-3 w-48"
                          >
                            <div className={cn(
                              'flex items-center justify-between py-2 px-2 rounded-lg mb-1',
                              match.winnerId === match.team1Id ? 'bg-primary/10' : 'bg-secondary/40'
                            )}>
                              <span className="text-sm truncate">
                                {match.team1?.name || 'TBD'}
                              </span>
                              <span className="text-sm font-bold">
                                {match.team1Score ?? '-'}
                              </span>
                            </div>
                            <div className={cn(
                              'flex items-center justify-between py-2 px-2 rounded-lg',
                              match.winnerId === match.team2Id ? 'bg-primary/10' : 'bg-secondary/40'
                            )}>
                              <span className="text-sm truncate">
                                {match.team2?.name || 'TBD'}
                              </span>
                              <span className="text-sm font-bold">
                                {match.team2Score ?? '-'}
                              </span>
                            </div>
                            {isHost && match.status === 'in_progress' && (
                              <Button size="sm" className="w-full mt-2" variant="outline">
                                Update Score
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best of 3 indicator */}
            {tournament.seriesType === 'best_of_3' && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
                <AlertCircle className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Each match is a best-of-3 series
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
