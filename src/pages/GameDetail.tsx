import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { SportIcon, SportBadge } from '@/components/SportIcon';
import { PlayerLevelBadge } from '@/components/PlayerLevelBadge';
import { ArrowLeft, Calendar, Clock, Lock, MapPin, Share2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { approveJoinRequest, deleteGame, joinGame, leaveGame, rejectJoinRequest, setGameStatus } from '@/lib/gamesApi';
import { fetchProfilesByIds, getOrCreateMyProfile } from '@/lib/profileApi';
import { awardXp } from '@/lib/xpApi';

export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, setGames, user, setUser } = useApp();

  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);

  const game = games.find((g) => g.id === id);

  // Load pending join request profiles (host-only UI).
  useEffect(() => {
    let mounted = true;
    const loadPending = async () => {
      if (!game) return;
      if (!user || game.hostId !== user.id) {
        if (mounted) setPendingProfiles([]);
        return;
      }
      const ids = game.pendingRequestIds ?? [];
      if (ids.length === 0) {
        if (mounted) setPendingProfiles([]);
        return;
      }
      try {
        const profs = await fetchProfilesByIds(ids);
        if (mounted) setPendingProfiles(profs);
      } catch {
        if (mounted) setPendingProfiles([]);
      }
    };
    void loadPending();
    return () => {
      mounted = false;
    };
  }, [game?.id, game?.pendingRequestIds?.join(','), user?.id]);

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Game not found</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const isHost = game.hostId === user?.id;
  const isJoined = game.playerIds.includes(user?.id || '');
  const isPending = game.pendingRequestIds.includes(user?.id || '');
  const isFull = game.playerIds.length >= game.maxPlayers;

  const isLive = game.status === 'live';
  const isFinished = game.status === 'finished';

  const canViewLive = (isHost || isJoined) && isLive;

  const openProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  useEffect(() => {
    let mounted = true;

    const loadPending = async () => {
      if (!game || !isHost) {
        setPendingProfiles([]);
        return;
      }
      const ids = Array.from(new Set(game.pendingRequestIds ?? [])).filter(Boolean);
      if (ids.length === 0) {
        setPendingProfiles([]);
        return;
      }
      setPendingLoading(true);
      try {
        const profs = await fetchProfilesByIds(ids);
        if (!mounted) return;
        setPendingProfiles(profs);
      } catch {
        if (!mounted) return;
        setPendingProfiles([]);
      } finally {
        if (mounted) setPendingLoading(false);
      }
    };

    void loadPending();
    return () => {
      mounted = false;
    };
  }, [game.id, isHost, (game.pendingRequestIds ?? []).join(',')]);

  const handleApproveRequest = async (targetUserId: string) => {
    try {
      const updated = await approveJoinRequest(game.id, targetUserId);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Request approved. Player added to the game.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve request.';
      toast.error(message);
    }
  };

  const handleRejectRequest = async (targetUserId: string) => {
    try {
      const updated = await rejectJoinRequest(game.id, targetUserId);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Request declined.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline request.';
      toast.error(message);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      toast.error('Please sign in to join games.');
      return;
    }
    if (isJoined || isPending) return;

    try {
      const updated = await joinGame(game.id, user.id, game.isPrivate);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success(game.isPrivate ? 'Join request sent! Waiting for host approval.' : 'You have joined the game!');

      // XP: joining (or requesting) a game
      try {
        await awardXp('join_game', game.id);
        const refreshed = await getOrCreateMyProfile();
        setUser(refreshed);
      } catch {
        // Non-blocking
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join game.';
      toast.error(message);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    if (!isJoined && !isPending) return;

    try {
      const updated = await leaveGame(game.id, user.id);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('You have left the game.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave game.';
      toast.error(message);
    }
  };

  const handleGoLive = async () => {
    if (!user) {
      toast.error('Please sign in.');
      return;
    }
    if (!isHost) {
      toast.error('Only the host can start the live session.');
      return;
    }
    try {
      const updated = await setGameStatus(game.id, 'live');
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Game is live.');
      navigate(`/game/${game.id}/live`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start live session.';
      toast.error(message);
    }
  };

  const handleCancel = async () => {
    if (!isHost) return;

    try {
      await deleteGame(game.id);
      setGames(games.filter((g) => g.id !== game.id));
      toast.success('Game cancelled.');
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel game.';
      toast.error(message);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const handleApprovePending = async (pendingUserId: string) => {
    if (!user || !isHost) return;
    try {
      setPendingBusy(pendingUserId);
      const updated = await approveJoinRequest(game.id, pendingUserId);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Request approved. Player added.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve request.';
      toast.error(message);
    } finally {
      setPendingBusy(null);
    }
  };

  const handleRejectPending = async (pendingUserId: string) => {
    if (!user || !isHost) return;
    try {
      setPendingBusy(pendingUserId);
      const updated = await rejectJoinRequest(game.id, pendingUserId);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Request removed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject request.';
      toast.error(message);
    } finally {
      setPendingBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-[220px] md:pb-[260px] safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Game Details</h1>
          <button onClick={handleShare} className="p-2 rounded-xl bg-secondary/60">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        <section className="animate-fade-in">
          <div className="flex items-start gap-4 mb-4">
            <SportIcon sport={game.sport} size="xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <SportBadge sport={game.sport} />
                {game.isPrivate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
                    <Lock className="w-3 h-3" />
                    Private
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{game.title}</h1>
              <div className="mt-2 inline-flex items-center gap-2 text-xs font-medium">
                <span
                  className={`px-2 py-1 rounded-full border border-border/50 ${
                    isFinished
                      ? 'bg-muted text-muted-foreground'
                      : isLive
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-blue-500/10 text-blue-600'
                  }`}
                >
                  {isFinished ? 'Finished' : isLive ? 'Live' : 'Scheduled'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {game.host && (
          <section
            className="glass-card p-4 flex items-center gap-4 animate-fade-in"
            style={{ animationDelay: '50ms' }}
          >
            <img src={game.host.profilePhotoUrl} alt={game.host.username} className="w-12 h-12 rounded-full object-cover" />
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => navigate(`/profile/${game.hostId}`)}
            >
              <span className="text-xs text-muted-foreground">Hosted by</span>
              <p className="font-semibold text-foreground">{game.host.username}</p>
            </button>
            {isHost && (
              <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-medium rounded-full">
                You're hosting
              </span>
            )}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs">Date</span>
            </div>
            <p className="font-semibold">{format(game.dateTime, 'EEE, MMM d, yyyy')}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs">Time</span>
            </div>
            <p className="font-semibold">
              {format(game.dateTime, 'h:mm a')} · {game.duration}min
            </p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs">Players</span>
            </div>
            <p className="font-semibold">
              {game.playerIds.length} / {game.maxPlayers}
            </p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span className="text-primary">⚡</span>
              <span className="text-xs">Skill Level</span>
            </div>
            <p className="font-semibold capitalize">{game.skillRequirement}</p>
          </div>
        </section>

        <section className="glass-card p-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-xs">Location</span>
          </div>
          {game.isPrivate && !isJoined && !isHost ? (
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <p className="text-muted-foreground">Location revealed after approval</p>
            </div>
          ) : (
            <p className="font-semibold">{game.location.areaName}</p>
          )}
        </section>

        {isHost && (game.pendingRequestIds?.length ?? 0) > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: '180ms' }}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              JOIN REQUESTS ({game.pendingRequestIds.length})
            </h3>
            <div className="space-y-2">
              {pendingProfiles.map((p) => (
                <div key={p.id} className="glass-card p-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openProfile(p.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <img
                      src={p.profilePhotoUrl}
                      alt={p.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.city}</p>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="hero"
                      disabled={pendingBusy === p.id}
                      onClick={() => handleApprovePending(p.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingBusy === p.id}
                      onClick={() => handleRejectPending(p.id)}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {game.description && (
          <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">ABOUT THIS GAME</h3>
            <p className="text-foreground">{game.description}</p>
          </section>
        )}

        <section className="animate-fade-in" style={{ animationDelay: '250ms' }}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            PLAYERS ({game.playerIds.length}/{game.maxPlayers})
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(game.players ?? []).map((player) => (
              <button
                key={player.id}
                onClick={() => openProfile(player.id)}
                className="flex items-center justify-between gap-2 glass-card p-2 pr-3 text-left hover:opacity-90"
                type="button"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={player.profilePhotoUrl}
                    alt={player.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium truncate">{player.username}</span>
                </div>

                <PlayerLevelBadge
                  level={player.level}
                  xp={player.xp}
                  size="sm"
                  className="shrink-0"
                />
              </button>
            ))}

            {Array.from({ length: Math.max(0, game.maxPlayers - game.playerIds.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 glass-card p-2 pr-4 opacity-50">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <span className="text-sm text-muted-foreground">Open spot</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed left-0 right-0 bottom-24 md:bottom-28 z-50 px-4 safe-bottom">
        <div className="mx-auto max-w-3xl">
          <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl p-3 shadow-lg space-y-3">
            {canViewLive && (
              <Button variant="hero" size="xl" className="w-full" onClick={() => navigate(`/game/${game.id}/live`)}>
                View Live Game
              </Button>
            )}

            {isHost ? (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => navigate(`/game/${id}/edit`)}>
                  Edit Game
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleCancel}>
                  Cancel Game
                </Button>
              </div>
            ) : isJoined ? (
              <Button variant="outline" className="w-full" onClick={handleLeave}>
                Leave Game
              </Button>
            ) : isPending ? (
              <Button variant="glass" className="w-full" disabled>
                Request Pending...
              </Button>
            ) : isFull ? (
              <Button variant="glass" className="w-full" disabled>
                Game is Full
              </Button>
            ) : (
              <Button variant="hero" size="xl" className="w-full" onClick={handleJoin}>
                {game.isPrivate ? 'Request to Join' : 'Join Game'}
              </Button>
            )}

            {isHost && !isFinished && !isLive && (
              <Button variant="hero" size="xl" className="w-full" onClick={handleGoLive}>
                Go Live
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
