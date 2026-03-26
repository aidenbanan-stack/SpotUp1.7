import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { PLAYER_LEVELS, SPORTS, Sport, User } from '@/types';
import { fetchMyFriends } from '@/lib/socialApi';

type SportFilter = Sport | 'all';

function xpForSport(user: User, sport: SportFilter): number {
  if (sport === 'all') return user.xp;
  if (user.primarySport === sport) return user.xp;
  if (user.secondarySports.includes(sport)) return Math.round(user.xp * 0.6);
  return 0;
}

function levelForXP(xp: number) {
  const levels = [...PLAYER_LEVELS].reverse();
  return levels.find((l) => xp >= l.minXP) ?? PLAYER_LEVELS[0];
}

function getTierMax(index: number) {
  return PLAYER_LEVELS[index + 1]?.minXP ?? null;
}

function getDropMilestones(levelIndex: number) {
  const min = PLAYER_LEVELS[levelIndex].minXP;
  const max = getTierMax(levelIndex);
  if (max == null) return [];
  const span = max - min;
  return [0.2, 0.4, 0.6, 0.8].map((ratio) => Math.round(min + span * ratio));
}

export function XPRoadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const { user } = useApp();

  const [friends, setFriends] = useState<User[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!open || !user) return;
      setFriendsLoading(true);
      try {
        const f = await fetchMyFriends();
        if (!mounted) return;
        setFriends(f.filter((x) => x.id !== user.id));
      } catch {
        if (!mounted) return;
        setFriends([]);
      } finally {
        if (mounted) setFriendsLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [open, user?.id]);

  const me = user;

  const myXP = useMemo(() => (me ? xpForSport(me, sportFilter) : 0), [me, sportFilter]);
  const myLevel = useMemo(() => levelForXP(myXP), [myXP]);

  const friendsRanked = useMemo(() => {
    return [...friends]
      .map((u) => ({ user: u, xp: xpForSport(u, sportFilter) }))
      .sort((a, b) => b.xp - a.xp);
  }, [friends, sportFilter]);

  const allRanked = useMemo(() => {
    if (!me) return [];
    return [{ user: me, xp: myXP }, ...friendsRanked].sort((a, b) => b.xp - a.xp);
  }, [friendsRanked, me, myXP]);

  const myPlacement = useMemo(() => {
    if (!me) return 1;
    const idx = allRanked.findIndex((p) => p.user.id === me.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [allRanked, me]);

  const currentIndex = useMemo(() => PLAYER_LEVELS.findIndex((l) => l.id === myLevel.id), [myLevel.id]);
  const nextLevel = useMemo(() => PLAYER_LEVELS[currentIndex + 1], [currentIndex]);

  const progressToNext = useMemo(() => {
    if (!nextLevel) return 1;
    const span = nextLevel.minXP - myLevel.minXP;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (myXP - myLevel.minXP) / span));
  }, [myXP, myLevel.minXP, nextLevel]);

  const nextDrop = useMemo(() => {
    const milestones = getDropMilestones(currentIndex);
    return milestones.find((m) => m > myXP) ?? null;
  }, [currentIndex, myXP]);

  const sportLabel = useMemo(() => {
    if (sportFilter === 'all') return 'All sports';
    return SPORTS.find((s) => s.id === sportFilter)?.name ?? 'Sport';
  }, [sportFilter]);

  if (!me) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,760px)] max-w-none p-0 max-h-[90vh] overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <div className="space-y-3 pr-10">
            <div>
              <DialogTitle className="text-xl">XP Road</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Track your progression across {sportLabel.toLowerCase()}.
              </p>
            </div>
            <div className="w-full sm:w-[220px]">
              <Select value={sportFilter} onValueChange={(v) => setSportFilter(v as SportFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="All sports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sports</SelectItem>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-96px)] px-5 py-5">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-16 h-16">
                <AvatarImage src={me.profilePhotoUrl} alt={me.username} />
                <AvatarFallback>{me.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold truncate">{me.username}</p>
                <p className="text-sm text-muted-foreground">Rank #{myPlacement} among friends</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">XP</p>
                <p className="text-xl font-extrabold text-foreground">{myXP.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{myLevel.name}</span>
                <span className="text-muted-foreground">{nextLevel ? nextLevel.name : 'Max Tier'}</span>
              </div>
              <div className="h-3 rounded-full bg-secondary mt-2 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${progressToNext * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{myLevel.minXP.toLocaleString()} XP</span>
                <span>{nextLevel ? `${nextLevel.minXP.toLocaleString()} XP` : 'Legend cap reached'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="rounded-2xl bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Current tier</p>
                <p className="font-semibold mt-1">{myLevel.icon} {myLevel.name}</p>
              </div>
              <div className="rounded-2xl bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Next drop</p>
                <p className="font-semibold mt-1">{nextDrop ? `${nextDrop.toLocaleString()} XP` : 'No more drops in this tier'}</p>
              </div>
              <div className="rounded-2xl bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Squads unlock</p>
                <p className="font-semibold mt-1">{myXP >= 500 ? 'Unlocked' : `${500 - myXP} XP away`}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 glass-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Tier roadmap</h3>
              <Badge variant="secondary">Drops every 20%</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {PLAYER_LEVELS.map((level, idx) => {
                const max = getTierMax(idx);
                const milestones = getDropMilestones(idx);
                const active = myXP >= level.minXP && (max == null || myXP < max);
                const unlocked = myXP >= level.minXP;
                return (
                  <div key={level.id} className={cn('rounded-2xl border p-3', active ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-secondary/20')}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{level.icon} {level.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {level.minXP.toLocaleString()} XP{max != null ? ` - ${(max - 1).toLocaleString()} XP` : '+'}
                        </p>
                      </div>
                      {active ? <Badge>Current</Badge> : unlocked ? <Badge variant="secondary">Unlocked</Badge> : null}
                    </div>
                    {milestones.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {milestones.map((milestone) => (
                          <Badge key={milestone} variant={myXP >= milestone ? 'default' : 'secondary'}>
                            Drop @ {milestone.toLocaleString()}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-3">Legend tier has no additional roadmap drops yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Friends</h3>
              {friendsLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
            </div>

            {friends.length === 0 ? (
              <div className="glass-card p-5 text-center">
                <p className="font-semibold">No friends yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add friends to compare XP here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friendsRanked.map(({ user: u, xp }, idx) => {
                  const lvl = levelForXP(xp);
                  return (
                    <div key={u.id} className="glass-card p-3 flex items-center gap-3">
                      <div className="w-7 text-center font-bold text-muted-foreground">{idx + 1}</div>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={u.profilePhotoUrl} alt={u.username} />
                        <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{u.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{lvl.name}</p>
                      </div>
                      <Badge variant="secondary">{xp.toLocaleString()} XP</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
