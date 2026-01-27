import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { mockUsers } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { PLAYER_LEVELS, SPORTS, Sport, User } from '@/types';

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
  const me = user ?? mockUsers[0];
  const friends = useMemo(() => mockUsers.filter(u => u.id !== me.id), [me.id]);

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
      <DialogContent className="w-[min(92vw,720px)] max-w-none p-0 overflow-hidden">
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
                      {s.icon} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={me.profilePhotoUrl} alt={me.username} />
              <AvatarFallback>{me.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{me.username}</span>
                  <Badge variant="secondary" className="rounded-full">#{myPlacement}</Badge>
                </div>
                <span className="text-sm font-semibold text-foreground">{myXP.toLocaleString()} XP</span>
              </div>
              <div className="mt-2">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(progressToNext * 100)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{myLevel.icon} {myLevel.name}</span>
                  <span>
                    {nextLevel ? `${Math.max(0, nextLevel.minXP - myXP)} XP to ${nextLevel.name} ${nextLevel.icon}` : 'Max rank'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-w-0">
          {/* Trophy road */}
          <div className="border-b md:border-b-0 md:border-r border-border/50 min-w-0">
            <div className="px-5 py-4">
              <h4 className="text-sm font-semibold text-muted-foreground">TROPHY ROAD</h4>
            </div>
            <ScrollArea className="h-[420px]">
              <div className="px-5 pb-5 space-y-3">
                {PLAYER_LEVELS.map((lvl) => {
                  const isCurrent = myXP >= lvl.minXP && (!nextLevel || lvl.id === myLevel.id);
                  const reached = myXP >= lvl.minXP;
                  const milestoneFriends = friendsRanked
                    .filter(p => levelForXP(p.xp).id === lvl.id)
                    .slice(0, 4);

                  return (
                    <div
                      key={lvl.id}
                      className={cn(
                        'glass-card p-4 flex items-start gap-3',
                        isCurrent && 'border border-primary/40 shadow-glow'
                      )}
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg', reached ? 'bg-primary/15' : 'bg-secondary/60')}>
                        <span>{lvl.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-foreground">{lvl.name}</p>
                          <p className="text-xs text-muted-foreground">{lvl.minXP.toLocaleString()} XP</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {reached ? 'Unlocked' : 'Reach this milestone to unlock'}
                        </p>

                        {milestoneFriends.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Friends here:</span>
                            <div className="flex -space-x-2">
                              {milestoneFriends.map(p => (
                                <Avatar key={p.user.id} className="w-7 h-7 border border-background">
                                  <AvatarImage src={p.user.profilePhotoUrl} alt={p.user.username} />
                                  <AvatarFallback>{p.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Friends leaderboard */}
          <div className="min-w-0">
            <div className="px-5 py-4">
              <h4 className="text-sm font-semibold text-muted-foreground">FRIENDS</h4>
              <p className="text-xs text-muted-foreground mt-1">Mock data for now. This will come from real friends later.</p>
            </div>
            <ScrollArea className="h-[420px]">
              <div className="px-5 pb-5 space-y-3">
                {allRanked.map((p, idx) => (
                  <div key={p.user.id} className={cn('glass-card p-4 flex items-center gap-3', p.user.id === me.id && 'border border-primary/40')}>
                    <div className="w-8 text-center font-bold text-muted-foreground">{idx + 1}</div>
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={p.user.profilePhotoUrl} alt={p.user.username} />
                      <AvatarFallback>{p.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{p.user.username}</p>
                      <p className="text-xs text-muted-foreground">{levelForXP(p.xp).icon} {levelForXP(p.xp).name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{p.xp.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
