import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, Search, ShieldCheck, Sparkles, Swords, Trophy, Users } from 'lucide-react';
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
  fetchMyPendingSquadInvites,
  fetchMySquads,
  joinSquadById,
  replaceSquadChannels,
  replaceSquadJoinQuestions,
  replaceSquadTags,
  respondSquadInvite,
  searchSquads,
  submitSquadJoinRequest,
  type SquadDiscoverRow,
  type SquadInviteRecord,
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
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [mySquads, setMySquads] = useState<SquadWithMeta[]>([]);
  const [discoverSquads, setDiscoverSquads] = useState<SquadDiscoverRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SquadInviteRecord[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'my' | 'discover'>('my');
  const [createOpen, setCreateOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyingTo, setApplyingTo] = useState<SquadDiscoverRow | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
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
  const [busyJoinId, setBusyJoinId] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [minJoinXp, setMinJoinXp] = useState('500');

  const joinUnlocked = (user?.xp ?? 0) >= 500;
  const createUnlocked = (user?.xp ?? 0) >= 500;
  const cityLabel = user?.city?.trim() || 'your area';

  const sportIcon = (sport: Sport | null) => sport ? (SPORTS.find((s) => s.id === sport)?.icon ?? '🏀') : '👥';
  const sportLabel = (sport: Sport | null) => sport ? (SPORTS.find((s) => s.id === sport)?.name ?? sport) : 'Any sport';

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
      const data = await searchSquads({ userId: user.id, query: query ?? search, limit: 30 });
      setDiscoverSquads(data);
    } catch (e) {
      console.error(e);
      setDiscoverSquads([]);
    } finally {
      setLoadingDiscover(false);
    }
  }

  async function refreshInvites() {
    if (!user?.id) return;
    setLoadingInvites(true);
    try {
      setPendingInvites(await fetchMyPendingSquadInvites(user.id));
    } catch (e) {
      console.error(e);
      setPendingInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  }

  useEffect(() => {
    void refreshMySquads();
    void refreshDiscover('');
    void refreshInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (tab === 'discover') void refreshDiscover();
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab]);

  const areaSquads = useMemo(() => discoverSquads.filter((s) => s.is_nearby), [discoverSquads]);
  const otherSquads = useMemo(() => {
    const areaIds = new Set(areaSquads.map((s) => s.id));
    return discoverSquads.filter((s) => !areaIds.has(s.id));
  }, [areaSquads, discoverSquads]);

  async function onCreate() {
    if (!user?.id || busyCreate || !newName.trim()) return;
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

      await replaceSquadTags({ squadId: created.id, tags: newTags.split(',').map((item) => item.trim()).filter(Boolean) });
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

  async function onJoinClick(squad: SquadDiscoverRow) {
    if (!user?.id || !joinUnlocked) return;
    if (squad.visibility === 'public') {
      setBusyJoinId(squad.id);
      try {
        await joinSquadById({ squadId: squad.id });
        await refreshMySquads();
        await refreshDiscover(search);
      } catch (e: any) {
        console.error(e);
        alert(e?.message ?? 'Could not join squad.');
      } finally {
        setBusyJoinId(null);
      }
      return;
    }
    if (squad.visibility === 'request') {
      setApplyingTo(squad);
      setApplyMessage('');
      setApplyOpen(true);
      return;
    }
    alert('This squad is invite only. A captain or officer needs to invite you.');
  }

  async function onSubmitApplication() {
    if (!user?.id || !applyingTo) return;
    setBusyJoinId(applyingTo.id);
    try {
      await submitSquadJoinRequest({ squadId: applyingTo.id, userId: user.id, message: applyMessage });
      setApplyOpen(false);
      setApplyingTo(null);
      setApplyMessage('');
      await refreshDiscover(search);
      alert('Application sent. The squad leadership can now review it.');
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not submit application.');
    } finally {
      setBusyJoinId(null);
    }
  }

  async function onRespondInvite(inviteId: string, accept: boolean) {
    if (!user?.id) return;
    setBusyInviteId(inviteId);
    try {
      const joinedSquadId = await respondSquadInvite({ inviteId, userId: user.id, accept });
      await refreshInvites();
      await refreshMySquads();
      await refreshDiscover(search);
      if (accept) navigate(`/squad/${joinedSquadId}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not respond to invite.');
    } finally {
      setBusyInviteId(null);
    }
  }

  const SquadCard = ({ squad, showJoin }: { squad: SquadDiscoverRow | SquadWithMeta; showJoin?: boolean }) => {
    const discover = squad as SquadDiscoverRow;
    const discoverLabel = discover.visibility === 'request' ? 'Apply' : discover.visibility === 'invite_only' ? 'Invite only' : 'Join';
    return (
      <div className="glass-card p-4">
        <div className="flex items-start justify-between gap-3">
          <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/squad/${squad.id}`)}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary/70 flex items-center justify-center text-lg border border-border/60">
                {sportIcon(squad.sport ?? null)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <p className="font-semibold truncate">{squad.name}</p>
                  {'is_owner' in squad && squad.is_owner ? <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs">Owner</span> : null}
                  {'visibility' in squad && squad.visibility ? <span className="px-2 py-0.5 rounded-full bg-secondary text-xs capitalize">{String(squad.visibility).replace('_', ' ')}</span> : null}
                </div>
                <p className="text-xs text-muted-foreground truncate">{sportLabel(squad.sport ?? null)}</p>
              </div>
            </div>
          </button>
          {showJoin ? (
            discover.is_member ? (
              <Button variant="secondary" disabled>Joined</Button>
            ) : (
              <Button
                size="sm"
                disabled={!joinUnlocked || busyJoinId === squad.id || discover.visibility === 'invite_only'}
                onClick={() => onJoinClick(discover)}
              >
                {busyJoinId === squad.id ? 'Working...' : discoverLabel}
              </Button>
            )
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-secondary/40 p-2">
            <div className="text-muted-foreground">Members</div>
            <div className="font-semibold">{squad.member_count}/{Number(squad.member_limit ?? 10)}</div>
          </div>
          <div className="rounded-xl bg-secondary/40 p-2">
            <div className="text-muted-foreground">Record</div>
            <div className="font-semibold">{Number(squad.wins ?? 0)}-{Number(squad.losses ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-secondary/40 p-2">
            <div className="text-muted-foreground">Rating</div>
            <div className="font-semibold">{Number(squad.rating ?? 1000)}</div>
          </div>
          <div className="rounded-xl bg-secondary/40 p-2">
            <div className="text-muted-foreground">Join gate</div>
            <div className="font-semibold">{Number(squad.min_xp_required ?? 0)} XP</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {squad.home_area ? <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {squad.home_area}</span> : null}
          <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {Number(squad.reliability_min ?? 90)}% reliability</span>
          <span className="inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> {Number(squad.points ?? 0)} pts</span>
        </div>

        {squad.description ? <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{squad.description}</p> : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <div className="text-xl font-bold">Squads</div>
              <div className="text-sm text-muted-foreground">Build your local crew and level it up</div>
            </div>
          </div>
          <Button disabled={!createUnlocked} onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Create squad</Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-card p-4">
            <div className="text-sm text-muted-foreground">Unlock status</div>
            <div className="text-2xl font-bold mt-1">{user?.xp?.toLocaleString() ?? 0} XP</div>
            <div className="text-sm mt-2">Squads unlock at 500 XP. You can currently {createUnlocked ? 'create and join squads.' : 'keep earning XP to unlock squads.'}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-sm text-muted-foreground">Nearby recruiting</div>
            <div className="text-2xl font-bold mt-1">{areaSquads.length}</div>
            <div className="text-sm mt-2">Recruiting squads around {cityLabel}.</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-sm text-muted-foreground">Pending invites</div>
            <div className="text-2xl font-bold mt-1">{loadingInvites ? '...' : pendingInvites.length}</div>
            <div className="text-sm mt-2">Captains can now invite you directly into squads.</div>
          </div>
        </div>

        <div className="glass-card p-2 flex gap-2">
          <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-medium', tab === 'my' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} onClick={() => setTab('my')}>My squads</button>
          <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-medium', tab === 'discover' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} onClick={() => setTab('discover')}>Discover</button>
        </div>

        {tab === 'my' ? (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4" /><div className="font-semibold">Squad invites</div></div>
              {loadingInvites ? (
                <div className="text-sm text-muted-foreground">Loading invites...</div>
              ) : pendingInvites.length === 0 ? (
                <div className="text-sm text-muted-foreground">No pending invites right now.</div>
              ) : (
                <div className="space-y-3">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="rounded-2xl border p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{invite.squad_name}</div>
                        <div className="text-sm text-muted-foreground">Invited by {invite.invited_by_username ?? 'a squad leader'}</div>
                        {invite.message ? <div className="text-sm mt-1">“{invite.message}”</div> : null}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" disabled={busyInviteId === invite.id} onClick={() => onRespondInvite(invite.id, false)}>{busyInviteId === invite.id ? 'Working...' : 'Decline'}</Button>
                        <Button disabled={busyInviteId === invite.id} onClick={() => onRespondInvite(invite.id, true)}>{busyInviteId === invite.id ? 'Working...' : 'Accept'}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {loadingMy ? (
                <div className="text-sm text-muted-foreground">Loading your squads...</div>
              ) : mySquads.length === 0 ? (
                <div className="glass-card p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">You are not in any squads yet. Join one or create your own crew.</div>
              ) : mySquads.map((squad) => <SquadCard key={squad.id} squad={squad} />)}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search squads by name, area, or sport" className="pl-9" />
              </div>
            </div>

            {loadingDiscover ? <div className="text-sm text-muted-foreground">Loading squads...</div> : null}

            {areaSquads.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="w-4 h-4" /> Nearby squads in {cityLabel}</div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {areaSquads.map((squad) => <SquadCard key={squad.id} squad={squad} showJoin />)}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Swords className="w-4 h-4" /> All recruiting squads</div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {otherSquads.length === 0 && areaSquads.length === 0 ? (
                  <div className="glass-card p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No squads matched your search.</div>
                ) : otherSquads.map((squad) => <SquadCard key={squad.id} squad={squad} showJoin />)}
              </div>
            </section>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create your squad</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Squad name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="South County Strikers" /></div>
            <div className="space-y-2"><Label>Sport</Label><Select value={newSport} onValueChange={(value) => setNewSport(value as Sport | 'none')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Any sport</SelectItem>{SPORTS.map((sport) => <SelectItem key={sport.id} value={sport.id}>{sport.icon} {sport.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Visibility</Label><Select value={newVisibility} onValueChange={(value) => setNewVisibility(value as 'public' | 'request' | 'invite_only')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="request">Request to join</SelectItem><SelectItem value="invite_only">Invite only</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} placeholder="What kind of players are you building around?" /></div>
            <div className="space-y-2"><Label>Home court</Label><Input value={newHomeCourt} onChange={(e) => setNewHomeCourt(e.target.value)} placeholder="Founders Park" /></div>
            <div className="space-y-2"><Label>Motto</Label><Input value={newMotto} onChange={(e) => setNewMotto(e.target.value)} placeholder="Fast, reliable, team first" /></div>
            <div className="space-y-2"><Label>Member limit</Label><Input type="number" value={newMemberLimit} onChange={(e) => setNewMemberLimit(e.target.value)} /></div>
            <div className="space-y-2"><Label>Minimum XP</Label><Input type="number" value={minJoinXp} onChange={(e) => setMinJoinXp(e.target.value)} /></div>
            <div className="space-y-2"><Label>Weekly goal</Label><Input type="number" value={newWeeklyGoal} onChange={(e) => setNewWeeklyGoal(e.target.value)} /></div>
            <div className="space-y-2"><Label>Reliability minimum</Label><Input type="number" value={newReliabilityMin} onChange={(e) => setNewReliabilityMin(e.target.value)} /></div>
            <div className="space-y-2"><Label>Primary color</Label><Input type="color" value={newPrimaryColor} onChange={(e) => setNewPrimaryColor(e.target.value)} /></div>
            <div className="space-y-2"><Label>Secondary color</Label><Input type="color" value={newSecondaryColor} onChange={(e) => setNewSecondaryColor(e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Vibe</Label><Select value={newVibe} onValueChange={(value) => setNewVibe(value as 'casual' | 'competitive' | 'balanced')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="casual">Casual</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="competitive">Competitive</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 md:col-span-2"><Label>Tags</Label><Input value={newTags} onChange={(e) => setNewTags(e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Preferred days</Label><Input value={newPreferredDays} onChange={(e) => setNewPreferredDays(e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Skill focus</Label><Input value={newSkillFocus} onChange={(e) => setNewSkillFocus(e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Rules</Label><Textarea value={newRules} onChange={(e) => setNewRules(e.target.value)} rows={4} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Join questions</Label><Textarea value={newQuestions} onChange={(e) => setNewQuestions(e.target.value)} rows={3} /></div>
            <div className="rounded-xl border p-3 md:col-span-2 flex items-center justify-between">
              <div>
                <div className="font-medium">Recruiting open</div>
                <div className="text-sm text-muted-foreground">Make the squad visible in discovery right away.</div>
              </div>
              <Switch checked={newRecruiting} onCheckedChange={setNewRecruiting} />
            </div>
            <div className="rounded-xl border p-3 md:col-span-2 flex items-center justify-between">
              <div>
                <div className="font-medium">Require join message</div>
                <div className="text-sm text-muted-foreground">Applicants must include a short note when applying.</div>
              </div>
              <Switch checked={newRequireJoinMessage} onCheckedChange={setNewRequireJoinMessage} />
            </div>
          </div>
          <Button disabled={!createUnlocked || busyCreate || !newName.trim()} onClick={onCreate}>{busyCreate ? 'Creating...' : 'Create squad'}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Apply to {applyingTo?.name ?? 'squad'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">This squad requires a join request. Add a short note about why you would be a good fit.</div>
            <Textarea value={applyMessage} onChange={(e) => setApplyMessage(e.target.value)} rows={5} placeholder="Reliable wing, available on weekends, looking for a steady local squad..." />
            <Button disabled={!applyingTo || busyJoinId === applyingTo?.id} onClick={onSubmitApplication}>{busyJoinId === applyingTo?.id ? 'Sending...' : 'Send application'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
