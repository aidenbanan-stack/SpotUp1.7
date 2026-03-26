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
import { SPORTS, type SquadChannel, type SquadJoinQuestion, type SquadSettings, type SquadStep1Data, type SquadTag } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  deleteSquadById,
  fetchMySquads,
  fetchSquadById,
  fetchSquadEvents,
  fetchSquadFeed,
  fetchSquadMatchHistory,
  fetchSquadMembers,
  fetchSquadRivalries,
  fetchSquadStep1Data,
  leaveSquadById,
  replaceSquadChannels,
  replaceSquadJoinQuestions,
  replaceSquadTags,
  updateSquadProfile,
  upsertSquadSettings,
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
  const [step1Data, setStep1Data] = useState<SquadStep1Data | null>(null);
  const [savingStep1, setSavingStep1] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    home_area: '',
    home_court: '',
    visibility: 'public' as 'public' | 'request' | 'invite_only',
    vibe: 'competitive' as 'casual' | 'competitive' | 'balanced',
    weekly_goal: '5',
    min_xp_required: '500',
    member_limit: '10',
    primary_color: '#2563eb',
    secondary_color: '#22c55e',
    reliability_min: '90',
    recruiting: true,
  });
  const [settingsForm, setSettingsForm] = useState<SquadSettings>({
    squad_id: '',
    motto: '',
    banner_url: '',
    logo_url: '',
    recruiting_status: 'open',
    preferred_days: [],
    skill_focus: [],
    age_min: null,
    age_max: null,
    gender_focus: 'open',
    rules: [],
    allow_member_invites: false,
    allow_officer_announcements: true,
    join_questions_enabled: true,
    require_join_message: false,
    updated_at: null,
  });
  const [tagsText, setTagsText] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [preferredDaysText, setPreferredDaysText] = useState('');
  const [skillFocusText, setSkillFocusText] = useState('');
  const [questionsDraft, setQuestionsDraft] = useState<{ question_text: string; is_required: boolean }[]>([]);
  const [channelsDraft, setChannelsDraft] = useState<{ channel_key: string; channel_name: string; is_private: boolean }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!id || !user?.id) return;
      setLoading(true);
      try {
        const [m, mine, matchRows, upcoming, step1] = await Promise.all([
          fetchSquadMembers(id),
          fetchMySquads(user.id),
          fetchSquadMatchHistory(id),
          fetchSquadEvents(id),
          fetchSquadStep1Data(id),
        ]);
        const rivalryRows = await fetchSquadRivalries(id);
        const feedRows = await fetchSquadFeed({ squad: step1.squad, members: m, matches: matchRows });
        if (cancelled) return;
        setSquad(step1.squad);
        setStep1Data(step1);
        setMembers(m);
        setIsMember(mine.some((row) => row.id === id));
        setMatches(matchRows);
        setRivalries(rivalryRows);
        setEvents(upcoming);
        setFeed(feedRows);
        setProfileForm({
          name: step1.squad.name ?? '',
          description: step1.squad.description ?? '',
          home_area: step1.squad.home_area ?? '',
          home_court: step1.squad.home_court ?? '',
          visibility: (step1.squad.visibility ?? 'public') as 'public' | 'request' | 'invite_only',
          vibe: (step1.squad.vibe ?? 'competitive') as 'casual' | 'competitive' | 'balanced',
          weekly_goal: String(Number(step1.squad.weekly_goal ?? 5)),
          min_xp_required: String(Number(step1.squad.min_xp_required ?? 500)),
          member_limit: String(Number(step1.squad.member_limit ?? 10)),
          primary_color: step1.squad.primary_color ?? '#2563eb',
          secondary_color: step1.squad.secondary_color ?? '#22c55e',
          reliability_min: String(Number(step1.squad.reliability_min ?? 90)),
          recruiting: step1.squad.recruiting !== false,
        });
        setSettingsForm(step1.settings);
        setTagsText(step1.tags.map((tag) => tag.tag).join(', '));
        setRulesText(step1.settings.rules.join('\n'));
        setPreferredDaysText(step1.settings.preferred_days.join(', '));
        setSkillFocusText(step1.settings.skill_focus.join(', '));
        setQuestionsDraft(step1.joinQuestions.map((item) => ({ question_text: item.question_text, is_required: item.is_required })));
        setChannelsDraft(step1.channels.map((item) => ({ channel_key: item.channel_key, channel_name: item.channel_name, is_private: item.is_private })));
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

  async function reloadStep1() {
    if (!id || !squad) return;
    const fresh = await fetchSquadStep1Data(id);
    setStep1Data(fresh);
    setSquad(fresh.squad);
  }

  async function onSaveStep1() {
    if (!id || !squad || !isOwner) return;
    setSavingStep1(true);
    try {
      const updatedSquad = await updateSquadProfile({
        squadId: id,
        updates: {
          name: profileForm.name,
          description: profileForm.description,
          home_area: profileForm.home_area,
          home_court: profileForm.home_court,
          visibility: profileForm.visibility,
          vibe: profileForm.vibe,
          weekly_goal: Number(profileForm.weekly_goal || '5'),
          min_xp_required: Number(profileForm.min_xp_required || '0'),
          member_limit: Number(profileForm.member_limit || '10'),
          primary_color: profileForm.primary_color,
          secondary_color: profileForm.secondary_color,
          reliability_min: Number(profileForm.reliability_min || '90'),
          recruiting: profileForm.recruiting,
        },
      });

      const updatedSettings = await upsertSquadSettings({
        squadId: id,
        settings: {
          ...settingsForm,
          motto: settingsForm.motto,
          banner_url: settingsForm.banner_url,
          logo_url: settingsForm.logo_url,
          preferred_days: preferredDaysText.split(',').map((item) => item.trim()).filter(Boolean),
          skill_focus: skillFocusText.split(',').map((item) => item.trim()).filter(Boolean),
          rules: rulesText.split('\n').map((item) => item.trim()).filter(Boolean),
        },
      });

      await replaceSquadTags({
        squadId: id,
        tags: tagsText.split(',').map((item) => item.trim()).filter(Boolean),
      });

      await replaceSquadJoinQuestions({
        squadId: id,
        questions: questionsDraft,
      });

      await replaceSquadChannels({
        squadId: id,
        channels: channelsDraft,
      });

      setSquad(updatedSquad);
      setSettingsForm(updatedSettings);
      await reloadStep1();
      toast({ title: 'Step 1 saved', description: 'Squad data model settings are now updated.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not save step 1', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingStep1(false);
    }
  }

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
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader><CardTitle>Pending queue</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Join requests</span><span className="font-semibold">{step1Data?.pending.joinRequests ?? 0}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Invites</span><span className="font-semibold">{step1Data?.pending.invites ?? 0}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Bans</span><span className="font-semibold">{step1Data?.pending.bans ?? 0}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Audit rows</span><span className="font-semibold">{step1Data?.pending.audits ?? 0}</span></div>
              </CardContent>
            </Card>
            <Card className="md:col-span-3">
              <CardHeader><CardTitle>Step 1 data model expansion</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>This build now stores richer squad profile data, settings, rules, tags, join questions, channels, and moderation-ready counts.</div>
                <div>Step 2 will plug these structures into real join request workflows, invite flows, and editable role management UI.</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Squad profile</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Name</Label><Input value={profileForm.name} disabled={!isOwner} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={profileForm.description} disabled={!isOwner} rows={3} onChange={(e) => setProfileForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Home area</Label><Input value={profileForm.home_area} disabled={!isOwner} onChange={(e) => setProfileForm((prev) => ({ ...prev, home_area: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Home court</Label><Input value={profileForm.home_court} disabled={!isOwner} onChange={(e) => setProfileForm((prev) => ({ ...prev, home_court: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Visibility</Label><Select value={profileForm.visibility} disabled={!isOwner} onValueChange={(value) => setProfileForm((prev) => ({ ...prev, visibility: value as 'public' | 'request' | 'invite_only' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="request">Request</SelectItem><SelectItem value="invite_only">Invite only</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Vibe</Label><Select value={profileForm.vibe} disabled={!isOwner} onValueChange={(value) => setProfileForm((prev) => ({ ...prev, vibe: value as 'casual' | 'competitive' | 'balanced' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="casual">Casual</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="competitive">Competitive</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Weekly goal</Label><Input type="number" disabled={!isOwner} value={profileForm.weekly_goal} onChange={(e) => setProfileForm((prev) => ({ ...prev, weekly_goal: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Minimum XP</Label><Input type="number" disabled={!isOwner} value={profileForm.min_xp_required} onChange={(e) => setProfileForm((prev) => ({ ...prev, min_xp_required: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Member limit</Label><Input type="number" disabled={!isOwner} value={profileForm.member_limit} onChange={(e) => setProfileForm((prev) => ({ ...prev, member_limit: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Reliability minimum</Label><Input type="number" disabled={!isOwner} value={profileForm.reliability_min} onChange={(e) => setProfileForm((prev) => ({ ...prev, reliability_min: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Primary color</Label><Input type="color" disabled={!isOwner} value={profileForm.primary_color} onChange={(e) => setProfileForm((prev) => ({ ...prev, primary_color: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Secondary color</Label><Input type="color" disabled={!isOwner} value={profileForm.secondary_color} onChange={(e) => setProfileForm((prev) => ({ ...prev, secondary_color: e.target.value }))} /></div>
              <div className="rounded-xl border p-3 md:col-span-2 flex items-center justify-between">
                <div><div className="font-medium">Recruiting open</div><div className="text-sm text-muted-foreground">Allow discovery and incoming members.</div></div>
                <Switch disabled={!isOwner} checked={profileForm.recruiting} onCheckedChange={(checked) => setProfileForm((prev) => ({ ...prev, recruiting: checked }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Settings and culture</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Motto</Label><Input value={settingsForm.motto} disabled={!isOwner} onChange={(e) => setSettingsForm((prev) => ({ ...prev, motto: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Recruiting status</Label><Select value={settingsForm.recruiting_status} disabled={!isOwner} onValueChange={(value) => setSettingsForm((prev) => ({ ...prev, recruiting_status: value as SquadSettings['recruiting_status'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="selective">Selective</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Gender focus</Label><Select value={settingsForm.gender_focus} disabled={!isOwner} onValueChange={(value) => setSettingsForm((prev) => ({ ...prev, gender_focus: value as SquadSettings['gender_focus'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="mens">Mens</SelectItem><SelectItem value="womens">Womens</SelectItem><SelectItem value="coed">Co-ed</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Preferred days</Label><Input value={preferredDaysText} disabled={!isOwner} onChange={(e) => setPreferredDaysText(e.target.value)} placeholder="Mon, Wed, Sat" /></div>
              <div className="space-y-2"><Label>Skill focus</Label><Input value={skillFocusText} disabled={!isOwner} onChange={(e) => setSkillFocusText(e.target.value)} placeholder="Defense, spacing, pace" /></div>
              <div className="space-y-2"><Label>Tags</Label><Input value={tagsText} disabled={!isOwner} onChange={(e) => setTagsText(e.target.value)} placeholder="local, reliable, weekend" /></div>
              <div className="space-y-2 md:col-span-2"><Label>Rules</Label><Textarea value={rulesText} disabled={!isOwner} rows={5} onChange={(e) => setRulesText(e.target.value)} placeholder="One rule per line" /></div>
              <div className="rounded-xl border p-3 flex items-center justify-between">
                <div><div className="font-medium">Allow member invites</div><div className="text-sm text-muted-foreground">Members can invite people without officer approval.</div></div>
                <Switch disabled={!isOwner} checked={settingsForm.allow_member_invites} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, allow_member_invites: checked }))} />
              </div>
              <div className="rounded-xl border p-3 flex items-center justify-between">
                <div><div className="font-medium">Officer announcements</div><div className="text-sm text-muted-foreground">Officers can push official squad updates.</div></div>
                <Switch disabled={!isOwner} checked={settingsForm.allow_officer_announcements} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, allow_officer_announcements: checked }))} />
              </div>
              <div className="rounded-xl border p-3 flex items-center justify-between">
                <div><div className="font-medium">Enable join questions</div><div className="text-sm text-muted-foreground">Show question prompts in the application flow.</div></div>
                <Switch disabled={!isOwner} checked={settingsForm.join_questions_enabled} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, join_questions_enabled: checked }))} />
              </div>
              <div className="rounded-xl border p-3 flex items-center justify-between">
                <div><div className="font-medium">Require join message</div><div className="text-sm text-muted-foreground">Applicants must include a note.</div></div>
                <Switch disabled={!isOwner} checked={settingsForm.require_join_message} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, require_join_message: checked }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Join questions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {questionsDraft.length > 0 ? questionsDraft.map((question, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <Input value={question.question_text} disabled={!isOwner} onChange={(e) => setQuestionsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, question_text: e.target.value } : item))} />
                  <Button type="button" variant={question.is_required ? 'default' : 'secondary'} disabled={!isOwner} onClick={() => setQuestionsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, is_required: !item.is_required } : item))}>
                    {question.is_required ? 'Required' : 'Optional'}
                  </Button>
                  <Button type="button" variant="ghost" disabled={!isOwner} onClick={() => setQuestionsDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                </div>
              )) : <div className="text-sm text-muted-foreground">No join questions yet.</div>}
              <Button type="button" variant="secondary" disabled={!isOwner} onClick={() => setQuestionsDraft((prev) => [...prev, { question_text: '', is_required: true }])}>Add question</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Channels</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {channelsDraft.map((channel, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                  <Input value={channel.channel_name} disabled={!isOwner} placeholder="Channel name" onChange={(e) => setChannelsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, channel_name: e.target.value } : item))} />
                  <Input value={channel.channel_key} disabled={!isOwner} placeholder="channel_key" onChange={(e) => setChannelsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, channel_key: e.target.value } : item))} />
                  <Button type="button" variant={channel.is_private ? 'default' : 'secondary'} disabled={!isOwner} onClick={() => setChannelsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, is_private: !item.is_private } : item))}>
                    {channel.is_private ? 'Private' : 'Public'}
                  </Button>
                  <Button type="button" variant="ghost" disabled={!isOwner} onClick={() => setChannelsDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" disabled={!isOwner} onClick={() => setChannelsDraft((prev) => [...prev, { channel_key: 'new_channel', channel_name: 'New Channel', is_private: false }])}>Add channel</Button>
            </CardContent>
          </Card>

          {isOwner ? (
            <Button onClick={onSaveStep1} disabled={savingStep1}>
              {savingStep1 ? 'Saving step 1...' : 'Save step 1 data model'}
            </Button>
          ) : (
            <Card><CardContent className="p-4 text-sm text-muted-foreground">Only the squad owner can edit step 1 settings right now.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
