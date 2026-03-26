import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { fetchMyFriends } from '@/lib/socialApi';
import { PLAYER_LEVELS, SPORTS, Sport, User } from '@/types';
import { ChevronUp, Crown, Gift, Sparkles, Swords, Users } from 'lucide-react';

type SportFilter = Sport | 'all';

type RoadTier = {
  id: string;
  name: string;
  icon: string;
  minXP: number;
  maxXP: number | null;
  drops: number[];
};

type TierFriendMarker = {
  user: User;
  xp: number;
  progress: number;
  index: number;
};

function xpForSport(user: User, sport: SportFilter): number {
  if (sport === 'all') return user.xp;
  if (user.primarySport === sport) return user.xp;
  if (user.secondarySports.includes(sport)) return Math.round(user.xp * 0.6);
  return 0;
}

function levelForXP(xp: number) {
  const levels = [...PLAYER_LEVELS].reverse();
  return levels.find((level) => xp >= level.minXP) ?? PLAYER_LEVELS[0];
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'SU';
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function tierProgress(xp: number, tier: RoadTier) {
  if (tier.maxXP == null) return xp >= tier.minXP ? 1 : 0;
  const span = tier.maxXP - tier.minXP;
  if (span <= 0) return 1;
  return clamp01((xp - tier.minXP) / span);
}

function formatTierRange(tier: RoadTier) {
  if (tier.maxXP == null) return `${tier.minXP.toLocaleString()}+ XP`;
  return `${tier.minXP.toLocaleString()} - ${(tier.maxXP - 1).toLocaleString()} XP`;
}

function buildRoadTiers(): RoadTier[] {
  return PLAYER_LEVELS.map((level, index) => ({
    id: level.id,
    name: level.name,
    icon: level.icon,
    minXP: level.minXP,
    maxXP: getTierMax(index),
    drops: getDropMilestones(index),
  }));
}

export function XPRoadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useApp();
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [friends, setFriends] = useState<User[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!open || !user) return;
      setFriendsLoading(true);
      try {
        const loaded = await fetchMyFriends();
        if (!mounted) return;
        setFriends(loaded.filter((friend) => friend.id !== user.id));
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

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
    });

    const timeout = window.setTimeout(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
    }, 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [open, sportFilter, friendsLoading]);

  const me = user;
  const roadTiers = useMemo(() => buildRoadTiers(), []);

  const myXP = useMemo(() => (me ? xpForSport(me, sportFilter) : 0), [me, sportFilter]);
  const myLevel = useMemo(() => levelForXP(myXP), [myXP]);
  const currentTierIndex = useMemo(
    () => roadTiers.findIndex((tier) => tier.id === myLevel.id),
    [myLevel.id, roadTiers],
  );
  const currentTier = roadTiers[currentTierIndex] ?? roadTiers[0];
  const nextTier = currentTierIndex >= 0 ? roadTiers[currentTierIndex + 1] ?? null : null;
  const progressToNext = useMemo(() => tierProgress(myXP, currentTier), [currentTier, myXP]);
  const nextDrop = useMemo(() => {
    return currentTier?.drops.find((milestone) => milestone > myXP) ?? null;
  }, [currentTier, myXP]);

  const friendsRanked = useMemo(() => {
    return [...friends]
      .map((friend) => ({ user: friend, xp: xpForSport(friend, sportFilter) }))
      .sort((a, b) => b.xp - a.xp);
  }, [friends, sportFilter]);

  const allRanked = useMemo(() => {
    if (!me) return [];
    return [{ user: me, xp: myXP }, ...friendsRanked].sort((a, b) => b.xp - a.xp);
  }, [friendsRanked, me, myXP]);

  const myPlacement = useMemo(() => {
    if (!me) return 1;
    const index = allRanked.findIndex((entry) => entry.user.id === me.id);
    return index >= 0 ? index + 1 : 1;
  }, [allRanked, me]);

  const sportLabel = useMemo(() => {
    if (sportFilter === 'all') return 'All sports';
    return SPORTS.find((sport) => sport.id === sportFilter)?.name ?? 'Sport';
  }, [sportFilter]);

  const friendMarkersByTier = useMemo(() => {
    const markers = new Map<string, TierFriendMarker[]>();
    for (const tier of roadTiers) markers.set(tier.id, []);

    friendsRanked.forEach(({ user: friend, xp }, index) => {
      const tier = roadTiers.find((entry) => {
        if (entry.maxXP == null) return xp >= entry.minXP;
        return xp >= entry.minXP && xp < entry.maxXP;
      }) ?? roadTiers[0];

      const list = markers.get(tier.id) ?? [];
      list.push({ user: friend, xp, progress: tierProgress(xp, tier), index });
      markers.set(tier.id, list);
    });

    markers.forEach((list, key) => {
      markers.set(
        key,
        list.sort((a, b) => b.xp - a.xp).slice(0, 5),
      );
    });

    return markers;
  }, [friendsRanked, roadTiers]);

  const displayTiers = useMemo(() => [...roadTiers].reverse(), [roadTiers]);

  if (!me) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 right-0 top-auto bottom-0 translate-x-0 translate-y-0 w-screen max-w-none h-[92dvh] rounded-t-[28px] rounded-b-none border-border/60 bg-background p-0 shadow-2xl sm:left-1/2 sm:right-auto sm:top-[50%] sm:bottom-auto sm:h-[92vh] sm:w-[min(94vw,780px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
        <DialogHeader className="border-b border-border/50 px-4 pb-3 pt-5 sm:px-6 sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-muted sm:hidden" />
          <div className="space-y-3 pr-10 text-left">
            <div>
              <DialogTitle className="text-2xl">XP Road</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                Starts at your current spot and scrolls upward to higher tiers, just like a vertical trophy road.
              </DialogDescription>
            </div>
            <div className="w-full sm:w-[220px]">
              <Select value={sportFilter} onValueChange={(value) => setSportFilter(value as SportFilter)}>
                <SelectTrigger className="rounded-2xl bg-secondary/50">
                  <SelectValue placeholder="All sports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sports</SelectItem>
                  {SPORTS.map((sport) => (
                    <SelectItem key={sport.id} value={sport.id}>
                      {sport.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div ref={scrollRef} className="h-[calc(92dvh-112px)] overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:h-[calc(92vh-116px)] sm:px-6">
          <section className="rounded-[28px] border border-border/60 bg-gradient-to-br from-secondary/55 via-background to-secondary/30 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16 ring-2 ring-primary/25">
                <AvatarImage src={me.profilePhotoUrl} alt={me.username} />
                <AvatarFallback>{getInitials(me.username)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-bold sm:text-2xl">{me.username}</p>
                <p className="text-sm text-muted-foreground">Rank #{myPlacement} among friends in {sportLabel.toLowerCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">XP</p>
                <p className="text-2xl font-extrabold">{myXP.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-secondary/65 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current tier</p>
                <p className="mt-1 font-semibold">{currentTier.icon} {currentTier.name}</p>
              </div>
              <div className="rounded-2xl bg-secondary/65 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next tier</p>
                <p className="mt-1 font-semibold">{nextTier ? `${nextTier.icon} ${nextTier.name}` : 'Maxed'}</p>
              </div>
              <div className="rounded-2xl bg-secondary/65 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next drop</p>
                <p className="mt-1 font-semibold">{nextDrop ? `${nextDrop.toLocaleString()} XP` : 'Tier cleared'}</p>
              </div>
              <div className="rounded-2xl bg-secondary/65 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Squads</p>
                <p className="mt-1 font-semibold">{myXP >= 500 ? 'Unlocked' : `${500 - myXP} XP away`}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-background/70 p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Progress to {nextTier ? nextTier.name : 'Legend'}</span>
                <span className="text-muted-foreground">{Math.round(progressToNext * 100)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressToNext * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{currentTier.minXP.toLocaleString()} XP</span>
                <span>{nextTier ? `${nextTier.minXP.toLocaleString()} XP` : 'Legend cap reached'}</span>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[28px] border border-border/60 bg-secondary/20 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Vertical XP road</h3>
                <p className="text-sm text-muted-foreground">Swipe up to climb. Tiers, drops, and friend markers all sit on the center line.</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">{friendsLoading ? 'Loading friends…' : `${friends.length} friends`}</Badge>
            </div>

            <div className="relative mx-auto max-w-[640px] pb-2">
              <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-[4px] -translate-x-1/2 rounded-full bg-gradient-to-t from-primary via-primary/60 to-primary/20" />

              <div className="space-y-6">
                {displayTiers.map((tier, displayIndex) => {
                  const originalTierIndex = roadTiers.findIndex((entry) => entry.id === tier.id);
                  const tierActive = myXP >= tier.minXP && (tier.maxXP == null || myXP < tier.maxXP);
                  const tierUnlocked = myXP >= tier.minXP;
                  const markers = friendMarkersByTier.get(tier.id) ?? [];
                  const leftSide = displayIndex % 2 === 0;

                  return (
                    <div key={tier.id} className="relative min-h-[240px] sm:min-h-[260px]">
                      {markers.map((marker, markerIndex) => {
                        const lane = markerIndex % 2 === 0 ? -1 : 1;
                        const top = 20 + (1 - marker.progress) * 168;
                        const horizontalClass = lane < 0 ? 'right-[calc(50%+28px)]' : 'left-[calc(50%+28px)]';
                        return (
                          <div
                            key={marker.user.id}
                            className={cn(
                              'absolute z-[2] flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-2 py-1 shadow-md backdrop-blur',
                              horizontalClass,
                            )}
                            style={{ top: `${top}px` }}
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={marker.user.profilePhotoUrl} alt={marker.user.username} />
                              <AvatarFallback>{getInitials(marker.user.username)}</AvatarFallback>
                            </Avatar>
                            <div className="max-w-[90px] sm:max-w-[120px]">
                              <p className="truncate text-xs font-semibold">{marker.user.username}</p>
                              <p className="text-[10px] text-muted-foreground">{marker.xp.toLocaleString()} XP</p>
                            </div>
                          </div>
                        );
                      })}

                      <div className="relative z-[1] mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg">
                        <span className="text-2xl">{tier.icon}</span>
                      </div>

                      <div className={cn('mt-3 flex', leftSide ? 'justify-start pr-[calc(50%+24px)]' : 'justify-end pl-[calc(50%+24px)]')}>
                        <div
                          className={cn(
                            'w-full max-w-[250px] rounded-[24px] border p-4 shadow-sm backdrop-blur',
                            tierActive
                              ? 'border-primary/45 bg-primary/10'
                              : tierUnlocked
                                ? 'border-border/70 bg-background/80'
                                : 'border-border/50 bg-background/55',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-bold">{tier.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{formatTierRange(tier)}</p>
                            </div>
                            {tier.id === 'legend' ? <Crown className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {tierActive && <Badge className="rounded-full">Current</Badge>}
                            {!tierActive && tierUnlocked && <Badge variant="secondary" className="rounded-full">Unlocked</Badge>}
                            {myXP >= tier.minXP && myXP < (tier.maxXP ?? Number.MAX_SAFE_INTEGER) && nextDrop && (
                              <Badge variant="secondary" className="rounded-full">Next drop {nextDrop.toLocaleString()}</Badge>
                            )}
                          </div>

                          {originalTierIndex === 1 && (
                            <div className="mt-3 rounded-2xl bg-secondary/60 p-3 text-sm">
                              <div className="flex items-center gap-2 font-medium">
                                <Users className="h-4 w-4" />
                                Squads unlock here
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">Create and join squads once you hit 500 XP.</p>
                            </div>
                          )}

                          {tier.id === 'legend' && (
                            <div className="mt-3 rounded-2xl bg-secondary/60 p-3 text-sm">
                              <div className="flex items-center gap-2 font-medium">
                                <Crown className="h-4 w-4" />
                                Final tier
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">Top of the road. This is the endgame flex tier for the strongest players.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {tier.drops.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {tier.drops
                            .slice()
                            .reverse()
                            .map((dropXp, dropIndex) => {
                              const dropLeft = (displayIndex + dropIndex + 1) % 2 === 0;
                              const unlocked = myXP >= dropXp;
                              return (
                                <div key={`${tier.id}-${dropXp}`} className="relative flex items-center justify-center">
                                  <div className="absolute left-1/2 h-9 w-[3px] -translate-x-1/2 rounded-full bg-primary/35" />
                                  <div className="relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-secondary shadow">
                                    <Gift className={cn('h-4 w-4', unlocked ? 'text-primary' : 'text-muted-foreground')} />
                                  </div>
                                  <div className={cn('w-full pt-1', dropLeft ? 'pr-[calc(50%+24px)]' : 'pl-[calc(50%+24px)]')}>
                                    <div className={cn('flex', dropLeft ? 'justify-start' : 'justify-end')}>
                                      <div className={cn('w-full max-w-[220px] rounded-2xl border px-3 py-2 text-sm shadow-sm', unlocked ? 'border-primary/35 bg-background/90' : 'border-border/50 bg-background/65')}>
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="font-semibold">Drop</span>
                                          <span className="text-xs text-muted-foreground">{dropXp.toLocaleString()} XP</span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {unlocked ? 'Claimed on your road.' : 'Upcoming milestone reward.'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[28px] border border-border/60 bg-background/60 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Friend leaderboard</h3>
                <p className="text-sm text-muted-foreground">Your closest competition on the road.</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">{sportLabel}</Badge>
            </div>

            {friendsRanked.length === 0 ? (
              <div className="mt-4 rounded-3xl bg-secondary/40 p-6 text-center">
                <p className="font-semibold">No friends on the road yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Once you add friends, their avatars will appear beside the center XP line.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {friendsRanked.map(({ user: friend, xp }, index) => {
                  const friendLevel = levelForXP(xp);
                  return (
                    <div key={friend.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/25 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={friend.profilePhotoUrl} alt={friend.username} />
                        <AvatarFallback>{getInitials(friend.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{friend.username}</p>
                        <p className="truncate text-xs text-muted-foreground">{friendLevel.icon} {friendLevel.name}</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full">{xp.toLocaleString()} XP</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="mt-4 flex items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
            <ChevronUp className="h-4 w-4" />
            Swipe up to keep climbing the XP road
            <Swords className="h-4 w-4" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
