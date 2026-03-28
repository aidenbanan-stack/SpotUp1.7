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
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import { PLAYER_LEVELS, SPORTS, Sport, User } from '@/types';
import { ChevronUp, Crown, Info, Lock, Sparkles, Swords, Users, X } from 'lucide-react';

type SportFilter = Sport | 'all';

type RoadTier = {
  id: string;
  name: string;
  icon: string;
  minXP: number;
  maxXP: number | null;
  drops: number[];
};

type RoadMarker = {
  user: User;
  xp: number;
  y: number;
  isMe: boolean;
};

type MarkerCluster = {
  id: string;
  y: number;
  users: RoadMarker[];
};

const ROAD_TOP_PADDING = 96;
const ROAD_BOTTOM_PADDING = 72;
const ROAD_MAX_XP = 11000;
const TIER_CARD_HEIGHT = 94;
const TIER_SECTION_HEIGHT = 320;
const ROOKIE_CARD_OFFSET = 96;
const MARKER_CLUSTER_GAP = 34;

function xpForSport(user: User, sport: SportFilter): number {
  if (sport === 'all') return user.xp;
  if (user.primarySport === sport) return user.xp;
  if (Array.isArray(user.secondarySports) && user.secondarySports.includes(sport)) return Math.round(user.xp * 0.6);
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
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'SU'
  );
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

function getTierIndexForXP(xp: number, roadTiers: RoadTier[]) {
  for (let index = roadTiers.length - 1; index >= 0; index -= 1) {
    if (xp >= roadTiers[index].minXP) return index;
  }
  return 0;
}

function roadHeightForTierCount(tierCount: number) {
  return Math.max(0, (tierCount - 1) * TIER_SECTION_HEIGHT) + TIER_CARD_HEIGHT + ROAD_TOP_PADDING + ROAD_BOTTOM_PADDING;
}

function tierAnchorY(index: number, roadTiers: RoadTier[]) {
  const roadHeight = roadHeightForTierCount(roadTiers.length);
  const rookieOffset = index === 0 ? ROOKIE_CARD_OFFSET : 0;
  const roadBottom = roadHeight - ROAD_BOTTOM_PADDING - TIER_CARD_HEIGHT / 2 + rookieOffset;
  return roadBottom - index * TIER_SECTION_HEIGHT;
}

function xpToY(xp: number, roadTiers: RoadTier[]) {
  const clampedXP = Math.max(0, Math.min(ROAD_MAX_XP, xp));
  const tierIndex = getTierIndexForXP(clampedXP, roadTiers);
  const tier = roadTiers[tierIndex];
  const tierMax = tier.maxXP ?? ROAD_MAX_XP;
  const span = Math.max(1, tierMax - tier.minXP);
  const progress = clamp01((clampedXP - tier.minXP) / span);
  return tierAnchorY(tierIndex, roadTiers) - progress * TIER_SECTION_HEIGHT;
}

function buildTierAnchors(roadTiers: RoadTier[]) {
  return roadTiers.reduce<Record<string, number>>((acc, tier, index) => {
    acc[tier.id] = tierAnchorY(index, roadTiers);
    return acc;
  }, {});
}

function buildTierTicks(roadTiers: RoadTier[]) {
  return roadTiers.flatMap((tier, tierIndex) => {
    const tierMax = tier.maxXP ?? ROAD_MAX_XP;
    const span = tierMax - tier.minXP;
    if (span <= 0) return [] as Array<{ xp: number; tierId: string; key: string; indexInTier: number }>;

    return [0.2, 0.4, 0.6, 0.8].map((ratio, indexInTier) => ({
      xp: Math.round(tier.minXP + span * ratio),
      tierId: tier.id,
      key: `${tier.id}-${indexInTier}`,
      indexInTier,
    }));
  });
}

function getTierUnlocks(tier: RoadTier) {
  switch (tier.id) {
    case 'rookie':
      return ['Core profile progression', 'Daily XP drops', 'Join open games'];
    case 'regular':
      return ['Squads unlock at 500 XP', 'Create and join squads', 'Start climbing team rankings'];
    case 'competitor':
      return ['Higher-tier reputation flex', 'Stronger road presence', 'Competitive identity upgrade'];
    case 'playmaker':
      return ['Mid-road prestige tier', 'More visible progression flex', 'Advanced player status'];
    case 'all_star':
      return ['Top-end player tier', 'Big milestone flex', 'All-star road status'];
    case 'elite':
      return ['Elite progression tier', 'Near-endgame road status', 'High-level player flex'];
    case 'legend':
      return ['Final tier on the road', 'Endgame prestige status', 'Top of the XP climb'];
    default:
      return ['Tier reward information'];
  }
}

function clusterMarkers(markers: RoadMarker[]): MarkerCluster[] {
  if (!markers.length) return [];

  const sorted = [...markers].sort((a, b) => a.y - b.y);
  const groups: RoadMarker[][] = [];

  for (const marker of sorted) {
    const current = groups[groups.length - 1];
    if (!current) {
      groups.push([marker]);
      continue;
    }

    const avgY = current.reduce((sum, item) => sum + item.y, 0) / current.length;
    if (Math.abs(marker.y - avgY) <= MARKER_CLUSTER_GAP) {
      current.push(marker);
    } else {
      groups.push([marker]);
    }
  }

  return groups.map((group, index) => ({
    id: `cluster-${index}`,
    y: group.reduce((sum, item) => sum + item.y, 0) / group.length,
    users: group.sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.xp - a.xp),
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<MarkerCluster | null>(null);
  const [selectedTier, setSelectedTier] = useState<RoadTier | null>(null);
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
    const scrollToBottom = () => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
    };

    const frame = window.requestAnimationFrame(scrollToBottom);
    const timeout = window.setTimeout(scrollToBottom, 140);

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

  const markerClusters = useMemo(() => {
    if (!me) return [];
    const markers: RoadMarker[] = [
      { user: me, xp: myXP, y: xpToY(myXP, roadTiers), isMe: true },
      ...friendsRanked.map(({ user: friend, xp }) => ({
        user: friend,
        xp,
        y: xpToY(xp, roadTiers),
        isMe: false,
      })),
    ];

    return clusterMarkers(markers);
  }, [friendsRanked, me, myXP, roadTiers]);

  const tierAnchors = useMemo(() => buildTierAnchors(roadTiers), [roadTiers]);
  const roadHeight = useMemo(() => roadHeightForTierCount(roadTiers.length), [roadTiers]);
  const visibleTicks = useMemo(() => buildTierTicks(roadTiers), [roadTiers]);

  const openProfile = (userId: string) => {
    setSelectedUserId(userId);
    setProfileOpen(true);
  };

  if (!me) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="inset-0 left-0 right-0 top-0 bottom-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-background p-0 shadow-none sm:inset-0 sm:h-[100dvh] sm:w-screen sm:max-w-none sm:rounded-none">
          <DialogHeader className="sticky top-0 z-20 border-b border-border/50 bg-background/95 px-4 pb-3 pt-5 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-sm transition hover:bg-secondary"
              aria-label="Close XP Road"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-muted sm:hidden" />
            <div className="space-y-3 pr-10 text-left">
              <div>
                <DialogTitle className="text-3xl font-extrabold">XP Road</DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  Starts at 0 XP at the bottom. Swipe up to climb through drops, tiers, and your friends.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-full max-w-[220px]">
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
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {friendsLoading ? 'Loading…' : `${friends.length + 1} on road`}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div
            ref={scrollRef}
            className="h-[calc(100dvh-118px)] overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.08),transparent_26%),linear-gradient(to_bottom,rgba(9,9,11,0.92),rgba(2,6,23,1))] px-3 pb-10 pt-4 sm:px-6"
          >
            <section className="mx-auto max-w-[760px] rounded-[28px] border border-border/60 bg-background/55 p-4 shadow-sm backdrop-blur sm:p-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 ring-2 ring-primary">
                  <AvatarImage src={me.profilePhotoUrl} alt={me.username} />
                  <AvatarFallback>{getInitials(me.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold sm:text-xl">{me.username}</p>
                  <p className="text-sm text-muted-foreground">Rank #{myPlacement} among friends in {sportLabel.toLowerCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">XP</p>
                  <p className="text-2xl font-extrabold">{myXP.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-secondary/65 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tier</p>
                  <p className="mt-1 font-semibold">{currentTier.icon} {currentTier.name}</p>
                </div>
                <div className="rounded-2xl bg-secondary/65 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next tier</p>
                  <p className="mt-1 font-semibold">{nextTier ? `${nextTier.icon} ${nextTier.name}` : 'Maxed'}</p>
                </div>
                <div className="rounded-2xl bg-secondary/65 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Road</p>
                  <p className="mt-1 font-semibold">0 to {ROAD_MAX_XP.toLocaleString()} XP</p>
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

            <section className="mx-auto mt-4 max-w-[760px] rounded-[32px] border border-border/60 bg-background/35 p-3 shadow-sm backdrop-blur sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div>
                  <h3 className="text-lg font-bold">Road</h3>
                  <p className="text-sm text-muted-foreground">Ticks and profiles follow exact XP positions on the center road.</p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {sportLabel}
                </Badge>
              </div>

              <div className="relative mx-auto w-full max-w-[720px] overflow-hidden rounded-[28px] border border-border/40 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-2 py-3 sm:px-4">
                <div
                  className="relative mx-auto"
                  style={{ height: roadHeight }}
                >
                  <div className="absolute bottom-[36px] left-1/2 top-[36px] w-[6px] -translate-x-1/2 rounded-full bg-gradient-to-t from-primary via-primary/80 to-primary/30 shadow-[0_0_24px_rgba(239,68,68,0.35)]" />

                  {visibleTicks.map((tick) => {
                    const y = xpToY(tick.xp, roadTiers);
                    return (
                      <div key={tick.key} className="absolute left-1/2 z-[1]" style={{ top: y, transform: 'translate(-50%, -50%)' }}>
                        <div className="relative h-5 w-0">
                          <div className="absolute left-1/2 top-1/2 h-[3px] w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 shadow-sm" />
                          <div
                            className={cn(
                              'absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold leading-none text-muted-foreground',
                              tick.indexInTier % 2 === 0 ? 'left-[28px]' : 'right-[28px] text-right',
                            )}
                          >
                            {tick.xp.toLocaleString()} XP
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {roadTiers.map((tier) => {
                    const y = tierAnchors[tier.id] ?? xpToY(tier.minXP, roadTiers);
                    const tierActive = myXP >= tier.minXP && (tier.maxXP == null || myXP < tier.maxXP);
                    const tierUnlocked = myXP >= tier.minXP;
                    return (
                      <div
                        key={tier.id}
                        className="absolute left-1/2 z-[3] w-[min(84vw,360px)]"
                        style={{ top: y, transform: 'translate(-50%, -50%)' }}
                      >
                        <div
                          className={cn(
                            'rounded-[22px] border px-3 py-2.5 shadow-lg backdrop-blur-md',
                            tierActive
                              ? 'border-primary/60 bg-background/96 shadow-[0_12px_32px_rgba(239,68,68,0.18)]'
                              : tierUnlocked
                                ? 'border-border/70 bg-background/90'
                                : 'border-border/45 bg-background/75',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary text-xl text-primary-foreground shadow-sm">
                              <span>{tier.icon}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-base font-bold">{tier.name}</p>
                                {tier.id === 'legend' ? <Crown className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
                              </div>
                              <p className="text-xs text-muted-foreground">{formatTierRange(tier)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedTier(tier)}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/55 transition hover:bg-secondary"
                              aria-label={`View unlocks for ${tier.name}`}
                            >
                              {tierUnlocked ? <Info className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {markerClusters.map((cluster) => {
                    const isGrouped = cluster.users.length > 1;
                    return (
                      <button
                        key={cluster.id}
                        type="button"
                        onClick={() => {
                          if (cluster.users.length === 1) {
                            openProfile(cluster.users[0].user.id);
                            return;
                          }
                          setSelectedCluster(cluster);
                        }}
                        className="absolute left-1/2 z-[4]"
                        style={{ top: cluster.y, transform: 'translate(-50%, -50%)' }}
                        aria-label={isGrouped ? 'Open grouped profiles' : `Open ${cluster.users[0].user.username} profile`}
                      >
                        <div className="flex items-center rounded-full border border-border/60 bg-background/96 px-2 py-1.5 shadow-lg backdrop-blur-md">
                          <div className="flex items-center">
                            {cluster.users.slice(0, 4).map((marker, index) => (
                              <div key={marker.user.id} className={cn('relative', index > 0 && '-ml-3')}>
                                <Avatar className={cn('h-9 w-9 border-2 shadow-sm', marker.isMe ? 'border-red-500 ring-2 ring-red-500/20' : 'border-background')}>
                                  <AvatarImage src={marker.user.profilePhotoUrl} alt={marker.user.username} />
                                  <AvatarFallback>{getInitials(marker.user.username)}</AvatarFallback>
                                </Avatar>
                              </div>
                            ))}
                          </div>
                          {isGrouped && (
                            <div className="ml-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-xs font-semibold">
                              +{Math.max(0, cluster.users.length - 3)}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="mx-auto mt-4 flex max-w-[760px] items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
              <ChevronUp className="h-4 w-4" />
              Swipe up to climb the XP road
              <Swords className="h-4 w-4" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PlayerProfileDialog open={profileOpen} onOpenChange={setProfileOpen} userId={selectedUserId} />

      <Dialog open={Boolean(selectedCluster)} onOpenChange={(value) => !value && setSelectedCluster(null)}>
        <DialogContent className="max-w-md rounded-[28px] border-border/60 bg-background/95 p-0 backdrop-blur">
          <DialogHeader className="border-b border-border/50 px-5 pb-3 pt-5 text-left">
            <DialogTitle>Profiles here</DialogTitle>
            <DialogDescription>
              Open any profile from this road spot or tier group.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] space-y-2 overflow-y-auto p-4">
            {selectedCluster?.users.map((marker) => (
              <button
                key={marker.user.id}
                type="button"
                onClick={() => {
                  setSelectedCluster(null);
                  openProfile(marker.user.id);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-secondary/25 p-3 text-left transition hover:bg-secondary/40"
              >
                <Avatar className={cn('h-11 w-11 border-2', marker.isMe ? 'border-red-500' : 'border-background')}>
                  <AvatarImage src={marker.user.profilePhotoUrl} alt={marker.user.username} />
                  <AvatarFallback>{getInitials(marker.user.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{marker.user.username}{marker.isMe ? ' (You)' : ''}</p>
                  <p className="text-xs text-muted-foreground">{marker.xp.toLocaleString()} XP</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTier)} onOpenChange={(value) => !value && setSelectedTier(null)}>
        <DialogContent className="max-w-md rounded-[28px] border-border/60 bg-background/95 p-0 backdrop-blur">
          <DialogHeader className="border-b border-border/50 px-5 pb-3 pt-5 text-left">
            <DialogTitle>{selectedTier?.icon} {selectedTier?.name}</DialogTitle>
            <DialogDescription>
              {selectedTier ? formatTierRange(selectedTier) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            {selectedTier && getTierUnlocks(selectedTier).map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-secondary/25 p-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  {selectedTier.minXP <= myXP ? <Info className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </div>
                <p className="text-sm">{item}</p>
              </div>
            ))}
            {selectedTier?.id === 'regular' && (
              <div className="flex items-start gap-3 rounded-2xl border border-primary/35 bg-primary/10 p-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm">Squads unlock here and stay unlocked once you pass 500 XP.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
