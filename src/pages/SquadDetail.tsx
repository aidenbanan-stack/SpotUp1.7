import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  Crown,
  Flag,
  MapPin,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Sword,
  Target,
  Trophy,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SPORTS } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  deleteSquadById,
  fetchMySquads,
  fetchSquadById,
  fetchSquadEvents,
  fetchSquadFeed,
  fetchSquadMatchHistory,
  fetchSquadMembers,
  fetchSquadRivalries,
  leaveSquadById,
  type SquadEventCard,
  type SquadFeedItem,
  type SquadMatchHistoryRow,
  type SquadMemberProfile,
  type SquadRivalry,
  type SquadRow,
} from '@/lib/squadsApi';

function formatDate(input?: string | null) {
  if (!input) return 'TBD';
  const date = new Date(input);
  if (Number.isNaN(+date)) return 'TBD';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDivisionFromRating(rating: number) {
  if (rating >= 1650) return 'Dynasty';
  if (rating >= 1500) return 'Legend';
  if (rating >= 1350) return 'Elite';
  if (rating >= 1200) return 'All-Star';
  if (rating >= 1100) return 'Regular';
  return 'Rookie';
}

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}

export default function SquadDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [squad, setSquad] = useState<SquadRow | null>(null);
  const [members, setMembers] = useState<SquadMemberProfile[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [matches, setMatches] = useState<SquadMatchHistoryRow[]>([]);
  const [rivalries, setRivalries] = useState<SquadRivalry[]>([]);
  const [events, setEvents] = useState<SquadEventCard[]>([]);
  const [feed, setFeed] = useState<SquadFeedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!id || !user?.id) return;
      setLoading(true);
      try {
        const [s, m, mine, matchRows, upcoming] = await Promise.all([
          fetchSquadById(id),
          fetchSquadMembers(id),
          fetchMySquads(user.id),
          fetchSquadMatchHistory(id),
          fetchSquadEvents(id),
        ]);
        const rivalryRows = await fetchSquadRivalries(id);
        const feedRows = await fetchSquadFeed({ squad: s, members: m, matches: matchRows });
        if (cancelled) return;
        setSquad(s);
        setMembers(m);
        setIsMember(mine.some((row) => row.id === id));
        setMatches(matchRows);
        setRivalries(rivalryRows);
        setEvents(upcoming);
        setFeed(feedRows);
      } catch (e: any) {
        console.error(e);
        toast({ title: 'Could not load squad', description: e?.message ?? 'Please try again.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id, toast]);

  const sportMeta = useMemo(() => {
    const key = (squad?.sport ?? null) as any;
    if (!key) return null;
    return SPORTS.find((s) => s.id === key) ?? null;
  }, [squad?.sport]);

  const totalXp = useMemo(() => members.reduce((sum, m) => sum + (m.xp ?? 0), 0), [members]);
  const record = `${Number(squad?.wins ?? 0)}-${Number(squad?.losses ?? 0)}`;
  const isOwner = user?.id != null && squad?.owner_id === user.id;

  const sortedMembers = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      const rank = (role: string) => {
        const normalized = role.toLowerCase();
        if (normalized === 'owner') return 0;
        if (normalized === 'captain') return 1;
        if (normalized === 'co_captain' || normalized === 'admin') return 2;
        if (normalized === 'officer') return 3;
        return 4;
      };
      const byRole = rank(a.role ?? 'member') - rank(b.role ?? 'member');
      if (byRole !== 0) return byRole;
      return (b.xp ?? 0) - (a.xp ?? 0);
    });
    return copy;
  }, [members]);

  const attendanceScore = useMemo(() => clamp(72 + members.length * 3, 0, 100), [members.length]);
  const chemistryScore = useMemo(() => clamp(60 + Math.round(totalXp / 150), 0, 100), [totalXp]);
  const reliabilityScore = useMemo(() => clamp(Number(squad?.reliability_min ?? 88) + 4, 0, 100), [squad?.reliability_min]);
  const division = getDivisionFromRating(Number(squad?.rating ?? 1000));
  const weeklyGoal = Number(squad?.weekly_goal ?? 5);
  const weeklyProgress = Math.min(weeklyGoal, Math.max(1, matches.slice(0, 7).length));
  const memberCap = Number(squad?.member_limit ?? 10);
  const openSlots = Math.max(0, memberCap - members.length);
  const rules = [
    `Minimum join XP: ${Number(squad?.min_xp_required ?? 500)}`,
    `Reliability target: ${Number(squad?.reliability_min ?? 90)}%+`,
    squad?.home_area ? `Home area: ${squad.home_area}` : 'Home area not set yet',
    squad?.home_court ? `Home court: ${squad.home_court}` : 'Home court can be added in squad settings',
  ];

  const mockAnnouncements = [
    `Next squad challenge window opens on ${new Date(Date.now() + 2 * 86400000).toLocaleDateString()}.`,
    `Recruiting focus this week: dependable ${sportMeta?.name ?? 'multi-sport'} players in ${squad?.home_area ?? 'your area'}.`,
  ];

  const suggestedUnlocks = [
    'Squad-only tournament brackets',
    'Custom squad banner themes',
    'Officer-managed announcements',
    'Advanced lineup analytics',
  ];

  async function onLeave() {
    if (!id) return;
    if (isOwner) {
      toast({ title: 'Owner cannot leave', description: 'Delete the squad instead.', variant: 'destructive' });
      return;
    }
    setLeaving(true);
    try {
      await leaveSquadById({ squadId: id });
      toast({ title: 'Left squad' });
      navigate('/squads');
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not leave squad', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setLeaving(false);
    }
  }

  async function onDelete() {
    if (!id || !isOwner) return;
    const confirmed = window.confirm('Delete this squad? This will remove all members and cannot be undone.');
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteSquadById({ squadId: id });
      toast({ title: 'Squad deleted' });
      navigate('/squads');
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not delete squad', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        <div className="text-sm text-muted-foreground">Squad HQ</div>
      </div>

      <Card className="mb-4 overflow-hidden border-primary/15">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/5 to-secondary/40" />
        <CardContent className="p-4 -mt-10 relative">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : squad ? (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-3xl bg-background border shadow-sm flex items-center justify-center text-2xl">
                    {sportMeta?.icon ?? '👥'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-2xl font-bold leading-tight">{squad.name}</div>
                      <Badge variant="secondary">{division}</Badge>
                      {(squad.vibe ?? 'competitive') ? <Badge variant="outline">{(squad.vibe ?? 'competitive').replace('_', ' ')}</Badge> : null}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {sportMeta ? <span>{sportMeta.icon} {sportMeta.name}</span> : <span>All sports</span>}
                      <span className="mx-2">•</span>
                      <span>{members.length}/{memberCap} members</span>
                      <span className="mx-2">•</span>
                      <span>{record}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {squad.home_area ? <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {squad.home_area}</span> : null}
                      <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Rtg {Number(squad.rating ?? 1000)}</span>
                      <span className="inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> {Number(squad.points ?? 0)} pts</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Squad XP</div>
                  <div className="text-3xl font-bold">{totalXp.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">Invite code {squad.invite_code || '—'}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><Users className="w-4 h-4" /> Open slots</div>
                  <div className="text-lg font-bold mt-1">{openSlots}</div>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><Target className="w-4 h-4" /> Chemistry</div>
                  <div className="text-lg font-bold mt-1">{chemistryScore}%</div>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><Bell className="w-4 h-4" /> Reliability</div>
                  <div className="text-lg font-bold mt-1">{reliabilityScore}%</div>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Weekly goal</div>
                  <div className="text-lg font-bold mt-1">{weeklyProgress}/{weeklyGoal}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm max-w-xl text-muted-foreground">
                  {squad.description ?? `${squad.name} is built for local competition, consistent runs, and long-term progression. Use this page as the full squad hub for identity, rivalry, events, and member management.`}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(squad.invite_code || '')}>Copy code</Button>
                  {isMember && !isOwner ? (
                    <Button variant="secondary" onClick={onLeave} disabled={leaving}>
                      {leaving ? 'Leaving...' : 'Leave Squad'}
                    </Button>
                  ) : null}
                  {isOwner ? (
                    <Button variant="destructive" onClick={onDelete} disabled={deleting}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleting ? 'Deleting...' : 'Delete Squad'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">Squad not found.</div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="compete">Compete</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Squad identity</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Visibility</span><span className="font-medium">{squad?.visibility ?? 'public'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Home court</span><span className="font-medium">{squad?.home_court ?? squad?.home_area ?? 'TBD'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Recruiting</span><span className="font-medium">{squad?.recruiting === false ? 'Closed' : 'Open'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Join gate</span><span className="font-medium">{Number(squad?.min_xp_required ?? 500)} XP</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Founded</span><span className="font-medium">{formatDate(squad?.created_at)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Progression</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Season progress</span>
                    <span>{weeklyProgress}/{weeklyGoal} squad goals</span>
                  </div>
                  <Progress value={(weeklyProgress / Math.max(weeklyGoal, 1)) * 100} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Attendance health</span>
                    <span>{attendanceScore}%</span>
                  </div>
                  <Progress value={attendanceScore} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Chemistry</span>
                    <span>{chemistryScore}%</span>
                  </div>
                  <Progress value={chemistryScore} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Rules and culture</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {rules.map((rule) => (
                  <div key={rule} className="rounded-lg bg-secondary/40 px-3 py-2">{rule}</div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Upcoming squad events</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {events.length > 0 ? events.map((event) => (
                  <div key={event.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{event.title}</div>
                        <div className="text-muted-foreground">{event.kind} • {formatDate(event.starts_at)}</div>
                      </div>
                      <Badge variant="outline">{event.attendee_count} going</Badge>
                    </div>
                    <div className="text-muted-foreground mt-2">{event.location}</div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No squad-only events have been linked yet. This section is ready for practices, scrimmages, tryouts, and tournaments.</div>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Unlock roadmap</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {suggestedUnlocks.map((item) => (
                <div key={item} className="rounded-xl bg-secondary/40 p-3 text-sm flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Role breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span>Leadership</span><span>{members.filter((m) => ['owner', 'captain', 'admin', 'officer', 'co_captain'].includes((m.role ?? '').toLowerCase())).length}</span></div>
                <div className="flex items-center justify-between"><span>Members</span><span>{members.filter((m) => !['owner', 'captain', 'admin', 'officer', 'co_captain'].includes((m.role ?? '').toLowerCase())).length}</span></div>
                <div className="flex items-center justify-between"><span>Open slots</span><span>{openSlots}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recruiting filters</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>{sportMeta?.name ?? 'Multi-sport'} focus</div>
                <div>{squad?.home_area ?? 'Local'} discovery priority</div>
                <div>{Number(squad?.reliability_min ?? 90)}%+ reliability target</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Leadership tools</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Promote officers</div>
                <div>Approve requests</div>
                <div>Launch challenges</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {sortedMembers.map((m, idx) => (
              <button key={m.user_id} className="w-full text-left" onClick={() => navigate(`/profile/${m.user_id}`)}>
                <Card>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">#{idx + 1}</div>
                      <div>
                        <div className="font-semibold leading-tight flex items-center gap-2 flex-wrap">
                          {m.username ?? 'Player'}
                          {(m.role ?? '').toLowerCase() === 'owner' ? <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15"><Crown className="w-3 h-3 mr-1" /> Owner</Badge> : null}
                          {(m.role ?? '').toLowerCase() === 'officer' ? <Badge variant="outline">Officer</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">Level {m.level ?? 1} • {m.role ?? 'member'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{(m.xp ?? 0).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">XP</div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
            {!loading && squad && sortedMembers.length === 0 ? <div className="text-sm text-muted-foreground">No members found.</div> : null}
          </div>
        </TabsContent>

        <TabsContent value="feed" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Announcements</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {mockAnnouncements.map((note) => (
                  <div key={note} className="rounded-xl border p-3 flex gap-2">
                    <Megaphone className="w-4 h-4 mt-0.5 text-primary" />
                    <span>{note}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Channels ready for squads</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Main chat</div>
                <div>Announcements</div>
                <div>Upcoming games</div>
                <div>Strategy and lineup</div>
                <div>Off-topic</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Activity feed</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {feed.map((item) => (
                <div key={item.id} className="rounded-xl border p-3 flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.accent ?? 'bg-secondary text-foreground'}`}>
                    {item.type === 'match' ? <Sword className="w-4 h-4" /> : item.type === 'announcement' ? <Megaphone className="w-4 h-4" /> : item.type === 'member' ? <UserPlus className="w-4 h-4" /> : item.type === 'rivalry' ? <Flag className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.created_at)}</div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{item.body}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compete" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Rivalries</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {rivalries.length > 0 ? rivalries.map((rivalry) => (
                  <div key={rivalry.opponent_name} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{rivalry.opponent_name}</div>
                        <div className="text-sm text-muted-foreground">Series {rivalry.wins}-{rivalry.losses}</div>
                      </div>
                      <Badge variant="outline">{rivalry.status}</Badge>
                    </div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No rivalry history yet. Once squad vs squad results are posted, this section auto-builds head-to-head storylines.</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Season priorities</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-lg bg-secondary/40 p-3">Win a ranked challenge</div>
                <div className="rounded-lg bg-secondary/40 p-3">Host one full-attendance run</div>
                <div className="rounded-lg bg-secondary/40 p-3">Keep team reliability above 90%</div>
                <div className="rounded-lg bg-secondary/40 p-3">Add two active members from your area</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Match history</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {matches.length > 0 ? matches.map((match) => (
                <div key={match.id} className="rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{match.outcome === 'win' ? 'Win' : 'Loss'} vs {match.opponent_name}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(match.recorded_at)} • {match.points_awarded} pts</div>
                    {match.notes ? <div className="text-sm text-muted-foreground mt-1">{match.notes}</div> : null}
                  </div>
                  <Badge className={match.outcome === 'win' ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15' : 'bg-rose-500/15 text-rose-700 hover:bg-rose-500/15'}>{match.outcome}</Badge>
                </div>
              )) : <div className="text-sm text-muted-foreground">No official squad matches recorded yet.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>What this build now supports</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Rich squad HQ overview</div>
                <div>Member hierarchy and recruiting summary</div>
                <div>Activity feed, rivalries, and match history</div>
                <div>Season goals and progression dashboard</div>
                <div>Hooks for events, announcements, and future chat channels</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Next backend wiring</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Join requests and invites tables</div>
                <div>Persistent squad settings and editable branding</div>
                <div>Squad-only chat and announcements storage</div>
                <div>Tournament roster locks and squad event RSVP tables</div>
                <div>Moderation logs, bans, and dispute review</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
