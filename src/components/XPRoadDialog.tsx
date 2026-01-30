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
  return levels.find(l => xp >= l.minXP) ?? PLAYER_LEVELS[0];
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
        setFriends(f.filter(x => x.id !== user.id));
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

  if (!user) return null;

  const me = user;

  const myXP = useMemo(() => xpForSport(me, sportFilter), [me, sportFilter]);
  const myLevel = useMemo(() => levelForXP(myXP), [myXP]);

  const friendsRanked = useMemo(() => {
    return [...friends]
      .map(u => ({ user: u, xp: xpForSport(u, sportFilter) }))
      .sort((a, b) => b.xp - a.xp);
  }, [friends, sportFilter]);

  const allRanked = useMemo(() => {
    const everyone = [{ user: me, xp: myXP }, ...friendsRanked];
    return everyone.sort((a, b) => b.xp - a.xp);
  }, [friendsRanked, me, myXP]);

  const myPlacement = useMemo(() => {
    const idx = allRanked.findIndex(p => p.user.id === me.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [allRanked, me.id]);

  const nextLevel = useMemo(() => {
    const idx = PLAYER_LEVELS.findIndex(l => l.id === myLevel.id);
    return PLAYER_LEVELS[idx + 1];
  }, [myLevel.id]);

  const progressToNext = useMemo(() => {
    if (!nextLevel) return 1;
    const span = nextLevel.minXP - myLevel.minXP;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (myXP - myLevel.minXP) / span));
  }, [myXP, myLevel.minXP, nextLevel]);

  const sportLabel = useMemo(() => {
    if (sportFilter === 'all') return 'All sports';
    return SPORTS.find(s => s.id === sportFilter)?.name ?? 'Sport';
  }, [sportFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + overflow fixes mobile "stuck" dialogs */}
      <DialogContent className="w-[min(92vw,720px)] max-w-none p-0 max-h-[90vh] overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">XP Road</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Your progress across {sportLabel.toLowerCase()}.
              </p>
            </div>
            <div className="min-w-[180px]">
              <Select value={sportFilter} onValueChange={(v) => setSportFilter(v as SportFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="All sports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sports</SelectItem>
                  {SPORTS.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Use a normal div scroll container instead of ScrollArea */}
        <div className="px-5 pb-5 pt-4 overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(90vh - 84px)' }}>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={me.profilePhotoUrl} alt={me.username} />
                  <AvatarFallback>{me.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground">{me.username}</p>
                  <p className="text-sm text-muted-foreground">
                    Rank #{myPlacement} among friends
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-muted-foreground">XP</p>
                <p className="text-xl font-extrabold text-foreground">{myXP.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{myLevel.name}</span>
                {nextLevel ? (
                  <span className="text-muted-foreground">{nextLevel.name}</span>
                ) : (
                  <span className="text-muted-foreground">Max</span>
                )}
              </div>
              <div className="h-3 rounded-full bg-secondary mt-2 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${progressToNext * 100}%` }} />
              </div>
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
                <p className="text-sm text-muted-foreground mt-1">
                  Add friends to compare XP here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {friendsRanked.map(({ user: u, xp }, idx) => {
                  const lvl = levelForXP(xp);
                  return (
                    <div key={u.id} className={cn('glass-card p-3 flex items-center gap-3')}>
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
