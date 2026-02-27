import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { SportIcon, SportBadge } from '@/components/SportIcon';
import { PlayerLevelBadge } from '@/components/PlayerLevelBadge';
import { BadgeDisplay } from '@/components/BadgeDisplay';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { HostReputationCard } from '@/components/HostReputationCard';
import { 
  ArrowLeft,
  Calendar, 
  Edit2, 
  LogOut, 
  MapPin, 
  Ruler, 
  Settings, 
  Star, 
  Trophy, 
  Zap,
  Award
} from 'lucide-react';
import { SPORTS, type User as UserType } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { fetchProfileById } from '@/lib/profileApi';

export default function Profile() {
  const navigate = useNavigate();
  const { user: me, setUser } = useApp();
  const { id } = useParams();
  const [other, setOther] = useState<UserType | null>(null);
  const [loadingOther, setLoadingOther] = useState(false);

  const viewingOther = useMemo(() => Boolean(id && me && id !== me.id), [id, me]);

  const user = viewingOther ? other : me;

  // IMPORTANT: hooks must run unconditionally (before any early returns)
  useEffect(() => {
    let mounted = true;

    const loadOther = async () => {
      if (!viewingOther || !id) {
        if (mounted) setOther(null);
        return;
      }

      try {
        setLoadingOther(true);
        const u = await fetchProfileById(id);
        console.log('[Profile] id:', id, 'fetched:', u);
        if (mounted) setOther(u);
      } catch (e) {
        console.error('[Profile] loadOther failed:', e);
        if (mounted) setOther(null);
      } finally {
        if (mounted) setLoadingOther(false);
      }
    };

    void loadOther();
    return () => {
      mounted = false;
    };
  }, [viewingOther, id]);

  if (!me) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your profile</p>
          <Button onClick={() => navigate('/onboarding')}>Get Started</Button>
        </div>
      </div>
    );
  }

  
  if (viewingOther && loadingOther) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  // Only show "not found" after we have finished loading.
  if (viewingOther && !loadingOther && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  const primarySportData = SPORTS.find(s => s.id === user.primarySport);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {viewingOther ? (
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl bg-secondary/60"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}
            <h1 className="text-xl font-bold">{viewingOther ? user.username : 'Profile'}</h1>
          </div>

          {!viewingOther ? (
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-xl bg-secondary/60"
            >
              <Settings className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Profile Header */}
        <section className="glass-card p-6 text-center animate-fade-in">
          <div className="relative inline-block mb-4">
            <img
              src={user.profilePhotoUrl}
              alt={user.username}
              className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-glow"
            />
            {!viewingOther ? (
              <button
                onClick={() => navigate('/edit-profile')}
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-full shadow-lg"
                aria-label="Edit profile photo"
              >
                <Edit2 className="w-4 h-4 text-primary-foreground" />
              </button>
            ) : null}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{user.username}</h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
            <MapPin className="w-4 h-4" />
            <span>{user.city}</span>
          </div>
          {/* Player Level */}
          <div className="flex justify-center">
            <PlayerLevelBadge level={user.level} xp={user.xp} showProgress />
          </div>

          {/* Bio */}
          <div className="mt-4 text-sm text-muted-foreground">
            {user.bio ? (
              <p className="whitespace-pre-line">{user.bio}</p>
            ) : (
              viewingOther ? (
                <p>No bio yet</p>
              ) : (
                <button
                  onClick={() => navigate('/edit-profile')}
                  className="underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  Add a bio to your profile
                </button>
              )
            )
          }
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="glass-card p-4 text-center">
            <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{user.stats.gamesPlayed}</p>
            <p className="text-xs text-muted-foreground">Games Played</p>
          </div>
          <div className="glass-card p-4 text-center">
            <Star className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{user.stats.gamesHosted}</p>
            <p className="text-xs text-muted-foreground">Games Hosted</p>
          </div>
          <div className="glass-card p-4 text-center">
            <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{user.reliabilityStats.score}%</p>
            <p className="text-xs text-muted-foreground">Reliability</p>
          </div>
        </section>

        {/* Badges */}
        <section className="animate-fade-in" style={{ animationDelay: '75ms' }}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" />
            BADGES
          </h3>
          <div className="glass-card p-4">
            <BadgeDisplay badges={user.badges} maxDisplay={6} />
            {user.badges.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Play games to earn badges!
              </p>
            )}
          </div>
        </section>

        {/* Reliability Score */}
        <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <ReliabilityScore stats={user.reliabilityStats} />
        </section>

        {/* Host Reputation */}
        {user.hostReputation && user.hostReputation.totalHosted > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: '125ms' }}>
            <HostReputationCard reputation={user.hostReputation} />
          </section>
        )}

        {/* Vote Stats */}
        <section className="glass-card p-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Post-Game Votes Received
          </h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{user.votesReceived.bestScorer}</p>
              <p className="text-xs text-muted-foreground">🏆 Best Scorer</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{user.votesReceived.bestDefender}</p>
              <p className="text-xs text-muted-foreground">🛡️ Best Defender</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{user.votesReceived.bestTeammate}</p>
              <p className="text-xs text-muted-foreground">🤝 Best Teammate</p>
            </div>
          </div>
        </section>

        {/* Player Info */}
        <section className="glass-card p-4 space-y-4 animate-fade-in" style={{ animationDelay: '175ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="text-muted-foreground">Age</span>
            </div>
            <span className="font-semibold">{user.age} years</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Ruler className="w-5 h-5 text-primary" />
              <span className="text-muted-foreground">Height</span>
            </div>
            <span className="font-semibold">{user.height}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-muted-foreground">Skill Level</span>
            </div>
            <span className="font-semibold capitalize">{user.skillLevel}</span>
          </div>
        </section>

        {/* Sports */}
        <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">MY SPORTS</h3>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Primary Sport</span>
              {primarySportData && (
                <SportBadge sport={user.primarySport} />
              )}
            </div>
            {user.secondarySports.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground block mb-2">Also plays</span>
                <div className="flex flex-wrap gap-2">
                  {user.secondarySports.map(sport => (
                    <SportBadge key={sport} sport={sport} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions removed: moved to Home header */}

        {/* Logout */}
        {!viewingOther ? (
          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        ) : null}
      </main>
    </div>
  );
}
