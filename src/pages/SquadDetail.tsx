import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  Crown,
  MapPin,
  Megaphone,
  MessageSquare,
  Pin,
  Send,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SPORTS, type SquadSettings, type SquadStep1Data } from '@/types';
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
  banSquadUser,
  createSquadAnnouncement,
  createSquadInvite,
  deleteSquadById,
  fetchMySquads,
  fetchSquadAnnouncements,
  fetchSquadAuditLogs,
  fetchSquadBanList,
  fetchSquadEvents,
  fetchSquadFeed,
  fetchSquadChatMessages,
  fetchSquadInvites,
  getSquadPermissionBundle,
  joinSquadById,
  fetchSquadJoinRequests,
  fetchSquadMatchHistory,
  fetchSquadMembers,
  fetchSquadRivalries,
  removeSquadMember,
  fetchSquadStep1Data,
  leaveSquadById,
  replaceSquadChannels,
  replaceSquadJoinQuestions,
  replaceSquadTags,
  reviewSquadJoinRequest,
  revokeSquadInvite,
  postSquadChatMessage,
  searchProfilesForSquadInvites,
  submitSquadJoinRequest,
  updateSquadMemberRole,
  updateSquadProfile,
  updateSquadAnnouncementPin,
  unbanSquadUser,
  upsertSquadSettings,
  type SquadAnnouncement,
  type SquadAuditRecord,
  type SquadBanRecord,
  type SquadChatMessage,
  type SquadApplicant,
  type SquadEventCard,
  type SquadFeedItem,
  type SquadInviteCandidate,
  type SquadInviteRecord,
  type SquadPermissionBundle,
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

const ROLE_OPTIONS = ['member', 'officer', 'captain'] as const;

export default function SquadDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const [squad, setSquad] = useState<SquadRow | null>(null);
  const [members, setMembers] = useState<SquadMemberProfile[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [matches, setMatches] = useState<SquadMatchHistoryRow[]>([]);
  const [rivalries, setRivalries] = useState<SquadRivalry[]>([]);
  const [events, setEvents] = useState<SquadEventCard[]>([]);
  const [feed, setFeed] = useState<SquadFeedItem[]>([]);
  const [announcements, setAnnouncements] = useState<SquadAnnouncement[]>([]);
  const [activeChannel, setActiveChannel] = useState('main');
  const [chatMessages, setChatMessages] = useState<SquadChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [pinningAnnouncementId, setPinningAnnouncementId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<SquadApplicant[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SquadInviteRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<SquadAuditRecord[]>([]);
  const [banList, setBanList] = useState<SquadBanRecord[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteCandidates, setInviteCandidates] = useState<SquadInviteCandidate[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
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

  const isOwner = user?.id != null && squad?.owner_id === user.id;
  const permissions: SquadPermissionBundle = useMemo(() => getSquadPermissionBundle({ role: currentUserRole, isOwner, settings: settingsForm }), [currentUserRole, isOwner, settingsForm]);
  const canManage = permissions.canReviewApplications || permissions.canViewAuditLogs || permissions.canViewBanList || permissions.canEditSquadSettings;
  const canInvite = permissions.canInvitePlayers;
  const canPostAnnouncements = permissions.canPostAnnouncements;
  const availableChannels = useMemo(() => {
    const channels = step1Data?.channels ?? [];
    if (!isMember) return channels.filter((channel) => !channel.is_private);
    return channels;
  }, [step1Data, isMember]);
  const pinnedAnnouncements = useMemo(() => announcements.filter((item) => item.is_pinned), [announcements]);

  function canManageMember(target: SquadMemberProfile) {
    if (!user?.id) return false;
    if (target.user_id === user.id) return false;
    const actorRole = (currentUserRole ?? 'member').toLowerCase();
    const targetRole = (target.role ?? 'member').toLowerCase();
    const rank = (role: string) => role === 'captain' ? 3 : role === 'officer' ? 2 : 1;
    if (isOwner) return true;
    if (!permissions.canManageMembers) return false;
    return rank(actorRole) > rank(targetRole);
  }

  async function loadChannelMessages(channelKey: string) {
    if (!id || !isMember) {
      setChatMessages([]);
      return;
    }
    try {
      const rows = await fetchSquadChatMessages({ squadId: id, channel: channelKey, limit: 60 });
      setChatMessages(rows);
    } catch (e) {
      console.error(e);
      setChatMessages([]);
    }
  }

  async function loadAll() {
    if (!id || !user?.id) return;
    setLoading(true);
    try {
      const [memberRows, mine, matchRows, upcoming, step1, announcementRows, requestRows, inviteRows, auditRows, banRows] = await Promise.all([
        fetchSquadMembers(id),
        fetchMySquads(user.id),
        fetchSquadMatchHistory(id),
        fetchSquadEvents(id),
        fetchSquadStep1Data(id),
        fetchSquadAnnouncements(id).catch(() => []),
        fetchSquadJoinRequests(id).catch(() => []),
        fetchSquadInvites(id).catch(() => []),
        fetchSquadAuditLogs(id).catch(() => []),
        fetchSquadBanList(id).catch(() => []),
      ]);
      const rivalryRows = await fetchSquadRivalries(id);
      const feedRows = await fetchSquadFeed({ squad: step1.squad, members: memberRows, matches: matchRows });

      setSquad(step1.squad);
      setStep1Data(step1);
      setMembers(memberRows);
      setMatches(matchRows);
      setRivalries(rivalryRows);
      setEvents(upcoming);
      setFeed(feedRows);
      setAnnouncements(announcementRows);
      setJoinRequests(requestRows);
      setPendingInvites(inviteRows);
      setAuditLogs(auditRows);
      setBanList(banRows);
      const myMembership = memberRows.find((row) => row.user_id === user.id) ?? null;
      setCurrentUserRole(myMembership?.role ?? null);
      setIsMember(Boolean(mine.some((row) => row.id === id) || myMembership));
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
      setActiveChannel((current) => step1.channels.some((channel) => channel.channel_key === current) ? current : (step1.channels[0]?.channel_key ?? 'main'));
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not load squad', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    void loadChannelMessages(activeChannel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isMember, activeChannel]);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      if (!id || !canInvite || inviteSearch.trim().length < 2) {
        setInviteCandidates([]);
        return;
      }
      try {
        setInviteCandidates(await searchProfilesForSquadInvites({ squadId: id, query: inviteSearch }));
      } catch {
        setInviteCandidates([]);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [canInvite, id, inviteSearch]);

  async function reloadStep1() {
    if (!id) return;
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
          preferred_days: preferredDaysText.split(',').map((item) => item.trim()).filter(Boolean),
          skill_focus: skillFocusText.split(',').map((item) => item.trim()).filter(Boolean),
          rules: rulesText.split('\n').map((item) => item.trim()).filter(Boolean),
        },
      });
      await replaceSquadTags({ squadId: id, tags: tagsText.split(',').map((item) => item.trim()).filter(Boolean) });
      await replaceSquadJoinQuestions({ squadId: id, questions: questionsDraft });
      await replaceSquadChannels({ squadId: id, channels: channelsDraft });
      setSquad(updatedSquad);
      setSettingsForm(updatedSettings);
      await reloadStep1();
      toast({ title: 'Step 3 settings saved', description: 'Squad profile and permissions settings updated.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not save squad settings', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingStep1(false);
    }
  }

  async function onApplyToJoin() {
    if (!id || !user?.id) return;
    setJoining(true);
    try {
      if ((squad?.visibility ?? 'public') === 'public') {
        await joinSquadById({ squadId: id });
        toast({ title: 'Joined squad', description: 'You are now part of this squad.' });
      } else {
        await submitSquadJoinRequest({ squadId: id, userId: user.id, message: applyMessage });
        toast({ title: 'Application sent', description: 'The squad leadership can now review your request.' });
      }
      setApplyMessage('');
      await loadAll();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not apply', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  }

  async function onApproveRequest(requestId: string, approve: boolean) {
    if (!id || !user?.id) return;
    setReviewingRequestId(requestId);
    try {
      await reviewSquadJoinRequest({ squadId: id, requestId, reviewByUserId: user.id, approve });
      await loadAll();
      toast({ title: approve ? 'Application approved' : 'Application declined' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not review application', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setReviewingRequestId(null);
    }
  }

  async function onInvite(candidate: SquadInviteCandidate) {
    if (!id || !user?.id) return;
    setInvitingUserId(candidate.id);
    try {
      await createSquadInvite({ squadId: id, invitedUserId: candidate.id, invitedByUserId: user.id, message: inviteMessage });
      setInviteMessage('');
      setInviteSearch('');
      setInviteCandidates([]);
      await loadAll();
      toast({ title: 'Invite sent', description: `${candidate.username ?? 'Player'} can now accept it from the Squads page.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not send invite', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setInvitingUserId(null);
    }
  }

  async function onRevokeInvite(inviteId: string) {
    if (!id) return;
    setRevokingInviteId(inviteId);
    try {
      await revokeSquadInvite({ squadId: id, inviteId, actorUserId: user?.id ?? '' });
      await loadAll();
      toast({ title: 'Invite revoked' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not revoke invite', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setRevokingInviteId(null);
    }
  }

  async function onChangeRole(memberUserId: string, nextRole: string) {
    if (!id) return;
    setMemberActionUserId(memberUserId);
    try {
      await updateSquadMemberRole({ squadId: id, memberUserId, nextRole: nextRole as 'member' | 'officer' | 'captain', actorUserId: user?.id ?? '' });
      await loadAll();
      toast({ title: 'Role updated' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not update role', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setMemberActionUserId(null);
    }
  }

  async function onRemoveMember(memberUserId: string) {
    if (!id) return;
    setMemberActionUserId(memberUserId);
    try {
      await removeSquadMember({ squadId: id, memberUserId, actorUserId: user?.id ?? '' });
      await loadAll();
      toast({ title: 'Member removed' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not remove member', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setMemberActionUserId(null);
    }
  }

  async function onBanMember(memberUserId: string) {
    if (!id || !user?.id) return;
    const reason = window.prompt('Optional ban reason') ?? '';
    setMemberActionUserId(memberUserId);
    try {
      await banSquadUser({ squadId: id, memberUserId, bannedByUserId: user.id, reason });
      await loadAll();
      toast({ title: 'Member banned' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not ban member', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setMemberActionUserId(null);
    }
  }

  async function onPostAnnouncement() {
    if (!id || !user?.id || !announcementTitle.trim() || !announcementBody.trim()) return;
    setPostingAnnouncement(true);
    try {
      await createSquadAnnouncement({ squadId: id, authorId: user.id, title: announcementTitle, body: announcementBody, isPinned: announcementPinned });
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementPinned(false);
      await loadAll();
      toast({ title: 'Announcement posted' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not post announcement', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setPostingAnnouncement(false);
    }
  }

  async function onSendChatMessage() {
    if (!id || !user?.id || !chatDraft.trim()) return;
    setSendingMessage(true);
    try {
      await postSquadChatMessage({ squadId: id, senderId: user.id, channel: activeChannel, body: chatDraft });
      setChatDraft('');
      await loadChannelMessages(activeChannel);
      await loadAll();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not send message', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSendingMessage(false);
    }
  }

  async function onToggleAnnouncementPin(announcementId: string, nextPinned: boolean) {
    if (!id || !user?.id) return;
    setPinningAnnouncementId(announcementId);
    try {
      await updateSquadAnnouncementPin({ squadId: id, announcementId, actorUserId: user.id, isPinned: nextPinned });
      await loadAll();
      toast({ title: nextPinned ? 'Announcement pinned' : 'Announcement unpinned' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not update announcement pin', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setPinningAnnouncementId(null);
    }
  }

  async function onUnban(memberUserId: string) {
    if (!id || !user?.id) return;
    setMemberActionUserId(memberUserId);
    try {
      await unbanSquadUser({ squadId: id, userId: memberUserId, actorUserId: user.id });
      await loadAll();
      toast({ title: 'Player unbanned' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not unban player', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setMemberActionUserId(null);
    }
  }

  async function onLeave() {
    if (!id) return;
    if (isOwner) {
      toast({ title: 'Owner cannot leave', description: 'Delete the squad or transfer ownership first.', variant: 'destructive' });
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
    const confirmed = window.confirm('Delete this squad? This removes the whole squad and cannot be undone.');
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

  const sportMeta = useMemo(() => SPORTS.find((s) => s.id === squad?.sport) ?? null, [squad?.sport]);
  const totalXp = useMemo(() => members.reduce((sum, m) => sum + (m.xp ?? 0), 0), [members]);
  const record = `${Number(squad?.wins ?? 0)}-${Number(squad?.losses ?? 0)}`;
  const attendanceScore = useMemo(() => clamp(72 + members.length * 3, 0, 100), [members.length]);
  const chemistryScore = useMemo(() => clamp(60 + Math.round(totalXp / 150), 0, 100), [totalXp]);
  const reliabilityScore = useMemo(() => clamp(Number(squad?.reliability_min ?? 88) + 4, 0, 100), [squad?.reliability_min]);
  const division = getDivisionFromRating(Number(squad?.rating ?? 1000));
  const weeklyGoal = Number(squad?.weekly_goal ?? 5);
  const weeklyProgress = Math.min(weeklyGoal, Math.max(1, matches.slice(0, 7).length));
  const memberCap = Number(squad?.member_limit ?? 10);
  const openSlots = Math.max(0, memberCap - members.length);
  const sortedMembers = useMemo(() => {
    const rank = (role: string) => {
      const normalized = role.toLowerCase();
      if (normalized === 'owner') return 0;
      if (normalized === 'captain') return 1;
      if (normalized === 'officer') return 2;
      return 3;
    };
    return [...members].sort((a, b) => {
      const byRole = rank(a.role ?? 'member') - rank(b.role ?? 'member');
      if (byRole !== 0) return byRole;
      return (b.xp ?? 0) - (a.xp ?? 0);
    });
  }, [members]);

  if (loading) {
    return <div className="min-h-screen bg-background p-4 pb-24 text-muted-foreground">Loading squad...</div>;
  }

  if (!squad) {
    return <div className="min-h-screen bg-background p-4 pb-24 text-muted-foreground">Squad not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        <div className="text-sm text-muted-foreground">Squad HQ</div>
      </div>

      <Card className="mb-4 overflow-hidden border-primary/15">
        <div className="h-24" style={{ background: `linear-gradient(90deg, ${profileForm.primary_color}22, ${profileForm.secondary_color}66)` }} />
        <CardContent className="p-4 -mt-10 relative">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded-3xl bg-background border shadow-sm flex items-center justify-center text-2xl">
                {sportMeta?.icon ?? '👥'}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-2xl font-bold leading-tight">{squad.name}</div>
                  <Badge variant="secondary">{division}</Badge>
                  <Badge variant="outline">{(squad.vibe ?? 'competitive').replace('_', ' ')}</Badge>
                  <Badge variant="outline" className="capitalize">{(squad.visibility ?? 'public').replace('_', ' ')}</Badge>
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
            <div className="rounded-xl bg-secondary/40 p-3"><div className="text-muted-foreground inline-flex items-center gap-1"><Users className="w-4 h-4" /> Open slots</div><div className="text-lg font-bold mt-1">{openSlots}</div></div>
            <div className="rounded-xl bg-secondary/40 p-3"><div className="text-muted-foreground inline-flex items-center gap-1"><Target className="w-4 h-4" /> Chemistry</div><div className="text-lg font-bold mt-1">{chemistryScore}%</div></div>
            <div className="rounded-xl bg-secondary/40 p-3"><div className="text-muted-foreground inline-flex items-center gap-1"><Bell className="w-4 h-4" /> Reliability</div><div className="text-lg font-bold mt-1">{reliabilityScore}%</div></div>
            <div className="rounded-xl bg-secondary/40 p-3"><div className="text-muted-foreground inline-flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Weekly goal</div><div className="text-lg font-bold mt-1">{weeklyProgress}/{weeklyGoal}</div></div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm max-w-xl text-muted-foreground">{squad.description || 'No description yet. Use the Manage tab to define the squad culture and recruiting standards.'}</div>
            <div className="flex gap-2 flex-wrap">
              {!isMember && squad.visibility !== 'invite_only' ? (
                <Button onClick={onApplyToJoin} disabled={joining}>{joining ? 'Working...' : squad.visibility === 'public' ? 'Join squad' : 'Send application'}</Button>
              ) : null}
              {isMember && !isOwner ? <Button variant="secondary" onClick={onLeave} disabled={leaving}>{leaving ? 'Leaving...' : 'Leave squad'}</Button> : null}
              {isOwner ? <Button variant="destructive" onClick={onDelete} disabled={deleting}><Trash2 className="w-4 h-4 mr-2" /> {deleting ? 'Deleting...' : 'Delete squad'}</Button> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="compete">Compete</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Motto</span><span className="font-medium">{settingsForm.motto || 'No motto yet'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Home court</span><span className="font-medium">{squad.home_court || 'TBD'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Join gate</span><span className="font-medium">{Number(squad.min_xp_required ?? 500)} XP</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Recruiting</span><span className="font-medium capitalize">{settingsForm.recruiting_status}</span></div>
                {tagsText ? <div className="flex flex-wrap gap-2 pt-1">{tagsText.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Weekly squad target</span><span>{weeklyProgress}/{weeklyGoal}</span></div>
                  <Progress value={(weeklyProgress / Math.max(1, weeklyGoal)) * 100} className="mt-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Attendance health</span><span>{attendanceScore}%</span></div>
                  <Progress value={attendanceScore} className="mt-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Chemistry</span><span>{chemistryScore}%</span></div>
                  <Progress value={chemistryScore} className="mt-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Upcoming squad events</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {events.length === 0 ? <div className="text-sm text-muted-foreground">No upcoming squad events yet.</div> : events.map((event) => (
                  <div key={event.id} className="rounded-xl border p-3">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-muted-foreground">{event.kind} • {formatDate(event.starts_at)}</div>
                    <div className="text-sm text-muted-foreground">{event.location} • {event.attendee_count} going</div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Squad announcements</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {announcements.length === 0 ? <div className="text-sm text-muted-foreground">No announcements yet.</div> : announcements.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{item.title}</div>
                      {item.is_pinned ? <Badge variant="secondary">Pinned</Badge> : null}
                    </div>
                    <div className="text-sm mt-1">{item.body}</div>
                    <div className="text-xs text-muted-foreground mt-2">{item.author_username ?? 'Squad staff'} • {formatDate(item.created_at)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Member roster</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sortedMembers.map((member) => (
                <div key={member.user_id} className="rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{member.username ?? 'Unnamed player'}</div>
                      <Badge variant="outline" className="capitalize">{member.role}</Badge>
                      {member.user_id === squad.owner_id ? <Badge><Crown className="w-3 h-3 mr-1" /> Owner</Badge> : null}
                    </div>
                    <div className="text-sm text-muted-foreground">{member.city ?? 'Unknown city'} • {member.xp.toLocaleString()} XP • {member.reliability_score ?? 100}% reliability</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feed" className="space-y-4">
          {pinnedAnnouncements.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Pinned leadership updates</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {pinnedAnnouncements.map((item) => (
                  <div key={item.id} className="rounded-xl border p-3 bg-amber-50/60 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary"><Pin className="w-3 h-3 mr-1" /> Pinned</Badge>
                        <div className="font-medium">{item.title}</div>
                      </div>
                      {canPostAnnouncements ? (
                        <Button variant="ghost" size="sm" disabled={pinningAnnouncementId === item.id} onClick={() => onToggleAnnouncementPin(item.id, false)}>Unpin</Button>
                      ) : null}
                    </div>
                    <div className="text-sm mt-2">{item.body}</div>
                    <div className="text-xs text-muted-foreground mt-2">{item.author_username ?? 'Squad staff'} • {formatDate(item.created_at)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader><CardTitle>Squad feed</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {feed.map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">{item.type}</Badge>
                      <div className="font-medium">{item.title}</div>
                    </div>
                    <div className="text-sm mt-1">{item.body}</div>
                    <div className="text-xs text-muted-foreground mt-2">{formatDate(item.created_at)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Squad chat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isMember ? (
                  <div className="text-sm text-muted-foreground">Join the squad to unlock channel chat and member-only coordination.</div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {availableChannels.map((channel) => (
                        <Button
                          key={channel.id}
                          type="button"
                          size="sm"
                          variant={activeChannel === channel.channel_key ? 'default' : 'secondary'}
                          onClick={() => setActiveChannel(channel.channel_key)}
                        >
                          {channel.channel_name}
                        </Button>
                      ))}
                    </div>

                    <div className="max-h-[420px] overflow-y-auto rounded-xl border p-3 space-y-3">
                      {chatMessages.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No messages yet in this channel. Start the conversation.</div>
                      ) : chatMessages.map((message) => (
                        <div key={message.id} className="rounded-lg border px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-sm">{message.sender_username ?? 'Squad member'}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(message.created_at)}</div>
                          </div>
                          <div className="text-sm mt-1 whitespace-pre-wrap">{message.body}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        rows={3}
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        placeholder={activeChannel === 'announcements' ? 'Post an official squad update to the announcements channel' : 'Send a message to your squad'}
                      />
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-muted-foreground">
                          {activeChannel === 'announcements' && !canPostAnnouncements ? 'Only leadership can post in announcements.' : 'Use chat to coordinate runs, strategy, and availability.'}
                        </div>
                        <Button onClick={onSendChatMessage} disabled={sendingMessage || !chatDraft.trim() || (activeChannel === 'announcements' && !canPostAnnouncements)}>
                          <Send className="w-4 h-4 mr-2" />
                          {sendingMessage ? 'Sending...' : 'Send'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Announcement board</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {announcements.length === 0 ? <div className="text-sm text-muted-foreground">No announcements yet.</div> : announcements.map((item) => (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{item.title}</div>
                      {item.is_pinned ? <Badge variant="secondary">Pinned</Badge> : null}
                    </div>
                    {canPostAnnouncements ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pinningAnnouncementId === item.id}
                        onClick={() => onToggleAnnouncementPin(item.id, !item.is_pinned)}
                      >
                        {item.is_pinned ? 'Unpin' : 'Pin'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="text-sm mt-1">{item.body}</div>
                  <div className="text-xs text-muted-foreground mt-2">{item.author_username ?? 'Squad staff'} • {formatDate(item.created_at)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compete" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Recent match history</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {matches.length === 0 ? <div className="text-sm text-muted-foreground">No squad matches recorded yet.</div> : matches.map((match) => (
                  <div key={match.id} className="rounded-xl border p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{match.outcome === 'win' ? 'Win' : 'Loss'} vs {match.opponent_name}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(match.recorded_at)}</div>
                    </div>
                    <Badge variant={match.outcome === 'win' ? 'default' : 'secondary'}>{match.points_awarded} pts</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Rivalries</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {rivalries.length === 0 ? <div className="text-sm text-muted-foreground">Rivalries will appear once your squad faces the same opponent multiple times.</div> : rivalries.map((rivalry) => (
                  <div key={rivalry.opponent_name} className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{rivalry.opponent_name}</div>
                      <Badge variant="outline" className="capitalize">{rivalry.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Record {rivalry.wins}-{rivalry.losses} over {rivalry.total_matches} matchups</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          {!canManage && !isOwner ? (
            <Card><CardContent className="p-4 text-sm text-muted-foreground">Only squad leadership can manage membership workflows and squad settings.</CardContent></Card>
          ) : null}

          {canManage ? (
            <>
              <Card>
                <CardHeader><CardTitle>Leadership permissions</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border p-3"><div className="font-medium">Your role</div><div className="text-sm text-muted-foreground capitalize">{isOwner ? 'owner' : (currentUserRole ?? 'member')}</div></div>
                  <div className="rounded-xl border p-3"><div className="font-medium">Application review</div><div className="text-sm text-muted-foreground">{permissions.canReviewApplications ? 'Enabled' : 'Not allowed'}</div></div>
                  <div className="rounded-xl border p-3"><div className="font-medium">Invite players</div><div className="text-sm text-muted-foreground">{permissions.canInvitePlayers ? 'Enabled' : 'Not allowed'}</div></div>
                  <div className="rounded-xl border p-3"><div className="font-medium">Announcements</div><div className="text-sm text-muted-foreground">{permissions.canPostAnnouncements ? 'Enabled' : 'Not allowed'}</div></div>
                  <div className="rounded-xl border p-3"><div className="font-medium">Member moderation</div><div className="text-sm text-muted-foreground">{permissions.canManageMembers ? 'Enabled' : 'Not allowed'}</div></div>
                  <div className="rounded-xl border p-3"><div className="font-medium">Settings edits</div><div className="text-sm text-muted-foreground">{permissions.canEditSquadSettings ? 'Owner only' : 'Read only'}</div></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Applications</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {joinRequests.length === 0 ? <div className="text-sm text-muted-foreground">No pending applications right now.</div> : joinRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{request.username ?? 'Applicant'}</div>
                        <div className="text-sm text-muted-foreground">{request.city ?? 'Unknown city'} • {request.xp.toLocaleString()} XP • {request.reliability_score}% reliability</div>
                        {request.message ? <div className="text-sm mt-2">“{request.message}”</div> : null}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" disabled={reviewingRequestId === request.id} onClick={() => onApproveRequest(request.id, false)}>{reviewingRequestId === request.id ? 'Working...' : 'Decline'}</Button>
                        <Button disabled={reviewingRequestId === request.id} onClick={() => onApproveRequest(request.id, true)}>{reviewingRequestId === request.id ? 'Working...' : 'Approve'}</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {canInvite ? (
                <Card>
                  <CardHeader><CardTitle>Invite players</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2"><Label>Search players</Label><Input value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} placeholder="Search username" /></div>
                      <div className="space-y-2"><Label>Invite note</Label><Input value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="Come hoop with us this week" /></div>
                    </div>
                    <div className="space-y-2">
                      {inviteCandidates.length === 0 ? <div className="text-sm text-muted-foreground">Search for a player to invite.</div> : inviteCandidates.map((candidate) => (
                        <div key={candidate.id} className="rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-medium">{candidate.username ?? 'Unnamed player'}</div>
                            <div className="text-sm text-muted-foreground">{candidate.city ?? 'Unknown city'} • {candidate.xp.toLocaleString()} XP • {candidate.reliability_score}% reliability</div>
                          </div>
                          <Button disabled={invitingUserId === candidate.id} onClick={() => onInvite(candidate)}><UserPlus className="w-4 h-4 mr-2" /> {invitingUserId === candidate.id ? 'Sending...' : 'Invite'}</Button>
                        </div>
                      ))}
                    </div>
                    {pendingInvites.length > 0 ? (
                      <div className="space-y-2 pt-2">
                        <div className="font-medium">Pending invites</div>
                        {pendingInvites.map((invite) => (
                          <div key={invite.id} className="rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className="font-medium">{invite.invited_user_username ?? 'Player'}</div>
                              <div className="text-sm text-muted-foreground">Invited by {invite.invited_by_username ?? 'Squad staff'} • {formatDate(invite.created_at)}</div>
                            </div>
                            <Button variant="secondary" disabled={revokingInviteId === invite.id} onClick={() => onRevokeInvite(invite.id)}>{revokingInviteId === invite.id ? 'Working...' : 'Revoke'}</Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader><CardTitle>Announcements</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {canPostAnnouncements ? (
                    <div className="rounded-xl border p-3 space-y-3">
                      <div className="space-y-2"><Label>Title</Label><Input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="Weekend squad run" /></div>
                      <div className="space-y-2"><Label>Body</Label><Textarea value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} rows={4} placeholder="Meet at 9 AM on Saturday at our home court..." /></div>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2"><Switch checked={announcementPinned} onCheckedChange={setAnnouncementPinned} /><span className="text-sm">Pin this announcement</span></div>
                        <Button disabled={postingAnnouncement || !announcementTitle.trim() || !announcementBody.trim()} onClick={onPostAnnouncement}><Megaphone className="w-4 h-4 mr-2" /> {postingAnnouncement ? 'Posting...' : 'Post announcement'}</Button>
                      </div>
                    </div>
                  ) : null}
                  {announcements.map((item) => (
                    <div key={item.id} className="rounded-xl border p-3">
                      <div className="flex items-center gap-2 flex-wrap"><div className="font-medium">{item.title}</div>{item.is_pinned ? <Badge variant="secondary">Pinned</Badge> : null}</div>
                      <div className="text-sm mt-1">{item.body}</div>
                      <div className="text-xs text-muted-foreground mt-2">{item.author_username ?? 'Squad staff'} • {formatDate(item.created_at)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Member management</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {sortedMembers.map((member) => (
                    <div key={member.user_id} className="rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{member.username ?? 'Unnamed player'}</div>
                        <div className="text-sm text-muted-foreground">{member.city ?? 'Unknown city'} • {member.xp.toLocaleString()} XP • {member.reliability_score ?? 100}% reliability</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {member.user_id !== squad.owner_id ? (
                          <Select value={member.role} onValueChange={(value) => onChangeRole(member.user_id, value)}>
                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : <Badge><Crown className="w-3 h-3 mr-1" /> Owner</Badge>}
                        {member.user_id !== squad.owner_id ? <Button variant="secondary" disabled={memberActionUserId === member.user_id} onClick={() => onRemoveMember(member.user_id)}>{memberActionUserId === member.user_id ? 'Working...' : 'Remove'}</Button> : null}
                        {member.user_id !== squad.owner_id ? <Button variant="destructive" disabled={memberActionUserId === member.user_id} onClick={() => onBanMember(member.user_id)}>{memberActionUserId === member.user_id ? 'Working...' : 'Ban'}</Button> : null}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}

          {permissions.canEditSquadSettings ? (
            <>
              <Card>
                <CardHeader><CardTitle>Squad profile</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Squad name</Label><Input value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Home area</Label><Input value={profileForm.home_area} onChange={(e) => setProfileForm((prev) => ({ ...prev, home_area: e.target.value }))} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={profileForm.description} rows={4} onChange={(e) => setProfileForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Home court</Label><Input value={profileForm.home_court} onChange={(e) => setProfileForm((prev) => ({ ...prev, home_court: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Visibility</Label><Select value={profileForm.visibility} onValueChange={(value) => setProfileForm((prev) => ({ ...prev, visibility: value as 'public' | 'request' | 'invite_only' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="request">Request to join</SelectItem><SelectItem value="invite_only">Invite only</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Vibe</Label><Select value={profileForm.vibe} onValueChange={(value) => setProfileForm((prev) => ({ ...prev, vibe: value as 'casual' | 'competitive' | 'balanced' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="casual">Casual</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="competitive">Competitive</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Weekly goal</Label><Input type="number" value={profileForm.weekly_goal} onChange={(e) => setProfileForm((prev) => ({ ...prev, weekly_goal: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Minimum XP</Label><Input type="number" value={profileForm.min_xp_required} onChange={(e) => setProfileForm((prev) => ({ ...prev, min_xp_required: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Member limit</Label><Input type="number" value={profileForm.member_limit} onChange={(e) => setProfileForm((prev) => ({ ...prev, member_limit: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Reliability minimum</Label><Input type="number" value={profileForm.reliability_min} onChange={(e) => setProfileForm((prev) => ({ ...prev, reliability_min: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Primary color</Label><Input type="color" value={profileForm.primary_color} onChange={(e) => setProfileForm((prev) => ({ ...prev, primary_color: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Secondary color</Label><Input type="color" value={profileForm.secondary_color} onChange={(e) => setProfileForm((prev) => ({ ...prev, secondary_color: e.target.value }))} /></div>
                  <div className="rounded-xl border p-3 md:col-span-2 flex items-center justify-between">
                    <div><div className="font-medium">Recruiting open</div><div className="text-sm text-muted-foreground">Allow discovery and incoming members.</div></div>
                    <Switch checked={profileForm.recruiting} onCheckedChange={(checked) => setProfileForm((prev) => ({ ...prev, recruiting: checked }))} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Application and culture settings</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label>Motto</Label><Input value={settingsForm.motto} onChange={(e) => setSettingsForm((prev) => ({ ...prev, motto: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Recruiting status</Label><Select value={settingsForm.recruiting_status} onValueChange={(value) => setSettingsForm((prev) => ({ ...prev, recruiting_status: value as SquadSettings['recruiting_status'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="selective">Selective</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Gender focus</Label><Select value={settingsForm.gender_focus} onValueChange={(value) => setSettingsForm((prev) => ({ ...prev, gender_focus: value as SquadSettings['gender_focus'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="mens">Mens</SelectItem><SelectItem value="womens">Womens</SelectItem><SelectItem value="coed">Co-ed</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Preferred days</Label><Input value={preferredDaysText} onChange={(e) => setPreferredDaysText(e.target.value)} placeholder="Mon, Wed, Sat" /></div>
                  <div className="space-y-2"><Label>Skill focus</Label><Input value={skillFocusText} onChange={(e) => setSkillFocusText(e.target.value)} placeholder="Defense, spacing, pace" /></div>
                  <div className="space-y-2"><Label>Tags</Label><Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="local, reliable, weekend" /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Rules</Label><Textarea value={rulesText} rows={5} onChange={(e) => setRulesText(e.target.value)} placeholder="One rule per line" /></div>
                  <div className="rounded-xl border p-3 flex items-center justify-between"><div><div className="font-medium">Allow member invites</div><div className="text-sm text-muted-foreground">Members can invite people without officer approval.</div></div><Switch checked={settingsForm.allow_member_invites} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, allow_member_invites: checked }))} /></div>
                  <div className="rounded-xl border p-3 flex items-center justify-between"><div><div className="font-medium">Officer announcements</div><div className="text-sm text-muted-foreground">Officers can push official squad updates.</div></div><Switch checked={settingsForm.allow_officer_announcements} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, allow_officer_announcements: checked }))} /></div>
                  <div className="rounded-xl border p-3 flex items-center justify-between"><div><div className="font-medium">Enable join questions</div><div className="text-sm text-muted-foreground">Show question prompts in the application flow.</div></div><Switch checked={settingsForm.join_questions_enabled} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, join_questions_enabled: checked }))} /></div>
                  <div className="rounded-xl border p-3 flex items-center justify-between"><div><div className="font-medium">Require join message</div><div className="text-sm text-muted-foreground">Applicants must include a note.</div></div><Switch checked={settingsForm.require_join_message} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, require_join_message: checked }))} /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Join questions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {questionsDraft.length > 0 ? questionsDraft.map((question, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                      <Input value={question.question_text} onChange={(e) => setQuestionsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, question_text: e.target.value } : item))} />
                      <Button type="button" variant={question.is_required ? 'default' : 'secondary'} onClick={() => setQuestionsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, is_required: !item.is_required } : item))}>{question.is_required ? 'Required' : 'Optional'}</Button>
                      <Button type="button" variant="ghost" onClick={() => setQuestionsDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">No join questions yet.</div>}
                  <Button type="button" variant="secondary" onClick={() => setQuestionsDraft((prev) => [...prev, { question_text: '', is_required: true }])}>Add question</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Channels</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {channelsDraft.map((channel, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                      <Input value={channel.channel_name} placeholder="Channel name" onChange={(e) => setChannelsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, channel_name: e.target.value } : item))} />
                      <Input value={channel.channel_key} placeholder="channel_key" onChange={(e) => setChannelsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, channel_key: e.target.value } : item))} />
                      <Button type="button" variant={channel.is_private ? 'default' : 'secondary'} onClick={() => setChannelsDraft((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, is_private: !item.is_private } : item))}>{channel.is_private ? 'Private' : 'Public'}</Button>
                      <Button type="button" variant="ghost" onClick={() => setChannelsDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" onClick={() => setChannelsDraft((prev) => [...prev, { channel_key: 'new_channel', channel_name: 'New Channel', is_private: false }])}>Add channel</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Ban list</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {banList.length === 0 ? <div className="text-sm text-muted-foreground">No banned players.</div> : banList.map((ban) => (
                    <div key={ban.user_id} className="rounded-xl border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{ban.username ?? 'Unknown player'}</div>
                        <div className="text-xs text-muted-foreground">Banned by {ban.banned_by_username ?? 'leadership'} on {formatDate(ban.created_at)}</div>
                        {ban.reason ? <div className="text-sm text-muted-foreground mt-1">{ban.reason}</div> : null}
                      </div>
                      {permissions.canBanMembers ? <Button variant="secondary" disabled={memberActionUserId === ban.user_id} onClick={() => onUnban(ban.user_id)}>Unban</Button> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {auditLogs.length === 0 ? <div className="text-sm text-muted-foreground">No leadership actions logged yet.</div> : auditLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="capitalize">{log.action.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                      </div>
                      <div className="text-sm mt-2">{log.actor_username ?? 'System'} {log.target_username ? <>to {log.target_username}</> : null}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {permissions.canEditSquadSettings ? <Button onClick={onSaveStep1} disabled={savingStep1}>{savingStep1 ? 'Saving...' : 'Save squad settings'}</Button> : null}
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
