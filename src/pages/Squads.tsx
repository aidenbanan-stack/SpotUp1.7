import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, Plus, Search, ShieldCheck, Sparkles, Swords, Trophy, Users, X } from 'lucide-react';
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
import { LocationPicker } from '@/components/LocationPicker';
import {
  closeSquadMatchPost,
  createSquad,
  createSquadChallenge,
  createSquadMatchPost,
  fetchLeaderSquads,
  fetchMyPendingSquadInvites,
  fetchMySquadChallenges,
  fetchMySquadGameInvites,
  fetchMySquads,
  fetchOpenSquadMatchPosts,
  fetchRecentSquadResults,
  joinSquadById,
  recordSquadMatchResult,
  replaceSquadChannels,
  replaceSquadJoinQuestions,
  replaceSquadTags,
  respondSquadInvite,
  respondToSquadChallenge,
  respondToSquadGameInvite,
  searchSquads,
  submitSquadJoinRequest,
  type SquadCompetitionChallenge,
  type SquadCompetitionPost,
  type SquadCompetitionResult,
  type SquadDiscoverRow,
  type SquadGameInviteRow,
  type SquadInviteRecord,
  type SquadLeaderSquadOption,
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
  const [loadingCompetition, setLoadingCompetition] = useState(true);
  const [mySquads, setMySquads] = useState<SquadWithMeta[]>([]);
  const [discoverSquads, setDiscoverSquads] = useState<SquadDiscoverRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SquadInviteRecord[]>([]);
  const [leaderSquads, setLeaderSquads] = useState<SquadLeaderSquadOption[]>([]);
  const [matchPosts, setMatchPosts] = useState<SquadCompetitionPost[]>([]);
  const [challenges, setChallenges] = useState<SquadCompetitionChallenge[]>([]);
  const [recentResults, setRecentResults] = useState<SquadCompetitionResult[]>([]);
  const [gameInvites, setGameInvites] = useState<SquadGameInviteRow[]>([]);
  const [search, setSearch] = useState('');
  const [competitionSearch, setCompetitionSearch] = useState('');
  const [tab, setTab] = useState<'my' | 'discover' | 'games'>('my');
  const [createOpen, setCreateOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [matchPostOpen, setMatchPostOpen] = useState(false);
  const [recordResultOpen, setRecordResultOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [applyingTo, setApplyingTo] = useState<SquadDiscoverRow | null>(null);
  const [selectedPost, setSelectedPost] = useState<SquadCompetitionPost | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<SquadCompetitionChallenge | null>(null);
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
  const [busyCompetitionId, setBusyCompetitionId] = useState<string | null>(null);
  const [minJoinXp, setMinJoinXp] = useState('500');

  const [postSquadId, setPostSquadId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postPreferredTime, setPostPreferredTime] = useState('Weeknights after 6 PM');
  const [postNotes, setPostNotes] = useState('Looking for a reliable local matchup.');
  const [postLocation, setPostLocation] = useState({ latitude: 33.6846, longitude: -117.8265, areaName: '' });
  const [challengeSquadId, setChallengeSquadId] = useState('');
  const [challengeMessage, setChallengeMessage] = useState('We can run this week.');
  const [resultWinnerSquadId, setResultWinnerSquadId] = useState('');
  const [resultPoints, setResultPoints] = useState('10');
  const [resultNotes, setResultNotes] = useState('');
  const [lockDismissed, setLockDismissed] = useState(false);

  const joinUnlocked = (user?.xp ?? 0) >= 500;
  const createUnlocked = (user?.xp ?? 0) >= 500;
  const cityLabel = user?.city?.trim() || 'your area';

  useEffect(() => {
    if (!user?.id) return;
    setLockDismissed(window.localStorage.getItem(`spotup_squads_lock_dismissed_${user.id}`) === '1');
  }, [user?.id]);

  const showLockedPage = !joinUnlocked && !(user?.isAdmin && lockDismissed);

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

  async function refreshCompetition() {
    if (!user?.id) return;
    setLoadingCompetition(true);
    try {
      const [leaders, posts, loadedChallenges, results, loadedGameInvites] = await Promise.all([
        fetchLeaderSquads(user.id),
        fetchOpenSquadMatchPosts(user.id),
        fetchMySquadChallenges(user.id),
        fetchRecentSquadResults(),
        fetchMySquadGameInvites(user.id),
      ]);
      setLeaderSquads(leaders);
      setMatchPosts(posts);
      setChallenges(loadedChallenges);
      setRecentResults(results);
      setGameInvites(loadedGameInvites);
      setPostSquadId((prev) => prev || leaders[0]?.squad_id || '');
    } catch (e) {
      console.error(e);
      setLeaderSquads([]);
      setMatchPosts([]);
      setChallenges([]);
      setRecentResults([]);
      setGameInvites([]);
    } finally {
      setLoadingCompetition(false);
    }
  }

  useEffect(() => {
    void refreshMySquads();
    void refreshDiscover('');
    void refreshInvites();
    void refreshCompetition();
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

  const filteredMatchPosts = useMemo(() => {
    const q = competitionSearch.trim().toLowerCase();
    if (!q) return matchPosts;
    return matchPosts.filter((post) =>
      [post.title, post.squad_name, post.notes, post.squad_home_area, post.preferred_time]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [competitionSearch, matchPosts]);

  const openBoardPosts = filteredMatchPosts.filter((post) => post.status === 'open');
  const myOpenPosts = openBoardPosts.filter((post) => post.is_mine);
  const challengeablePosts = openBoardPosts.filter((post) => !post.is_mine);
  const pendingGameInvites = gameInvites.filter((invite) => invite.status === 'pending');
  const incomingChallenges = challenges.filter((challenge) => leaderSquads.some((squad) => squad.squad_id === challenge.challenged_squad_id) && challenge.status === 'pending');
  const acceptedChallenges = challenges.filter((challenge) => challenge.status === 'accepted');

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
      setPostLocation({ latitude: 33.6846, longitude: -117.8265, areaName: '' });
      setMinJoinXp('500');
      await refreshMySquads();
      await refreshDiscover('');
      await refreshCompetition();
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
        await refreshCompetition();
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
      await refreshCompetition();
      if (accept) navigate(`/squad/${joinedSquadId}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not respond to invite.');
    } finally {
      setBusyInviteId(null);
    }
  }

  async function onCreateMatchPost() {
    if (!user?.id || !postSquadId || !postTitle.trim()) return;
    setBusyCompetitionId('create-post');
    try {
      await createSquadMatchPost({
        squadId: postSquadId,
        actorUserId: user.id,
        title: postTitle,
        preferredTime: postPreferredTime,
        notes: postNotes,
        locationName: postLocation.areaName || null,
        locationLatitude: postLocation.latitude,
        locationLongitude: postLocation.longitude,
      });
      setMatchPostOpen(false);
      setPostTitle('');
      setPostNotes('Looking for a reliable local matchup.');
      setPostPreferredTime('Weeknights after 6 PM');
      setPostLocation({ latitude: 33.6846, longitude: -117.8265, areaName: '' });
      await refreshCompetition();
    } catch (e: any) {
      alert(e?.message ?? 'Could not create squad game post.');
    } finally {
      setBusyCompetitionId(null);
    }
  }

  async function onChallengePost() {
    if (!user?.id || !selectedPost || !challengeSquadId) return;
    setBusyCompetitionId(selectedPost.id);
    try {
      await createSquadChallenge({
        postId: selectedPost.id,
        challengerSquadId: challengeSquadId,
        actorUserId: user.id,
        message: challengeMessage,
      });
      setChallengeOpen(false);
      setSelectedPost(null);
      setChallengeMessage('We can run this week.');
      await refreshCompetition();
    } catch (e: any) {
      alert(e?.message ?? 'Could not send challenge.');
    } finally {
      setBusyCompetitionId(null);
    }
  }

  async function onRespondChallenge(challengeId: string, squadId: string, accept: boolean) {
    if (!user?.id) return;
    setBusyCompetitionId(challengeId);
    try {
      await respondToSquadChallenge({ challengeId, squadId, actorUserId: user.id, accept });
      await refreshCompetition();
    } catch (e: any) {
      alert(e?.message ?? 'Could not update challenge.');
    } finally {
      setBusyCompetitionId(null);
    }
  }

  async function onRecordResult() {
    if (!user?.id || !selectedChallenge || !resultWinnerSquadId) return;
    setBusyCompetitionId(selectedChallenge.id);
    try {
      await recordSquadMatchResult({
        challengeId: selectedChallenge.id,
        squadAId: selectedChallenge.challenger_squad_id,
        squadBId: selectedChallenge.challenged_squad_id,
        winnerSquadId: resultWinnerSquadId,
        actorUserId: user.id,
        pointsAwarded: Number(resultPoints || '10'),
        notes: resultNotes,
      });
      setRecordResultOpen(false);
      setSelectedChallenge(null);
      setResultWinnerSquadId('');
      setResultPoints('10');
      setResultNotes('');
      await refreshCompetition();
      await refreshMySquads();
      await refreshDiscover(search);
    } catch (e: any) {
      alert(e?.message ?? 'Could not record squad result.');
    } finally {
      setBusyCompetitionId(null);
    }
  }

  async function onHandleGameInvite(inviteId: string, accept: boolean) {
    if (!user?.id) return;
    setBusyCompetitionId(inviteId);
    try {
      await respondToSquadGameInvite({ inviteId, userId: user.id, accept });
      await refreshCompetition();
    } catch (e: any) {
      alert(e?.message ?? 'Could not respond to squad game invite.');
    } finally {
      setBusyCompetitionId(null);
    }
  }

  async function onClosePost(postId: string, squadId: string) {
    if (!user?.id) return;
    setBusyCompetitionId(postId);
    try {
      await closeSquadMatchPost({ postId, squadId, actorUserId: user.id });
      await refreshCompetition();
    } catch (e: any) {
      alert(e?.message ?? 'Could not close squad post.');
    } finally {
      setBusyCompetitionId(null);
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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1">
            <Users className="w-3.5 h-3.5" /> {squad.member_count}/{Number(squad.member_limit ?? 10)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1">
            <Trophy className="w-3.5 h-3.5" /> {Number(squad.wins ?? 0)}-{Number(squad.losses ?? 0)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1">
            {Number(squad.min_xp_required ?? 0)} XP min
          </span>
          {squad.home_area ? <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1"><MapPin className="w-3.5 h-3.5" /> {squad.home_area}</span> : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1"><ShieldCheck className="w-3.5 h-3.5" /> {Number(squad.reliability_min ?? 90)}%</span>
        </div>

        {squad.description ? <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{squad.description}</p> : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
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

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {showLockedPage ? (
          <div className="glass-card p-6 md:p-8 relative overflow-hidden">
            {user?.isAdmin ? (
              <button
                type="button"
                className="absolute top-4 right-4 rounded-full bg-secondary/70 p-2"
                onClick={() => {
                  setLockDismissed(true);
                  if (user?.id) window.localStorage.setItem(`spotup_squads_lock_dismissed_${user.id}`, '1');
                }}
                aria-label="Dismiss squads lock page"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
            <div className="max-w-xl">
              <div className="text-sm font-medium text-primary">Squads locked</div>
              <div className="text-3xl font-bold mt-2">Reach 500 XP to unlock squads</div>
              <p className="text-muted-foreground mt-3">Once you hit 500 XP, this page unlocks automatically and you can create or join squads.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-secondary/60 px-4 py-2 text-sm font-medium">
                Current XP: {user?.xp?.toLocaleString() ?? 0} / 500
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
        <div className="glass-card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground">Squads</div>
            <div className="text-sm">Cleaner team spaces, simpler discovery, and one place for squad game activity.</div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <span>{areaSquads.length} near {cityLabel}</span>
            <span>•</span>
            <span>{loadingInvites ? '...' : pendingInvites.length} invites</span>
            <span>•</span>
            <span>{loadingCompetition ? '...' : openBoardPosts.length} open posts</span>
          </div>
        </div>

        <div className="glass-card p-2 flex gap-2">
          <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-medium', tab === 'my' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} onClick={() => setTab('my')}>My squads</button>
          <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-medium', tab === 'discover' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} onClick={() => setTab('discover')}>Discover</button>
          <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-medium', tab === 'games' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} onClick={() => setTab('games')}>Squad games</button>
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
        ) : tab === 'discover' ? (
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
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="glass-card p-4 lg:col-span-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">Squad competition hub</div>
                    <div className="text-sm text-muted-foreground">Everything for squad game invites, matchup posts, challenges, and competitive results now lives here.</div>
                  </div>
                  <Button disabled={leaderSquads.length === 0} onClick={() => setMatchPostOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Post matchup</Button>
                </div>
                <div className="mt-4 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={competitionSearch} onChange={(e) => setCompetitionSearch(e.target.value)} placeholder="Search squad games by squad, area, or matchup note" className="pl-9" />
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="font-semibold">Your competition status</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Leader squads</span><span className="font-semibold">{leaderSquads.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Open posts</span><span className="font-semibold">{myOpenPosts.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Incoming challenges</span><span className="font-semibold">{incomingChallenges.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Pending game invites</span><span className="font-semibold">{pendingGameInvites.length}</span></div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Users className="w-4 h-4" /> Squad game invites</div>
                {loadingCompetition ? (
                  <div className="text-sm text-muted-foreground">Loading squad game invites...</div>
                ) : pendingGameInvites.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No squad game invites right now.</div>
                ) : (
                  pendingGameInvites.map((invite) => (
                    <div key={invite.id} className="rounded-2xl border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{invite.game_title}</div>
                          <div className="text-sm text-muted-foreground">{invite.squad_name} invited you via {invite.invited_by_username ?? 'a squad leader'}</div>
                        </div>
                        <span className="text-xs rounded-full bg-secondary px-2 py-1 capitalize">{sportLabel(invite.game_sport ?? null)}</span>
                      </div>
                      {invite.message ? <div className="text-sm">“{invite.message}”</div> : null}
                      <div className="flex gap-2">
                        <Button variant="secondary" disabled={busyCompetitionId === invite.id} onClick={() => onHandleGameInvite(invite.id, false)}>{busyCompetitionId === invite.id ? 'Working...' : 'Decline'}</Button>
                        <Button disabled={busyCompetitionId === invite.id} onClick={() => onHandleGameInvite(invite.id, true)}>{busyCompetitionId === invite.id ? 'Working...' : 'Join game'}</Button>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Swords className="w-4 h-4" /> Incoming challenges</div>
                {loadingCompetition ? (
                  <div className="text-sm text-muted-foreground">Loading challenges...</div>
                ) : incomingChallenges.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No pending squad challenges right now.</div>
                ) : (
                  incomingChallenges.map((challenge) => (
                    <div key={challenge.id} className="rounded-2xl border p-3 space-y-2">
                      <div className="font-semibold">{challenge.challenger_squad_name} challenged {challenge.challenged_squad_name}</div>
                      <div className="text-sm text-muted-foreground">Sent by {challenge.created_by_username ?? 'a squad leader'}</div>
                      {challenge.message ? <div className="text-sm">{challenge.message}</div> : null}
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="secondary" disabled={busyCompetitionId === challenge.id} onClick={() => onRespondChallenge(challenge.id, challenge.challenged_squad_id, false)}>{busyCompetitionId === challenge.id ? 'Working...' : 'Decline'}</Button>
                        <Button disabled={busyCompetitionId === challenge.id} onClick={() => onRespondChallenge(challenge.id, challenge.challenged_squad_id, true)}>{busyCompetitionId === challenge.id ? 'Working...' : 'Accept challenge'}</Button>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <section className="glass-card p-4 xl:col-span-2 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><CalendarDays className="w-4 h-4" /> Open squad game board</div>
                {loadingCompetition ? (
                  <div className="text-sm text-muted-foreground">Loading squad game board...</div>
                ) : challengeablePosts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No open squad game posts yet. Create one to get the board going.</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {challengeablePosts.map((post) => (
                      <div key={post.id} className="rounded-2xl border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{post.title}</div>
                            <div className="text-sm text-muted-foreground">{post.squad_name}{post.squad_home_area ? ` • ${post.squad_home_area}` : ''}</div>
                          </div>
                          <span className="text-xs rounded-full bg-secondary px-2 py-1">{sportLabel(post.squad_sport ?? null)}</span>
                        </div>
                        {post.location_name ? <div className="text-sm"><span className="text-muted-foreground">Location:</span> {post.location_name}</div> : null}
                        {post.preferred_time ? <div className="text-sm"><span className="text-muted-foreground">Preferred time:</span> {post.preferred_time}</div> : null}
                        {post.notes ? <div className="text-sm text-muted-foreground">{post.notes}</div> : null}
                        <Button
                          disabled={leaderSquads.length === 0 || busyCompetitionId === post.id}
                          onClick={() => {
                            setSelectedPost(post);
                            setChallengeSquadId(leaderSquads[0]?.squad_id ?? '');
                            setChallengeMessage('We can run this week.');
                            setChallengeOpen(true);
                          }}
                        >
                          {busyCompetitionId === post.id ? 'Working...' : 'Challenge squad'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Trophy className="w-4 h-4" /> Your squad posts</div>
                {myOpenPosts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">You do not have any open matchup posts yet.</div>
                ) : myOpenPosts.map((post) => (
                  <div key={post.id} className="rounded-2xl border p-3 space-y-2">
                    <div className="font-semibold">{post.squad_name}</div>
                    <div className="text-sm">{post.title}</div>
                    {post.location_name ? <div className="text-xs text-muted-foreground">{post.location_name}</div> : null}
                    {post.preferred_time ? <div className="text-xs text-muted-foreground">{post.preferred_time}</div> : null}
                    <Button variant="secondary" disabled={busyCompetitionId === post.id} onClick={() => onClosePost(post.id, post.squad_id)}>{busyCompetitionId === post.id ? 'Working...' : 'Close post'}</Button>
                  </div>
                ))}
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Swords className="w-4 h-4" /> Active accepted matchups</div>
                {acceptedChallenges.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Accepted squad challenges will show here so you can record the result afterward.</div>
                ) : acceptedChallenges.map((challenge) => (
                  <div key={challenge.id} className="rounded-2xl border p-3 space-y-2">
                    <div className="font-semibold">{challenge.challenger_squad_name} vs {challenge.challenged_squad_name}</div>
                    {challenge.message ? <div className="text-sm text-muted-foreground">{challenge.message}</div> : null}
                    <div className="text-xs text-muted-foreground">Use the result recorder after the squads finish the matchup.</div>
                    <Button
                      disabled={busyCompetitionId === challenge.id}
                      onClick={() => {
                        setSelectedChallenge(challenge);
                        setResultWinnerSquadId(challenge.challenger_squad_id);
                        setResultPoints('10');
                        setResultNotes('');
                        setRecordResultOpen(true);
                      }}
                    >
                      {busyCompetitionId === challenge.id ? 'Working...' : 'Record result'}
                    </Button>
                  </div>
                ))}
              </section>

              <section className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Trophy className="w-4 h-4" /> Recent squad results</div>
                {recentResults.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No squad results recorded yet.</div>
                ) : recentResults.map((result) => (
                  <div key={result.id} className="rounded-2xl border p-3">
                    <div className="font-semibold">{result.squad_a_name} vs {result.squad_b_name}</div>
                    <div className="text-sm text-muted-foreground">Winner: {result.winner_squad_id === result.squad_a_id ? result.squad_a_name : result.squad_b_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">+{result.points_awarded} squad points</div>
                    {result.notes ? <div className="text-sm mt-2">{result.notes}</div> : null}
                    <div className="text-xs text-muted-foreground mt-2">Recorded {new Date(result.recorded_at).toLocaleString()}</div>
                  </div>
                ))}
              </section>
            </div>
          </div>
        )}
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
            <div className="space-y-2"><Label>Member limit</Label><Input type="number" value={newMemberLimit} onChange={(e) => setNewMemberLimit(e.target.value)} /></div>
            <div className="space-y-2"><Label>Minimum XP</Label><Input type="number" value={minJoinXp} onChange={(e) => setMinJoinXp(e.target.value)} /></div>
            <div className="space-y-2"><Label>Reliability minimum</Label><Input type="number" value={newReliabilityMin} onChange={(e) => setNewReliabilityMin(e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Vibe</Label><Select value={newVibe} onValueChange={(value) => setNewVibe(value as 'casual' | 'competitive' | 'balanced')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="casual">Casual</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="competitive">Competitive</SelectItem></SelectContent></Select></div>
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

      <Dialog open={matchPostOpen} onOpenChange={setMatchPostOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post a squad matchup request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Squad</Label><Select value={postSquadId} onValueChange={setPostSquadId}><SelectTrigger><SelectValue placeholder="Choose your squad" /></SelectTrigger><SelectContent>{leaderSquads.map((squad) => <SelectItem key={squad.squad_id} value={squad.squad_id}>{squad.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Title</Label><Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="Looking for a 5v5 run this weekend" /></div>
            <div className="space-y-2"><Label>Preferred time</Label><Input value={postPreferredTime} onChange={(e) => setPostPreferredTime(e.target.value)} placeholder="Saturday morning" /></div>
            <div className="space-y-2"><Label>Matchup location</Label><LocationPicker value={postLocation} onChange={setPostLocation} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={postNotes} onChange={(e) => setPostNotes(e.target.value)} rows={4} placeholder="Share skill range, area, and vibe." /></div>
            <Button disabled={!postSquadId || !postTitle.trim() || !postLocation.areaName.trim() || busyCompetitionId === 'create-post'} onClick={onCreateMatchPost}>{busyCompetitionId === 'create-post' ? 'Posting...' : 'Post squad game'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Challenge {selectedPost?.squad_name ?? 'this squad'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Your squad</Label><Select value={challengeSquadId} onValueChange={setChallengeSquadId}><SelectTrigger><SelectValue placeholder="Choose your squad" /></SelectTrigger><SelectContent>{leaderSquads.map((squad) => <SelectItem key={squad.squad_id} value={squad.squad_id}>{squad.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Challenge message</Label><Textarea value={challengeMessage} onChange={(e) => setChallengeMessage(e.target.value)} rows={4} placeholder="We can host this Friday at 7 PM in Irvine." /></div>
            <Button disabled={!challengeSquadId || !selectedPost || busyCompetitionId === selectedPost?.id} onClick={onChallengePost}>{busyCompetitionId === selectedPost?.id ? 'Sending...' : 'Send challenge'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recordResultOpen} onOpenChange={setRecordResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record squad result</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Choose the winning squad for this completed matchup.</div>
            <div className="space-y-2"><Label>Winner</Label><Select value={resultWinnerSquadId} onValueChange={setResultWinnerSquadId}><SelectTrigger><SelectValue placeholder="Select winner" /></SelectTrigger><SelectContent>{selectedChallenge ? [
              <SelectItem key={selectedChallenge.challenger_squad_id} value={selectedChallenge.challenger_squad_id}>{selectedChallenge.challenger_squad_name}</SelectItem>,
              <SelectItem key={selectedChallenge.challenged_squad_id} value={selectedChallenge.challenged_squad_id}>{selectedChallenge.challenged_squad_name}</SelectItem>,
            ] : null}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Points awarded</Label><Input type="number" value={resultPoints} onChange={(e) => setResultPoints(e.target.value)} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} rows={4} placeholder="Close game, first to 21, rematch already agreed on." /></div>
            <Button disabled={!selectedChallenge || !resultWinnerSquadId || busyCompetitionId === selectedChallenge?.id} onClick={onRecordResult}>{busyCompetitionId === selectedChallenge?.id ? 'Saving...' : 'Record result'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
