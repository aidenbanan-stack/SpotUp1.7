import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { mockUsers, mockCourts } from '@/data/mockData';
import { User, SPORTS } from '@/types';
import { Trophy, Medal, Award, TrendingUp, Star, MapPin, Users, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TimeRange = 'week' | 'month';
type Scope = 'nearby' | 'city' | 'court';

interface LeaderboardUser {
  user: User;
  primaryStat: number;
  secondaryStat?: string;
  badge?: string;
}

export default function Leaderboards() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [scope, setScope] = useState<Scope>('nearby');
  const [selectedCourt, setSelectedCourt] = useState(mockCourts[0]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold text-sm">{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-transparent';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-transparent';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-transparent';
      default:
        return '';
    }
  };

  // Most Active (by games completed)
  const mostActive: LeaderboardUser[] = [...mockUsers]
    .sort((a, b) => b.stats.gamesPlayed - a.stats.gamesPlayed)
    .slice(0, 10)
    .map(u => ({
      user: u,
      primaryStat: u.stats.gamesPlayed,
      secondaryStat: 'games',
      badge: u.stats.gamesPlayed >= 50 ? '🔥' : undefined,
    }));

  // Most Reliable
  const mostReliable: LeaderboardUser[] = [...mockUsers]
    .sort((a, b) => b.reliabilityStats.score - a.reliabilityStats.score)
    .slice(0, 10)
    .map(u => ({
      user: u,
      primaryStat: u.reliabilityStats.score,
      secondaryStat: '%',
      badge: u.reliabilityStats.score >= 95 ? '✅' : undefined,
    }));

  // Top Hosts (composite: rating * completionRate * gamesHosted weight)
  const topHosts: LeaderboardUser[] = [...mockUsers]
    .filter(u => u.hostReputation && u.hostReputation.totalHosted > 0)
    .sort((a, b) => {
      const scoreA = (a.hostReputation?.rating || 0) * (a.hostReputation?.completionRate || 0) / 100 * Math.log10((a.hostReputation?.totalHosted || 1) + 1);
      const scoreB = (b.hostReputation?.rating || 0) * (b.hostReputation?.completionRate || 0) / 100 * Math.log10((b.hostReputation?.totalHosted || 1) + 1);
      return scoreB - scoreA;
    })
    .slice(0, 10)
    .map(u => ({
      user: u,
      primaryStat: u.hostReputation?.rating || 0,
      secondaryStat: `★ • ${u.hostReputation?.totalHosted} hosted`,
      badge: u.hostReputation?.isTrustedHost ? '🌟' : undefined,
    }));

  // Court Legends (unique courts + games)
  const courtLegends: LeaderboardUser[] = [...mockUsers]
    .sort((a, b) => {
      const scoreA = (a.uniqueCourtsPlayed || 0) * 10 + a.stats.gamesPlayed;
      const scoreB = (b.uniqueCourtsPlayed || 0) * 10 + b.stats.gamesPlayed;
      return scoreB - scoreA;
    })
    .slice(0, 10)
    .map(u => ({
      user: u,
      primaryStat: u.uniqueCourtsPlayed || 0,
      secondaryStat: 'courts',
      badge: (u.uniqueCourtsPlayed || 0) >= 10 ? '🗺️' : undefined,
    }));

  const renderLeaderboardSection = (
    title: string,
    icon: React.ReactNode,
    data: LeaderboardUser[],
    statLabel: string
  ) => {
    const currentUserRank = data.findIndex(d => d.user.id === user?.id);
    const showUserSeparately = currentUserRank >= 10 || currentUserRank === -1;

    return (
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <div className="glass-card overflow-hidden">
          {data.slice(0, 10).map((item, index) => {
            const rank = index + 1;
            const isCurrentUser = item.user.id === user?.id;

            return (
              <button
                key={item.user.id}
                onClick={() => navigate(`/profile/${item.user.id}`)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50',
                  getRankBg(rank),
                  isCurrentUser && 'ring-1 ring-inset ring-primary/50 bg-primary/5',
                  index < data.length - 1 && 'border-b border-border/30'
                )}
              >
                <div className="flex-shrink-0 w-6">
                  {getRankIcon(rank)}
                </div>
                <img
                  src={item.user.profilePhotoUrl}
                  alt={item.user.username}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground truncate">
                      {item.user.username}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs text-primary">(You)</span>
                    )}
                    {item.badge && <span className="text-sm">{item.badge}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="font-bold text-foreground">
                    {typeof item.primaryStat === 'number' && item.primaryStat % 1 !== 0 
                      ? item.primaryStat.toFixed(1) 
                      : item.primaryStat}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {item.secondaryStat}
                  </span>
                </div>
              </button>
            );
          })}
          
          {/* Show current user if not in top 10 */}
          {showUserSeparately && user && (
            <>
              <div className="px-4 py-2 text-center text-xs text-muted-foreground border-t border-border/30">
                • • •
              </div>
              <button
                onClick={() => navigate(`/profile/${user.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary/5 ring-1 ring-inset ring-primary/50"
              >
                <div className="flex-shrink-0 w-6">
                  <span className="text-sm font-bold text-muted-foreground">
                    {currentUserRank >= 0 ? currentUserRank + 1 : '-'}
                  </span>
                </div>
                <img
                  src={user.profilePhotoUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 text-left">
                  <span className="font-medium text-foreground">
                    {user.username}
                  </span>
                  <span className="text-xs text-primary ml-1.5">(You)</span>
                </div>
                <span className="text-muted-foreground text-sm">Keep playing!</span>
              </button>
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Leaderboards</h1>
          </div>
          
          {/* Filters Row */}
          <div className="flex items-center gap-3">
            {/* Time Range */}
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <TabsList className="h-9">
                <TabsTrigger value="week" className="text-xs px-3">This Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-3">This Month</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Scope Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 bg-secondary/60 rounded-lg text-sm">
                <MapPin className="w-4 h-4" />
                <span className="capitalize">
                  {scope === 'court' ? selectedCourt.name : scope === 'city' ? 'This City' : 'Nearby'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setScope('nearby')}>
                  Nearby
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScope('city')}>
                  This City
                </DropdownMenuItem>
                {mockCourts.map(court => (
                  <DropdownMenuItem 
                    key={court.id}
                    onClick={() => {
                      setScope('court');
                      setSelectedCourt(court);
                    }}
                  >
                    {court.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="px-4 py-6">
        {/* Encouraging message */}
        <div className="glass-card p-4 mb-6 text-center">
          <p className="text-sm text-muted-foreground">
            🎉 Show up, play hard, have fun! Leaderboards reset {timeRange === 'week' ? 'weekly' : 'monthly'}.
          </p>
        </div>

        {renderLeaderboardSection(
          'Most Active',
          <TrendingUp className="w-5 h-5 text-primary" />,
          mostActive,
          'games'
        )}

        {renderLeaderboardSection(
          'Most Reliable',
          <Star className="w-5 h-5 text-green-500" />,
          mostReliable,
          '%'
        )}

        {renderLeaderboardSection(
          'Top Hosts',
          <Users className="w-5 h-5 text-amber-500" />,
          topHosts,
          '★'
        )}

        {renderLeaderboardSection(
          'Court Legends',
          <MapPin className="w-5 h-5 text-blue-500" />,
          courtLegends,
          'courts'
        )}
      </main>
    </div>
  );
}
