import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, MapPin, Plus, Search, ShieldCheck, Sparkles, Swords, Trophy, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Sport } from '@/types';
import { SPORTS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  createSquad,
  fetchMySquads,
  joinSquadById,
  replaceSquadChannels,
  replaceSquadJoinQuestions,
  replaceSquadTags,
  searchSquads,
  type SquadDiscoverRow,
  type SquadWithMeta,
  updateSquadProfile,
  upsertSquadSettings,
} from '@/lib/squadsApi';

const DEFAULT_CHANNELS = [
  { channel_key: 'main', channel_name: 'Main chat', is_private: false },
  { channel_key: 'announcements', channel_name: 'Announcements', is_private: false },
  { channel_key: 'strategy', channel_name: 'Strategy', is_private: true },
];

export default function Squads() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [mySquads, setMySquads] = useState<SquadWithMeta[]>([]);
  const [discoverSquads, setDiscoverSquads] = useState<SquadDiscoverRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'my' | 'discover'>('my');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState<Sport | 'none'>('none');
  const [newDescription, setNewDescription] = useState('');
  const [newHomeCourt, setNewHomeCourt] = useState('');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#2563eb');
  const [newSecondaryColor, setNewSecondaryColor] = useState('#22c55e');
  const [newVisibility, setNewVisibility] = useState<'public' | 'request' | 'invite_only'>('public');
  const [newVibe, setNewVibe] = useState<'casual' | 'competitive' | 'balanced'>('competitive');
  const [newMemberLimit, setNewMemberLimit] = useState('10');
  const [newWeeklyGoal, setNewWeeklyGoal] = useState('5');
  const [newReliabilityMin, setNewReliabilityMin] = useState('90');
  const [newRecruiting, setNewRecruiting] = useState(true);
  const [newMotto, setNewMotto] = useState('');
  const [newTags, setNewTags] = useState('local, active, reliable');
  const [newRules, setNewRules] = useState('Show up on time\nCommunicate if late\nRespect every run');
  const [newQuestions, setNewQuestions] = useState('What position do you usually play?\nWhat days are you free?');
  const [newPreferredDays, setNewPreferredDays] = useState('Mon, Wed, Sat');
  const [newSkillFocus, setNewSkillFocus] = useState('Consistency, Defense, Team play');
  const [newRequireJoinMessage, setNewRequireJoinMessage] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);
  const [minJoinXp, setMinJoinXp] = useState('500');
  const [busyJoinId, setBusyJoinId] = useState<string | null>(null);

  const joinUnlocked = (user?.xp ?? 0) >= 500;
  const createUnlocked = (user?.xp ?? 0) >= 500;
  const cityLabel = user?.city?.trim() || 'your area';

  const sportIcon = (sport: Sport | null) => {
    if (!sport) return '👥';
    return (SPORTS.find((s) => s.id === sport)?.icon) ?? '🏀';
  };

  const sportLabel = (sport: Sport | null) => {
    if (!sport) return 'Any sport';
    return (SPORTS.find((s) => s.id === sport)?.name) ?? sport;
  };

  async function refreshMySquads() {
    if (!user?.id) return;
    setLoadingMy(true);
    try {
      setMySquads(await fetchMySquads(user.id));
    } catch (e) {
      console.error(e);
      setMySquads([]);
    } finally {
      setLoadingMy(false);
    }
  }

  async function refreshDiscover(query?: string) {
    if (!user?.id) return;
    setLoadingDiscover(true);
    try {
      const data = await searchSquads({
        userId: user.id,
        query: query ?? search,
        limit: 30,
      });
      setDiscoverSquads(data);
    } catch (e) {
      console.error(e);
      setDiscoverSquads([]);
    } finally {
      setLoadingDiscover(false);
    }
  }

  useEffect(() => {
    void refreshMySquads();
    void refreshDiscover('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (tab === 'discover') {
        void refreshDiscover();
      }
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab, user?.city]);

  const areaSquads = useMemo(() => discoverSquads.filter((s) => s.is_nearby), [discoverSquads]);
  const otherSquads = useMemo(() => {
    const areaIds = new Set(areaSquads.map((s) => s.id));
    return discoverSquads.filter((s) => !areaIds.has(s.id));
  }, [areaSquads, discoverSquads]);

  async function onCreate() {
    if (!user?.id || busyCreate) return;
    setBusyCreate(true);
    try {
      const created = await createSquad({
        userId: user.id,
        name: newName.trim(),
        sport: newSport === 'none' ? null : (newSport as Sport),
        homeArea: user.city,
        minXpRequired: Number(minJoinXp || '500'),
      });

      await updateSquadProfile({
        squadId: created.id,
        updates: {
          description: newDescription.trim() || null,
          home_court: newHomeCourt.trim() || null,
          primary_color: newPrimaryColor,
          secondary_color: newSecondaryColor,
          visibility: newVisibility,
          vibe: newVibe,
          member_limit: Number(newMemberLimit || '10'),
          weekly_goal: Number(newWeeklyGoal || '5'),
          reliability_min: Number(newReliabilityMin || '90'),
          recruiting: newRecruiting,
          min_xp_required: Number(minJoinXp || '500'),
        },
      });

      await upsertSquadSettings({
        squadId: created.id,
        settings: {
          motto: newMotto,
          banner_url: '',
          logo_url: '',
          recruiting_status: newRecruiting ? 'open' : 'closed',
          preferred_days: newPreferredDays.split(',').map((item) => item.trim()).filter(Boolean),
          skill_focus: newSkillFocus.split(',').map((item) => item.trim()).filter(Boolean),
          age_min: null,
          age_max: null,
          gender_focus: 'open',
          rules: newRules.split('\n').map((item) => item.trim()).filter(Boolean),
          allow_member_invites: false,
          allow_officer_announcements: true,
          join_questions_enabled: true,
          require_join_message: newRequireJoinMessage,
        },
      });

      await replaceSquadTags({
        squadId: created.id,
        tags: newTags.split(',').map((item) => item.trim()).filter(Boolean),
      });

      await replaceSquadJoinQuestions({
        squadId: created.id,
        questions: newQuestions
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((question) => ({ question_text: question, is_required: true })),
      });

      await replaceSquadChannels({ squadId: created.id, channels: DEFAULT_CHANNELS });

      setCreateOpen(false);
      setNewName('');
      setNewSport('none');
      setNewDescription('');
      setNewHomeCourt('');
      setNewMotto('');
      setNewTags('local, active, reliable');
      setNewRules('Show up on time\nCommunicate if late\nRespect every run');
      setNewQuestions('What position do you usually play?\nWhat days are you free?');
      setNewPreferredDays('Mon, Wed, Sat');
      setNewSkillFocus('Consistency, Defense, Team play');
      setMinJoinXp('500');
      await refreshMySquads();
      await refreshDiscover('');
      navigate(`/squad/${created.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not create squad.');
    } finally {
      setBusyCreate(false);
    }
  }

  async function onJoin(squadId: string) {
    if (!user?.id) return;
    setBusyJoinId(squadId);
    try {
      await joinSquadById({ squadId });
      await refreshMySquads();
      await refreshDiscover(search);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not join squad.');
    } finally {
      setBusyJoinId(null);
    }
  }

  const SquadCard = ({ squad, showJoin }: { squad: SquadDiscoverRow | SquadWithMeta; showJoin?: boolean }) => {
    const record = `${Number(squad.wins ?? 0)}-${Number(squad.losses ?? 0)}`;
    const membersLabel = `${squad.member_count}/${Number(squad.member_limit ?? 10)}`;
    const discover = squad as SquadDiscoverRow;
    return (
      <div className="glass-card p-4">
        <div className="flex items-start justify-between gap-3">
          <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/squad/${squad.id}`)}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary/70 flex items-center justify-center text-lg border border-border/60">
                {sportIcon(squad.sport ?? null)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold truncate">{squad.name}</p>
                  {'is_owner' in squad && squad.is_owner ? (
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs">Owner</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground truncate">{sportLabel(squad.sport ?? null)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {membersLabel}</span>
                  <span className="inline-flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> {record}</span>
                  <span>{Number(squad.points ?? 0)} pts</span>
                  <span>Rtg {Number(squad.rating ?? 1000)}</span>
                </div>
                {squad.home_area ? (
                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {squad.home_area}
                  </div>
                ) : null}
              </div>
            </div>
          </button>
          {showJoin ? (
            discover.is_member ? (
              <Button variant="secondary" disabled>Joined</Button>
            ) : (
              <Button
                onClick={() => onJoin(squad.id)}
                disabled={busyJoinId === squad.id || !discover.can_join || !joinUnlocked}
              >
                {busyJoinId === squad.id ? 'Joining...' : squad.visibility === 'request' ? 'Request' : 'Join'}
              </Button>
            )
          ) : null}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Minimum XP to join: {Number(squad.min_xp_required ?? 500).toLocaleString()} • {squad.visibility ?? 'public'} • {squad.vibe ?? 'competitive'}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Squads</h1>
          <button
            onClick={() => {
              if (!createUnlocked) {
                alert('You need 500 XP to create a squad.');
                return;
              }
              setCreateOpen(true);
            }}
            className="p-2 rounded-xl bg-secondary/60"
            aria-label="Create squad"
            title="Create"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 max-w-3xl mx-auto space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-card p-5 text-center">
            <p className="font-semibold">Squad requirements</p>
            <p className="text-sm text-muted-foreground mt-1">
              Join at 500 XP. Create at 500 XP. Squads cap at 10 by default, but step 1 now supports adjustable member limits, visibility modes, culture rules, join questions, and dedicated channels.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              You currently have {(user?.xp ?? 0).toLocaleString()} XP{user?.city ? ` • Area: ${user.city}` : ''}.
            </p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="w-4 h-4 text-primary" /> Step 1 now covers</div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>Expanded squad profile and settings model</div>
              <div>Tags, rules, channels, and join questions</div>
              <div>Moderation and queue-ready data structure</div>
            </div>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 font-semibold"><Flag className="w-4 h-4 text-primary" /> Best use for squads</div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>Local crews</div>
              <div>Competitive friend groups</div>
              <div>Tournament-ready teams</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition', tab === 'my' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground')} onClick={() => setTab('my')}>
            My Squads
          </button>
          <button className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition', tab === 'discover' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground')} onClick={() => setTab('discover')}>
            Discover Squads
          </button>
        </div>

        {tab === 'my' ? (
          loadingMy ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">Loading squads...</div>
          ) : mySquads.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <p className="font-semibold">No squads yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create one or discover squads in your area.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => setTab('discover')}>Discover</Button>
                <Button onClick={() => setCreateOpen(true)} disabled={!createUnlocked}>Create</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {mySquads.map((squad) => <SquadCard key={squad.id} squad={squad} />)}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search squads near ${cityLabel}`} className="border-0 px-0 focus-visible:ring-0" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Nearby to {cityLabel}</div>
              {loadingDiscover ? <div className="glass-card p-5 text-sm text-muted-foreground">Searching squads...</div> : areaSquads.length > 0 ? areaSquads.map((squad) => <SquadCard key={squad.id} squad={squad} showJoin />) : <div className="glass-card p-5 text-sm text-muted-foreground">No nearby squads yet.</div>}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> More squads</div>
              {otherSquads.length > 0 ? otherSquads.map((squad) => <SquadCard key={squad.id} squad={squad} showJoin />) : <div className="glass-card p-5 text-sm text-muted-foreground">No other squads found.</div>}
            </div>
          </div>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create squad</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Squad name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="South County Strikers" />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select value={newSport} onValueChange={(value) => setNewSport(value as Sport | 'none')}>
                <SelectTrigger><SelectValue placeholder="Choose sport" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any sport</SelectItem>
                  {SPORTS.map((sport) => <SelectItem key={sport.id} value={sport.id}>{sport.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={newVisibility} onValueChange={(value) => setNewVisibility(value as 'public' | 'request' | 'invite_only')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="request">Request to join</SelectItem>
                  <SelectItem value="invite_only">Invite only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vibe</Label>
              <Select value={newVibe} onValueChange={(value) => setNewVibe(value as 'casual' | 'competitive' | 'balanced')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="competitive">Competitive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Minimum XP</Label>
              <Input type="number" min={0} value={minJoinXp} onChange={(e) => setMinJoinXp(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Member limit</Label>
              <Input type="number" min={2} max={100} value={newMemberLimit} onChange={(e) => setNewMemberLimit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Weekly goal</Label>
              <Input type="number" min={1} value={newWeeklyGoal} onChange={(e) => setNewWeeklyGoal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reliability minimum</Label>
              <Input type="number" min={0} max={100} value={newReliabilityMin} onChange={(e) => setNewReliabilityMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Home area</Label>
              <Input value={user?.city ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Home court</Label>
              <Input value={newHomeCourt} onChange={(e) => setNewHomeCourt(e.target.value)} placeholder="Heritage Park" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="What your squad stands for" rows={3} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Motto</Label>
              <Input value={newMotto} onChange={(e) => setNewMotto(e.target.value)} placeholder="Built local. Compete hard." />
            </div>
            <div className="space-y-2">
              <Label>Primary color</Label>
              <Input type="color" value={newPrimaryColor} onChange={(e) => setNewPrimaryColor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Secondary color</Label>
              <Input type="color" value={newSecondaryColor} onChange={(e) => setNewSecondaryColor(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tags</Label>
              <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="local, reliable, defense-first" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Preferred days</Label>
              <Input value={newPreferredDays} onChange={(e) => setNewPreferredDays(e.target.value)} placeholder="Mon, Wed, Sat" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Skill focus</Label>
              <Input value={newSkillFocus} onChange={(e) => setNewSkillFocus(e.target.value)} placeholder="Spacing, defense, transition" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Rules</Label>
              <Textarea value={newRules} onChange={(e) => setNewRules(e.target.value)} rows={4} placeholder="One rule per line" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Join questions</Label>
              <Textarea value={newQuestions} onChange={(e) => setNewQuestions(e.target.value)} rows={4} placeholder="One question per line" />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3 md:col-span-2">
              <div>
                <div className="font-medium">Recruiting open</div>
                <div className="text-sm text-muted-foreground">Surface the squad in discovery and invite new members.</div>
              </div>
              <Switch checked={newRecruiting} onCheckedChange={setNewRecruiting} />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3 md:col-span-2">
              <div>
                <div className="font-medium">Require join message</div>
                <div className="text-sm text-muted-foreground">Applicants should include a note when requesting to join.</div>
              </div>
              <Switch checked={newRequireJoinMessage} onCheckedChange={setNewRequireJoinMessage} />
            </div>
          </div>

          <Button onClick={onCreate} disabled={!newName.trim() || busyCreate}>
            {busyCreate ? 'Creating squad...' : 'Create squad'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
