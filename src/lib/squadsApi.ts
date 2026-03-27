import { supabase } from '@/lib/supabaseClient';
import type {
  Sport,
  SquadChannel,
  SquadJoinQuestion,
  SquadSettings,
  SquadStep1Data,
  SquadTag,
} from '@/types';

export type SquadRow = {
  id: string;
  name: string;
  sport: Sport | null;
  owner_id: string | null;
  invite_code: string;
  created_at: string;
  min_xp_required?: number;
  member_limit?: number;
  wins?: number;
  losses?: number;
  points?: number;
  rating?: number;
  home_area?: string | null;
  description?: string | null;
  visibility?: 'public' | 'request' | 'invite_only' | null;
  vibe?: 'casual' | 'competitive' | 'balanced' | null;
  weekly_goal?: number | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  home_court?: string | null;
  recruiting?: boolean | null;
  reliability_min?: number | null;
};

export type SquadWithMeta = SquadRow & {
  member_count: number;
  is_owner: boolean;
};

export type SquadDiscoverRow = SquadRow & {
  member_count: number;
  is_member: boolean;
  can_join: boolean;
  is_nearby: boolean;
};

export type SquadRole = 'member' | 'officer' | 'captain';

export type SquadMemberProfile = {
  squad_id: string;
  user_id: string;
  role: SquadRole | string;
  username: string | null;
  city?: string | null;
  reliability_score?: number;
  xp: number;
  level: number;
};

export type SquadPermissionBundle = {
  canReviewApplications: boolean;
  canInvitePlayers: boolean;
  canPostAnnouncements: boolean;
  canManageMembers: boolean;
  canBanMembers: boolean;
  canEditSquadSettings: boolean;
  canViewAuditLogs: boolean;
  canViewBanList: boolean;
  canManageChannels: boolean;
  canManageEvents: boolean;
};

export type SquadAuditRecord = {
  id: string;
  squad_id: string;
  actor_user_id: string | null;
  actor_username: string | null;
  action: string;
  target_user_id: string | null;
  target_username: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

export type SquadBanRecord = {
  squad_id: string;
  user_id: string;
  username: string | null;
  banned_by: string;
  banned_by_username: string | null;
  reason: string | null;
  created_at: string;
};

export type SquadApplicant = {
  id: string;
  squad_id: string;
  user_id: string;
  username: string | null;
  city: string | null;
  xp: number;
  reliability_score: number;
  message: string;
  status: string;
  created_at: string;
};

export type SquadInviteRecord = {
  id: string;
  squad_id: string;
  squad_name: string;
  invited_user_id: string;
  invited_by: string;
  invited_by_username: string | null;
  invited_user_username: string | null;
  message: string;
  status: string;
  created_at: string;
  expires_at: string | null;
};

export type SquadAnnouncement = {
  id: string;
  squad_id: string;
  author_id: string;
  author_username: string | null;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
};

export type SquadChatMessage = {
  id: string;
  squad_id: string;
  sender_id: string;
  sender_username: string | null;
  channel: string;
  body: string;
  created_at: string;
};

export type SquadInviteCandidate = {
  id: string;
  username: string | null;
  city: string | null;
  xp: number;
  reliability_score: number;
};

export type SquadLeaderboardRow = {
  squad_id: string;
  name: string;
  sport: Sport | null;
  member_count: number;
  total_xp: number;
  wins: number;
  losses: number;
  points: number;
  rating: number;
  win_pct: number;
  home_area: string | null;
  created_at: string;
};

export type SquadFeedItem = {
  id: string;
  type: 'announcement' | 'match' | 'milestone' | 'member' | 'event' | 'rivalry';
  title: string;
  body: string;
  created_at: string;
  accent?: string;
};

export type SquadMatchHistoryRow = {
  id: string;
  squad_a_id: string;
  squad_b_id: string;
  winner_squad_id: string;
  loser_squad_id: string;
  points_awarded: number;
  recorded_at: string;
  notes: string | null;
  opponent_name: string;
  outcome: 'win' | 'loss';
};

export type SquadRivalry = {
  squad_id: string;
  opponent_name: string;
  wins: number;
  losses: number;
  total_matches: number;
  status: 'heated' | 'active' | 'emerging';
};

export type SquadEventRsvpStatus = 'going' | 'maybe' | 'not_going';

export type SquadEventCard = {
  id: string;
  title: string;
  kind: 'practice' | 'scrimmage' | 'tryout' | 'tournament' | 'hangout';
  starts_at: string;
  ends_at: string | null;
  attendee_count: number;
  maybe_count: number;
  not_going_count: number;
  location: string;
  notes: string;
  visibility: 'members_only' | 'leadership_only' | 'public';
  creator_id: string | null;
  creator_username: string | null;
  my_rsvp: SquadEventRsvpStatus | null;
  recurrence_rule: string | null;
  max_attendees: number | null;
};

function normalizeSquadRow(row: any): SquadRow {
  return {
    id: row.id,
    name: row.name,
    sport: row.sport ?? null,
    owner_id: row.owner_id ?? null,
    invite_code: row.invite_code,
    created_at: row.created_at,
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    points: Number(row.points ?? 0),
    rating: Number(row.rating ?? 1000),
    home_area: row.home_area ?? null,
    min_xp_required: Number(row.min_xp_required ?? 0),
    member_limit: Number(row.member_limit ?? 10),
    description: row.description ?? null,
    visibility: row.visibility ?? null,
    vibe: row.vibe ?? null,
    weekly_goal: row.weekly_goal != null ? Number(row.weekly_goal) : null,
    primary_color: row.primary_color ?? null,
    secondary_color: row.secondary_color ?? null,
    home_court: row.home_court ?? null,
    recruiting: row.recruiting ?? null,
    reliability_min: row.reliability_min != null ? Number(row.reliability_min) : null,
  };
}

function rowToLeaderboard(row: any): SquadLeaderboardRow {
  const wins = Number(row.wins ?? 0);
  const losses = Number(row.losses ?? 0);
  const totalGames = wins + losses;
  return {
    squad_id: row.squad_id ?? row.id,
    name: row.name,
    sport: row.sport ?? null,
    member_count: Number(row.member_count ?? 0),
    total_xp: Number(row.total_xp ?? 0),
    wins,
    losses,
    points: Number(row.points ?? 0),
    rating: Number(row.rating ?? 1000),
    win_pct: totalGames > 0 ? wins / totalGames : 0,
    home_area: row.home_area ?? null,
    created_at: row.created_at,
  };
}

function normalizeSettings(row: any, squad: SquadRow): SquadSettings {
  const rules = Array.isArray(row?.rules) ? row.rules.filter(Boolean) : [];
  const preferredDays = Array.isArray(row?.preferred_days) ? row.preferred_days.filter(Boolean) : [];
  const skillFocus = Array.isArray(row?.skill_focus) ? row.skill_focus.filter(Boolean) : [];
  return {
    squad_id: squad.id,
    motto: row?.motto ?? '',
    banner_url: row?.banner_url ?? '',
    logo_url: row?.logo_url ?? '',
    recruiting_status: row?.recruiting_status ?? (squad.recruiting === false ? 'closed' : 'open'),
    preferred_days: preferredDays,
    skill_focus: skillFocus,
    age_min: row?.age_min != null ? Number(row.age_min) : null,
    age_max: row?.age_max != null ? Number(row.age_max) : null,
    gender_focus: row?.gender_focus ?? 'open',
    rules,
    allow_member_invites: Boolean(row?.allow_member_invites),
    allow_officer_announcements: row?.allow_officer_announcements !== false,
    join_questions_enabled: row?.join_questions_enabled !== false,
    require_join_message: Boolean(row?.require_join_message),
    updated_at: row?.updated_at ?? null,
  };
}

function sortByOrder<T extends { sort_order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeRole(role?: string | null): SquadRole {
  const value = (role ?? 'member').toLowerCase();
  if (value === 'owner' || value === 'captain') return 'captain';
  if (value === 'officer') return 'officer';
  return 'member';
}

function roleRank(role?: string | null): number {
  const normalized = normalizeRole(role);
  return normalized === 'captain' ? 3 : normalized === 'officer' ? 2 : 1;
}

export function getSquadPermissionBundle(args: {
  role?: string | null;
  isOwner?: boolean;
  settings?: Partial<SquadSettings> | null;
}): SquadPermissionBundle {
  const role = normalizeRole(args.role);
  const isOwner = Boolean(args.isOwner);
  const memberInvites = Boolean(args.settings?.allow_member_invites);
  const officerAnnouncements = args.settings?.allow_officer_announcements !== false;
  return {
    canReviewApplications: isOwner || role === 'captain' || role === 'officer',
    canInvitePlayers: isOwner || role === 'captain' || role === 'officer' || memberInvites,
    canPostAnnouncements: isOwner || role === 'captain' || (role === 'officer' && officerAnnouncements),
    canManageMembers: isOwner || role === 'captain',
    canBanMembers: isOwner || role === 'captain',
    canEditSquadSettings: isOwner,
    canViewAuditLogs: isOwner || role === 'captain' || role === 'officer',
    canViewBanList: isOwner || role === 'captain' || role === 'officer',
    canManageChannels: isOwner,
    canManageEvents: isOwner || role === 'captain' || role === 'officer',
  };
}

async function fetchActorContext(squadId: string, userId: string) {
  const [squad, membershipRes, settingsRes] = await Promise.all([
    fetchSquadById(squadId),
    supabase.from('squad_members').select('role').eq('squad_id', squadId).eq('user_id', userId).maybeSingle(),
    supabase.from('squad_settings').select('*').eq('squad_id', squadId).maybeSingle(),
  ]);
  const role = normalizeRole((membershipRes.data as any)?.role ?? null);
  const isOwner = squad.owner_id === userId;
  const settings = normalizeSettings(settingsRes.data, squad);
  const permissions = getSquadPermissionBundle({ role, isOwner, settings });
  return { squad, role, isOwner, settings, permissions };
}

function canManageTarget(args: {
  actorRole?: string | null;
  actorIsOwner?: boolean;
  actorUserId: string;
  targetUserId: string;
  targetRole?: string | null;
}): boolean {
  const permissions = getSquadPermissionBundle({ role: args.actorRole, isOwner: args.actorIsOwner });
  if (!permissions.canManageMembers) return false;
  if (args.actorUserId === args.targetUserId) return false;
  if (args.actorIsOwner) return true;
  return roleRank(args.actorRole) > roleRank(args.targetRole);
}

async function ensureCanInvitePlayers(squadId: string, userId: string) {
  const context = await fetchActorContext(squadId, userId);
  if (!context.permissions.canInvitePlayers) throw new Error('You do not have permission to invite players.');
  return context;
}

async function ensureCanReviewApplications(squadId: string, userId: string) {
  const context = await fetchActorContext(squadId, userId);
  if (!context.permissions.canReviewApplications) throw new Error('You do not have permission to review applications.');
  return context;
}

async function ensureCanPostAnnouncements(squadId: string, userId: string) {
  const context = await fetchActorContext(squadId, userId);
  if (!context.permissions.canPostAnnouncements) throw new Error('You do not have permission to post announcements.');
  return context;
}

async function ensureCanManageSpecificTarget(args: { squadId: string; actorUserId: string; targetUserId: string }) {
  const [context, targetMembership] = await Promise.all([
    fetchActorContext(args.squadId, args.actorUserId),
    supabase.from('squad_members').select('role').eq('squad_id', args.squadId).eq('user_id', args.targetUserId).maybeSingle(),
  ]);
  const targetRole = normalizeRole((targetMembership.data as any)?.role ?? null);
  if (!canManageTarget({ actorRole: context.role, actorIsOwner: context.isOwner, actorUserId: args.actorUserId, targetUserId: args.targetUserId, targetRole })) {
    throw new Error('You do not have permission to manage that member.');
  }
  return { ...context, targetRole };
}

export async function fetchMySquads(userId: string): Promise<SquadWithMeta[]> {
  const { data: memberships, error: memErr } = await supabase
    .from('squad_members')
    .select('squad_id, role')
    .eq('user_id', userId);

  if (memErr) throw memErr;
  const squadIds = (memberships ?? []).map((m: any) => m.squad_id).filter(Boolean);
  if (squadIds.length === 0) return [];

  const { data: squads, error: sErr } = await supabase
    .from('squads')
    .select('*')
    .in('id', squadIds)
    .order('created_at', { ascending: false });

  if (sErr) throw sErr;

  const { data: counts, error: cErr } = await supabase
    .from('squad_members')
    .select('squad_id')
    .in('squad_id', squadIds);

  if (cErr) throw cErr;

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    const sid = (row as any).squad_id as string;
    countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
  }

  const ownerSet = new Set(
    (memberships ?? [])
      .filter((m: any) => ['owner', 'captain'].includes((m.role ?? '').toLowerCase()))
      .map((m: any) => m.squad_id as string),
  );

  return (squads ?? []).map((s: any) => ({
    ...normalizeSquadRow(s),
    member_count: countMap.get(s.id) ?? 1,
    is_owner: ownerSet.has(s.id),
  }));
}

export async function createSquad(args: {
  userId: string;
  name: string;
  sport: Sport | null;
  homeArea?: string | null;
  minXpRequired?: number;
}): Promise<SquadRow> {
  const { data, error } = await supabase.rpc('create_squad_secure', {
    p_name: args.name.trim(),
    p_sport: args.sport,
    p_home_area: args.homeArea?.trim() || null,
    p_min_xp_required: Math.max(0, Math.floor(args.minXpRequired ?? 0)),
  });

  if (error) throw error;

  const squadId = typeof data === 'string' ? data : data?.id ?? data;
  if (!squadId) throw new Error('Could not create squad');
  return fetchSquadById(String(squadId));
}

export async function searchSquads(args: {
  userId: string;
  query?: string;
  limit?: number;
}): Promise<SquadDiscoverRow[]> {
  const { data, error } = await supabase.rpc('search_squads', {
    p_query: args.query?.trim() || null,
  });

  if (error) throw error;

  const rows = ((data ?? []) as any[]).slice(0, args.limit ?? 30);
  const { data: myMemberships } = await supabase
    .from('squad_members')
    .select('squad_id')
    .eq('user_id', args.userId);

  const memberSet = new Set((myMemberships ?? []).map((m: any) => m.squad_id as string));

  return rows.map((row) => ({
    ...normalizeSquadRow(row),
    member_count: Number(row.member_count ?? 0),
    is_nearby: Boolean(row.is_nearby),
    is_member: memberSet.has(row.id),
    can_join: !memberSet.has(row.id),
  }));
}

export async function joinSquadById(args: { squadId: string }): Promise<SquadRow> {
  const { data, error } = await supabase.rpc('join_squad_secure', {
    p_squad_id: args.squadId,
  });

  if (error) throw error;
  const squadId = typeof data === 'string' ? data : data?.id ?? args.squadId;
  return fetchSquadById(String(squadId));
}

export async function leaveSquadById(args: { squadId: string }): Promise<void> {
  const { error } = await supabase.rpc('leave_squad_secure', {
    p_squad_id: args.squadId,
  });
  if (error) throw error;
}

export async function deleteSquadById(args: { squadId: string }): Promise<void> {
  const { error } = await supabase.rpc('delete_squad_secure', {
    p_squad_id: args.squadId,
  });
  if (error) throw error;
}

export async function fetchSquadById(squadId: string): Promise<SquadRow> {
  const { data, error } = await supabase.from('squads').select('*').eq('id', squadId).single();
  if (error) throw error;
  return normalizeSquadRow(data);
}

export async function fetchSquadMembers(squadId: string): Promise<SquadMemberProfile[]> {
  const { data, error } = await supabase
    .from('squad_members')
    .select('squad_id, user_id, role, profiles:profiles(id, username, xp, city, reliability_score)')
    .eq('squad_id', squadId);

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const p = row.profiles ?? null;
    const xp = typeof p?.xp === 'number' ? p.xp : Number(p?.xp ?? 0);
    return {
      squad_id: row.squad_id,
      user_id: row.user_id,
      role: row.role ?? 'member',
      username: p?.username ?? null,
      city: p?.city ?? null,
      reliability_score: Number(p?.reliability_score ?? 100),
      xp: Number.isFinite(xp) ? xp : 0,
      level: Math.max(1, Math.floor((Number.isFinite(xp) ? xp : 0) / 100) + 1),
    } as SquadMemberProfile;
  });
}

export async function fetchSquadMatchHistory(squadId: string): Promise<SquadMatchHistoryRow[]> {
  try {
    const { data, error } = await supabase
      .from('squad_match_results')
      .select('id, squad_a_id, squad_b_id, winner_squad_id, loser_squad_id, points_awarded, recorded_at, notes')
      .or(`squad_a_id.eq.${squadId},squad_b_id.eq.${squadId}`)
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    const opponentIds = Array.from(new Set((data ?? []).flatMap((row: any) => [row.squad_a_id, row.squad_b_id]).filter((sid: string) => sid && sid !== squadId)));
    let opponentMap = new Map<string, string>();
    if (opponentIds.length > 0) {
      const { data: squads } = await supabase.from('squads').select('id, name').in('id', opponentIds);
      opponentMap = new Map((squads ?? []).map((row: any) => [row.id as string, row.name as string]));
    }
    return (data ?? []).map((row: any) => {
      const opponentId = row.squad_a_id === squadId ? row.squad_b_id : row.squad_a_id;
      return {
        id: row.id,
        squad_a_id: row.squad_a_id,
        squad_b_id: row.squad_b_id,
        winner_squad_id: row.winner_squad_id,
        loser_squad_id: row.loser_squad_id,
        points_awarded: Number(row.points_awarded ?? 0),
        recorded_at: row.recorded_at,
        notes: row.notes ?? null,
        opponent_name: opponentMap.get(opponentId) ?? 'Opponent Squad',
        outcome: row.winner_squad_id === squadId ? 'win' : 'loss',
      };
    });
  } catch {
    return [];
  }
}

export async function fetchSquadRivalries(squadId: string): Promise<SquadRivalry[]> {
  const matches = await fetchSquadMatchHistory(squadId);
  const byOpponent = new Map<string, SquadRivalry>();
  for (const match of matches) {
    const key = match.opponent_name;
    const cur = byOpponent.get(key) ?? {
      squad_id: squadId,
      opponent_name: match.opponent_name,
      wins: 0,
      losses: 0,
      total_matches: 0,
      status: 'emerging' as const,
    };
    cur.total_matches += 1;
    if (match.outcome === 'win') cur.wins += 1;
    else cur.losses += 1;
    cur.status = cur.total_matches >= 4 ? 'heated' : cur.total_matches >= 2 ? 'active' : 'emerging';
    byOpponent.set(key, cur);
  }
  return [...byOpponent.values()].sort((a, b) => b.total_matches - a.total_matches);
}

export async function fetchSquadEvents(squadId: string, userId?: string | null): Promise<SquadEventCard[]> {
  try {
    const { data, error } = await supabase
      .from('squad_events')
      .select('id, title, event_kind, starts_at, ends_at, location_name, notes, visibility, creator_id, recurrence_rule, max_attendees, profiles:profiles!squad_events_creator_id_fkey(username), squad_event_rsvps(user_id, status)')
      .eq('squad_id', squadId)
      .gte('starts_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(12);
    if (error) throw error;
    return (data ?? []).map((row: any) => {
      const rsvps = Array.isArray(row.squad_event_rsvps) ? row.squad_event_rsvps : [];
      const attendee_count = rsvps.filter((item: any) => item?.status === 'going').length;
      const maybe_count = rsvps.filter((item: any) => item?.status === 'maybe').length;
      const not_going_count = rsvps.filter((item: any) => item?.status === 'not_going').length;
      const myRsvp = userId ? (rsvps.find((item: any) => item?.user_id === userId)?.status ?? null) : null;
      return {
        id: row.id,
        title: row.title ?? 'Squad Run',
        kind: row.event_kind ?? 'practice',
        starts_at: row.starts_at,
        ends_at: row.ends_at ?? null,
        attendee_count,
        maybe_count,
        not_going_count,
        location: row.location_name ?? 'TBD',
        notes: row.notes ?? '',
        visibility: row.visibility ?? 'members_only',
        creator_id: row.creator_id ?? null,
        creator_username: row.profiles?.username ?? null,
        my_rsvp: myRsvp,
        recurrence_rule: row.recurrence_rule ?? null,
        max_attendees: row.max_attendees != null ? Number(row.max_attendees) : null,
      };
    });
  } catch {
    return [];
  }
}

export async function createSquadEvent(args: {
  squadId: string;
  creatorId: string;
  title: string;
  kind: 'practice' | 'scrimmage' | 'tryout' | 'tournament' | 'hangout';
  startsAt: string;
  endsAt?: string | null;
  locationName?: string | null;
  notes?: string | null;
  visibility?: 'members_only' | 'leadership_only' | 'public';
  recurrenceRule?: string | null;
  maxAttendees?: number | null;
}): Promise<void> {
  const context = await fetchActorContext(args.squadId, args.creatorId);
  if (!context.permissions.canManageEvents) throw new Error('You do not have permission to schedule squad events.');
  const title = args.title.trim();
  if (!title) throw new Error('Event title is required.');
  if (!args.startsAt) throw new Error('Event start time is required.');
  const payload = {
    squad_id: args.squadId,
    creator_id: args.creatorId,
    title,
    event_kind: args.kind,
    starts_at: new Date(args.startsAt).toISOString(),
    ends_at: args.endsAt ? new Date(args.endsAt).toISOString() : null,
    location_name: args.locationName?.trim() || null,
    notes: args.notes?.trim() || null,
    visibility: args.visibility ?? 'members_only',
    recurrence_rule: args.recurrenceRule?.trim() || null,
    max_attendees: args.maxAttendees != null ? Math.max(1, Math.floor(args.maxAttendees)) : null,
  };
  if (payload.ends_at && new Date(payload.ends_at) <= new Date(payload.starts_at)) throw new Error('Event end time must be after the start time.');
  const { data: inserted, error } = await supabase.from('squad_events').insert(payload).select('id').single();
  if (error) throw error;
  await supabase.from('squad_event_rsvps').upsert({ squad_event_id: inserted.id, user_id: args.creatorId, status: 'going' }, { onConflict: 'squad_event_id,user_id' });
  await supabase.from('squad_feed_events').insert({
    squad_id: args.squadId,
    event_type: 'event',
    title: `New ${args.kind} scheduled`,
    body: `${title}${args.locationName?.trim() ? ` at ${args.locationName.trim()}` : ''}`,
    actor_user_id: args.creatorId,
    metadata: { starts_at: payload.starts_at, recurrence_rule: payload.recurrence_rule },
  });
  await logSquadAudit({ squadId: args.squadId, action: 'squad_event_created', metadata: { title, kind: args.kind } });
}

export async function updateSquadEvent(args: {
  squadId: string;
  eventId: string;
  actorUserId: string;
  updates: Partial<{
    title: string;
    kind: 'practice' | 'scrimmage' | 'tryout' | 'tournament' | 'hangout';
    startsAt: string;
    endsAt: string | null;
    locationName: string | null;
    notes: string | null;
    visibility: 'members_only' | 'leadership_only' | 'public';
    recurrenceRule: string | null;
    maxAttendees: number | null;
  }>;
}): Promise<void> {
  const context = await fetchActorContext(args.squadId, args.actorUserId);
  if (!context.permissions.canManageEvents) throw new Error('You do not have permission to edit squad events.');
  const payload: Record<string, any> = {};
  if (args.updates.title !== undefined) payload.title = args.updates.title.trim();
  if (args.updates.kind !== undefined) payload.event_kind = args.updates.kind;
  if (args.updates.startsAt !== undefined) payload.starts_at = new Date(args.updates.startsAt).toISOString();
  if (args.updates.endsAt !== undefined) payload.ends_at = args.updates.endsAt ? new Date(args.updates.endsAt).toISOString() : null;
  if (args.updates.locationName !== undefined) payload.location_name = args.updates.locationName?.trim() || null;
  if (args.updates.notes !== undefined) payload.notes = args.updates.notes?.trim() || null;
  if (args.updates.visibility !== undefined) payload.visibility = args.updates.visibility;
  if (args.updates.recurrenceRule !== undefined) payload.recurrence_rule = args.updates.recurrenceRule?.trim() || null;
  if (args.updates.maxAttendees !== undefined) payload.max_attendees = args.updates.maxAttendees != null ? Math.max(1, Math.floor(args.updates.maxAttendees)) : null;
  const { error } = await supabase.from('squad_events').update(payload).eq('id', args.eventId).eq('squad_id', args.squadId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_event_updated', metadata: { event_id: args.eventId, ...payload } });
}

export async function deleteSquadEvent(args: { squadId: string; eventId: string; actorUserId: string }): Promise<void> {
  const context = await fetchActorContext(args.squadId, args.actorUserId);
  if (!context.permissions.canManageEvents) throw new Error('You do not have permission to remove squad events.');
  await supabase.from('squad_event_rsvps').delete().eq('squad_event_id', args.eventId);
  const { error } = await supabase.from('squad_events').delete().eq('id', args.eventId).eq('squad_id', args.squadId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_event_deleted', metadata: { event_id: args.eventId } });
}

export async function respondToSquadEvent(args: {
  squadId: string;
  eventId: string;
  userId: string;
  status: SquadEventRsvpStatus;
}): Promise<void> {
  const { data: member, error: memberError } = await supabase.from('squad_members').select('user_id').eq('squad_id', args.squadId).eq('user_id', args.userId).maybeSingle();
  if (memberError) throw memberError;
  if (!member) throw new Error('You must be a squad member to RSVP.');
  const { error } = await supabase.from('squad_event_rsvps').upsert({
    squad_event_id: args.eventId,
    user_id: args.userId,
    status: args.status,
  }, { onConflict: 'squad_event_id,user_id' });
  if (error) throw error;
}

export async function fetchSquadFeed(args: {
  squad: SquadRow;
  members: SquadMemberProfile[];
  matches?: SquadMatchHistoryRow[];
}): Promise<SquadFeedItem[]> {
  const feed: SquadFeedItem[] = [];
  try {
    const { data: dbFeed } = await supabase
      .from('squad_feed_events')
      .select('id, event_type, title, body, created_at')
      .eq('squad_id', args.squad.id)
      .order('created_at', { ascending: false })
      .limit(8);
    for (const item of dbFeed ?? []) {
      feed.push({
        id: item.id,
        type: (item.event_type ?? 'event') as SquadFeedItem['type'],
        title: item.title,
        body: item.body ?? '',
        created_at: item.created_at,
      });
    }
  } catch {
    // ignore and fall back to generated feed below
  }

  const createdAt = args.squad.created_at;
  feed.push({
    id: `created-${args.squad.id}`,
    type: 'milestone',
    title: `${args.squad.name} was formed`,
    body: `Invite code ${args.squad.invite_code} is live. Build your local crew and climb the ladder.`,
    created_at: createdAt,
    accent: 'bg-blue-500/15 text-blue-700',
  });

  const sortedMembers = [...args.members].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
  if (sortedMembers[0]) {
    feed.push({
      id: `top-${sortedMembers[0].user_id}`,
      type: 'member',
      title: `${sortedMembers[0].username ?? 'A member'} leads the squad`,
      body: `Current top contributor with ${sortedMembers[0].xp.toLocaleString()} XP and level ${sortedMembers[0].level}.`,
      created_at: new Date().toISOString(),
      accent: 'bg-amber-500/15 text-amber-700',
    });
  }

  for (const match of (args.matches ?? []).slice(0, 4)) {
    feed.push({
      id: `match-${match.id}`,
      type: 'match',
      title: `${match.outcome === 'win' ? 'Victory' : 'Tough loss'} vs ${match.opponent_name}`,
      body: `${match.outcome === 'win' ? 'Gained' : 'Played for'} ${match.points_awarded} competitive points.${match.notes ? ` ${match.notes}` : ''}`,
      created_at: match.recorded_at,
      accent: match.outcome === 'win' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700',
    });
  }

  return feed
    .filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export async function fetchSquadLeaderboard(limit = 50): Promise<SquadLeaderboardRow[]> {
  const { data, error } = await supabase
    .from('squad_competitive_leaderboard')
    .select('*')
    .order('rating', { ascending: false })
    .order('points', { ascending: false })
    .limit(limit);

  if (!error) return (data ?? []).map(rowToLeaderboard);

  const { data: squads, error: sErr } = await supabase.from('squads').select('*').order('created_at', { ascending: false }).limit(limit);
  if (sErr) throw sErr;

  const out: SquadLeaderboardRow[] = [];
  for (const s of squads ?? []) {
    try {
      const members = await fetchSquadMembers((s as any).id);
      out.push(rowToLeaderboard({
        squad_id: (s as any).id,
        name: (s as any).name,
        sport: (s as any).sport ?? null,
        member_count: members.length,
        total_xp: members.reduce((sum, m) => sum + (m.xp ?? 0), 0),
        wins: (s as any).wins ?? 0,
        losses: (s as any).losses ?? 0,
        points: (s as any).points ?? 0,
        rating: (s as any).rating ?? 1000,
        home_area: (s as any).home_area ?? null,
        created_at: (s as any).created_at,
      }));
    } catch {
      out.push(rowToLeaderboard({
        ...(s as any),
        squad_id: (s as any).id,
        member_count: 0,
        total_xp: 0,
      }));
    }
  }
  return out.sort((a, b) => (b.rating - a.rating) || (b.points - a.points) || (b.total_xp - a.total_xp)).slice(0, limit);
}

export async function fetchSquadStep1Data(squadId: string): Promise<SquadStep1Data> {
  const squad = await fetchSquadById(squadId);

  let settings = normalizeSettings(null, squad);
  let tags: SquadTag[] = [];
  let joinQuestions: SquadJoinQuestion[] = [];
  let channels: SquadChannel[] = [];
  let joinRequestCount = 0;
  let inviteCount = 0;
  let banCount = 0;
  let auditCount = 0;

  try {
    const [
      settingsRes,
      tagsRes,
      questionsRes,
      channelsRes,
      joinReqRes,
      inviteRes,
      bansRes,
      auditRes,
    ] = await Promise.all([
      supabase.from('squad_settings').select('*').eq('squad_id', squadId).maybeSingle(),
      supabase.from('squad_tags').select('id, squad_id, tag, sort_order').eq('squad_id', squadId).order('sort_order', { ascending: true }),
      supabase.from('squad_join_questions').select('id, squad_id, question_text, is_required, sort_order').eq('squad_id', squadId).order('sort_order', { ascending: true }),
      supabase.from('squad_channels').select('id, squad_id, channel_key, channel_name, is_private, sort_order').eq('squad_id', squadId).order('sort_order', { ascending: true }),
      supabase.from('squad_join_requests').select('id', { count: 'exact', head: true }).eq('squad_id', squadId).eq('status', 'pending'),
      supabase.from('squad_invites').select('id', { count: 'exact', head: true }).eq('squad_id', squadId).eq('status', 'pending'),
      supabase.from('squad_bans').select('user_id', { count: 'exact', head: true }).eq('squad_id', squadId),
      supabase.from('squad_audit_logs').select('id', { count: 'exact', head: true }).eq('squad_id', squadId),
    ]);

    settings = normalizeSettings(settingsRes.data, squad);
    tags = sortByOrder(((tagsRes.data ?? []) as any[]).map((row) => ({
      id: row.id,
      squad_id: row.squad_id,
      tag: row.tag,
      sort_order: Number(row.sort_order ?? 0),
    })));
    joinQuestions = sortByOrder(((questionsRes.data ?? []) as any[]).map((row) => ({
      id: row.id,
      squad_id: row.squad_id,
      question_text: row.question_text,
      is_required: row.is_required !== false,
      sort_order: Number(row.sort_order ?? 0),
    })));
    channels = sortByOrder(((channelsRes.data ?? []) as any[]).map((row) => ({
      id: row.id,
      squad_id: row.squad_id,
      channel_key: row.channel_key,
      channel_name: row.channel_name,
      is_private: Boolean(row.is_private),
      sort_order: Number(row.sort_order ?? 0),
    })));
    joinRequestCount = joinReqRes.count ?? 0;
    inviteCount = inviteRes.count ?? 0;
    banCount = bansRes.count ?? 0;
    auditCount = auditRes.count ?? 0;
  } catch {
    // keep defaults when the new step1 tables are not present yet
  }

  if (channels.length === 0) {
    channels = [
      { id: 'main', squad_id: squadId, channel_key: 'main', channel_name: 'Main chat', is_private: false, sort_order: 0 },
      { id: 'announcements', squad_id: squadId, channel_key: 'announcements', channel_name: 'Announcements', is_private: false, sort_order: 1 },
      { id: 'strategy', squad_id: squadId, channel_key: 'strategy', channel_name: 'Strategy', is_private: true, sort_order: 2 },
    ];
  }

  return {
    squad,
    settings,
    tags,
    joinQuestions,
    channels,
    pending: {
      joinRequests: joinRequestCount,
      invites: inviteCount,
      bans: banCount,
      audits: auditCount,
    },
  };
}

export async function updateSquadProfile(args: {
  squadId: string;
  updates: Partial<{
    name: string;
    sport: Sport | null;
    home_area: string | null;
    description: string | null;
    visibility: 'public' | 'request' | 'invite_only';
    vibe: 'casual' | 'competitive' | 'balanced';
    weekly_goal: number;
    min_xp_required: number;
    member_limit: number;
    primary_color: string | null;
    secondary_color: string | null;
    home_court: string | null;
    recruiting: boolean;
    reliability_min: number;
  }>;
}): Promise<SquadRow> {
  const payload = { ...args.updates } as Record<string, any>;
  if (typeof payload.name === 'string') payload.name = payload.name.trim();
  if (typeof payload.home_area === 'string') payload.home_area = payload.home_area.trim() || null;
  if (typeof payload.description === 'string') payload.description = payload.description.trim() || null;
  if (typeof payload.primary_color === 'string') payload.primary_color = payload.primary_color.trim() || null;
  if (typeof payload.secondary_color === 'string') payload.secondary_color = payload.secondary_color.trim() || null;
  if (typeof payload.home_court === 'string') payload.home_court = payload.home_court.trim() || null;
  if (typeof payload.member_limit === 'number') payload.member_limit = Math.min(100, Math.max(2, Math.floor(payload.member_limit)));
  if (typeof payload.min_xp_required === 'number') payload.min_xp_required = Math.max(0, Math.floor(payload.min_xp_required));
  if (typeof payload.weekly_goal === 'number') payload.weekly_goal = Math.max(1, Math.floor(payload.weekly_goal));
  if (typeof payload.reliability_min === 'number') payload.reliability_min = Math.min(100, Math.max(0, Math.floor(payload.reliability_min)));

  const { error } = await supabase.from('squads').update(payload).eq('id', args.squadId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_profile_updated', metadata: payload });
  return fetchSquadById(args.squadId);
}

export async function upsertSquadSettings(args: {
  squadId: string;
  settings: Omit<SquadSettings, 'squad_id' | 'updated_at'>;
}): Promise<SquadSettings> {
  const payload = {
    squad_id: args.squadId,
    motto: args.settings.motto?.trim() || null,
    banner_url: args.settings.banner_url?.trim() || null,
    logo_url: args.settings.logo_url?.trim() || null,
    recruiting_status: args.settings.recruiting_status,
    preferred_days: args.settings.preferred_days,
    skill_focus: args.settings.skill_focus,
    age_min: args.settings.age_min,
    age_max: args.settings.age_max,
    gender_focus: args.settings.gender_focus,
    rules: args.settings.rules.filter((rule) => rule.trim().length > 0),
    allow_member_invites: args.settings.allow_member_invites,
    allow_officer_announcements: args.settings.allow_officer_announcements,
    join_questions_enabled: args.settings.join_questions_enabled,
    require_join_message: args.settings.require_join_message,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('squad_settings').upsert(payload, { onConflict: 'squad_id' });
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_settings_updated', metadata: payload });
  const squad = await fetchSquadById(args.squadId);
  return normalizeSettings(payload, squad);
}

export async function replaceSquadTags(args: { squadId: string; tags: string[] }): Promise<SquadTag[]> {
  const cleaned = args.tags.map((tag) => tag.trim()).filter(Boolean);
  const { error: deleteError } = await supabase.from('squad_tags').delete().eq('squad_id', args.squadId);
  if (deleteError) throw deleteError;
  if (cleaned.length === 0) return [];
  const rows = cleaned.map((tag, index) => ({ squad_id: args.squadId, tag, sort_order: index }));
  const { data, error } = await supabase.from('squad_tags').insert(rows).select('id, squad_id, tag, sort_order');
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_tags_updated', metadata: { tags: cleaned } });
  return sortByOrder((data ?? []) as SquadTag[]);
}

export async function replaceSquadJoinQuestions(args: { squadId: string; questions: { question_text: string; is_required: boolean }[] }): Promise<SquadJoinQuestion[]> {
  const cleaned = args.questions
    .map((question) => ({ question_text: question.question_text.trim(), is_required: question.is_required }))
    .filter((question) => question.question_text.length > 0);
  const { error: deleteError } = await supabase.from('squad_join_questions').delete().eq('squad_id', args.squadId);
  if (deleteError) throw deleteError;
  if (cleaned.length === 0) return [];
  const rows = cleaned.map((question, index) => ({
    squad_id: args.squadId,
    question_text: question.question_text,
    is_required: question.is_required,
    sort_order: index,
  }));
  const { data, error } = await supabase.from('squad_join_questions').insert(rows).select('id, squad_id, question_text, is_required, sort_order');
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_join_questions_updated', metadata: { count: cleaned.length } });
  return sortByOrder((data ?? []) as SquadJoinQuestion[]);
}

export async function replaceSquadChannels(args: { squadId: string; channels: { channel_key: string; channel_name: string; is_private: boolean }[] }): Promise<SquadChannel[]> {
  const cleaned = args.channels
    .map((channel) => ({
      channel_key: channel.channel_key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'channel',
      channel_name: channel.channel_name.trim(),
      is_private: channel.is_private,
    }))
    .filter((channel) => channel.channel_name.length > 0);

  const { error: deleteError } = await supabase.from('squad_channels').delete().eq('squad_id', args.squadId);
  if (deleteError) throw deleteError;
  if (cleaned.length === 0) return [];
  const rows = cleaned.map((channel, index) => ({ ...channel, squad_id: args.squadId, sort_order: index }));
  const { data, error } = await supabase.from('squad_channels').insert(rows).select('id, squad_id, channel_key, channel_name, is_private, sort_order');
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_channels_updated', metadata: { count: cleaned.length } });
  return sortByOrder((data ?? []) as SquadChannel[]);
}

export async function logSquadAudit(args: { squadId: string; action: string; metadata?: Record<string, any> }) {
  try {
    await supabase.from('squad_audit_logs').insert({
      squad_id: args.squadId,
      action: args.action,
      metadata: args.metadata ?? {},
    });
  } catch {
    // safe no-op for environments that have not run the phase 7 patch yet
  }
}


async function createNotification(payload: {
  user_id: string;
  type: string;
  message: string;
  related_user_id?: string | null;
}) {
  try {
    await supabase.from('notifications').insert({
      user_id: payload.user_id,
      type: payload.type,
      message: payload.message,
      related_user_id: payload.related_user_id ?? null,
    });
  } catch {
    // best effort only
  }
}

export async function fetchSquadJoinRequests(squadId: string): Promise<SquadApplicant[]> {
  const { data, error } = await supabase
    .from('squad_join_requests')
    .select('id, squad_id, user_id, message, status, created_at, profiles:profiles!squad_join_requests_user_id_fkey(id, username, city, xp, reliability_score)')
    .eq('squad_id', squadId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    squad_id: row.squad_id,
    user_id: row.user_id,
    username: row.profiles?.username ?? null,
    city: row.profiles?.city ?? null,
    xp: Number(row.profiles?.xp ?? 0),
    reliability_score: Number(row.profiles?.reliability_score ?? 100),
    message: row.message ?? '',
    status: row.status ?? 'pending',
    created_at: row.created_at,
  }));
}

export async function submitSquadJoinRequest(args: {
  squadId: string;
  userId: string;
  message?: string;
}): Promise<void> {
  const cleanMessage = args.message?.trim() || '';
  const squad = await fetchSquadById(args.squadId);
  const { data: banned } = await supabase.from('squad_bans').select('user_id').eq('squad_id', args.squadId).eq('user_id', args.userId).maybeSingle();
  if (banned) throw new Error('You are banned from this squad.');
  const { count: memberCount } = await supabase.from('squad_members').select('user_id', { count: 'exact', head: true }).eq('squad_id', args.squadId);
  if ((memberCount ?? 0) >= Number(squad.member_limit ?? 10)) throw new Error('This squad is already full.');
  const { data: existing, error: existingError } = await supabase
    .from('squad_join_requests')
    .select('id, status')
    .eq('squad_id', args.squadId)
    .eq('user_id', args.userId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error(existing.status === 'approved' ? 'You already joined this squad.' : 'You already have a pending request.');

  const { error } = await supabase.from('squad_join_requests').insert({
    squad_id: args.squadId,
    user_id: args.userId,
    message: cleanMessage || null,
    status: 'pending',
  });
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'join_request_created', metadata: { user_id: args.userId } });
}

export async function reviewSquadJoinRequest(args: {
  squadId: string;
  requestId: string;
  reviewByUserId: string;
  approve: boolean;
}): Promise<void> {
  await ensureCanReviewApplications(args.squadId, args.reviewByUserId);
  const { data: req, error: reqError } = await supabase
    .from('squad_join_requests')
    .select('id, squad_id, user_id, status')
    .eq('id', args.requestId)
    .eq('squad_id', args.squadId)
    .single();
  if (reqError) throw reqError;

  const status = args.approve ? 'approved' : 'declined';
  const { error } = await supabase
    .from('squad_join_requests')
    .update({ status, reviewed_by: args.reviewByUserId, reviewed_at: new Date().toISOString() })
    .eq('id', args.requestId);
  if (error) throw error;

  if (args.approve) {
    const { error: memberError } = await supabase
      .from('squad_members')
      .upsert({ squad_id: args.squadId, user_id: req.user_id, role: 'member' }, { onConflict: 'squad_id,user_id' });
    if (memberError) throw memberError;
    await supabase.from('squad_feed_events').insert({
      squad_id: args.squadId,
      event_type: 'member',
      title: 'New member approved',
      body: 'A new player was accepted into the squad.',
      actor_user_id: req.user_id,
    });
    await createNotification({
      user_id: req.user_id,
      type: 'squad_join_request_approved',
      message: 'Your squad application was approved.',
      related_user_id: args.reviewByUserId,
    });
  } else {
    await createNotification({
      user_id: req.user_id,
      type: 'squad_join_request_declined',
      message: 'Your squad application was declined.',
      related_user_id: args.reviewByUserId,
    });
  }

  await logSquadAudit({
    squadId: args.squadId,
    action: args.approve ? 'join_request_approved' : 'join_request_declined',
    metadata: { request_id: args.requestId, target_user_id: req.user_id },
  });
}

export async function fetchSquadInvites(squadId: string): Promise<SquadInviteRecord[]> {
  const { data, error } = await supabase
    .from('squad_invites')
    .select('id, squad_id, invited_user_id, invited_by, message, status, created_at, expires_at, invited_user:profiles!squad_invites_invited_user_id_fkey(username), inviter:profiles!squad_invites_invited_by_fkey(username), squads(name)')
    .eq('squad_id', squadId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    squad_id: row.squad_id,
    squad_name: row.squads?.name ?? 'Squad',
    invited_user_id: row.invited_user_id,
    invited_by: row.invited_by,
    invited_by_username: row.inviter?.username ?? null,
    invited_user_username: row.invited_user?.username ?? null,
    message: row.message ?? '',
    status: row.status ?? 'pending',
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
  }));
}

export async function fetchMyPendingSquadInvites(userId: string): Promise<SquadInviteRecord[]> {
  const { data, error } = await supabase
    .from('squad_invites')
    .select('id, squad_id, invited_user_id, invited_by, message, status, created_at, expires_at, inviter:profiles!squad_invites_invited_by_fkey(username), squads(name)')
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    squad_id: row.squad_id,
    squad_name: row.squads?.name ?? 'Squad',
    invited_user_id: row.invited_user_id,
    invited_by: row.invited_by,
    invited_by_username: row.inviter?.username ?? null,
    invited_user_username: null,
    message: row.message ?? '',
    status: row.status ?? 'pending',
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
  }));
}

export async function createSquadInvite(args: {
  squadId: string;
  invitedUserId: string;
  invitedByUserId: string;
  message?: string;
}): Promise<void> {
  const context = await ensureCanInvitePlayers(args.squadId, args.invitedByUserId);
  const { data: banned } = await supabase.from('squad_bans').select('user_id').eq('squad_id', args.squadId).eq('user_id', args.invitedUserId).maybeSingle();
  if (banned) throw new Error('That player is banned from this squad.');
  const { count: memberCount } = await supabase.from('squad_members').select('user_id', { count: 'exact', head: true }).eq('squad_id', args.squadId);
  if ((memberCount ?? 0) >= Number(context.squad.member_limit ?? 10)) throw new Error('This squad is already full.');
  const { data: existingMembership } = await supabase
    .from('squad_members')
    .select('user_id')
    .eq('squad_id', args.squadId)
    .eq('user_id', args.invitedUserId)
    .maybeSingle();
  if (existingMembership) throw new Error('That player is already in this squad.');

  const { data: existingInvite } = await supabase
    .from('squad_invites')
    .select('id')
    .eq('squad_id', args.squadId)
    .eq('invited_user_id', args.invitedUserId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existingInvite) throw new Error('That player already has a pending invite.');

  const { error } = await supabase.from('squad_invites').insert({
    squad_id: args.squadId,
    invited_user_id: args.invitedUserId,
    invited_by: args.invitedByUserId,
    message: args.message?.trim() || null,
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  await createNotification({
    user_id: args.invitedUserId,
    type: 'squad_invite',
    message: 'You received a squad invite.',
    related_user_id: args.invitedByUserId,
  });
  await logSquadAudit({ squadId: args.squadId, action: 'squad_invite_created', metadata: { invited_user_id: args.invitedUserId } });
}

export async function respondSquadInvite(args: {
  inviteId: string;
  userId: string;
  accept: boolean;
}): Promise<string> {
  const { data: invite, error: inviteError } = await supabase
    .from('squad_invites')
    .select('id, squad_id, invited_user_id, invited_by, status')
    .eq('id', args.inviteId)
    .single();
  if (inviteError) throw inviteError;
  if (invite.invited_user_id !== args.userId) throw new Error('You cannot respond to this invite.');
  if (args.accept) {
    const squad = await fetchSquadById(invite.squad_id);
    const { data: banned } = await supabase.from('squad_bans').select('user_id').eq('squad_id', invite.squad_id).eq('user_id', args.userId).maybeSingle();
    if (banned) throw new Error('You are banned from this squad.');
    const { count: memberCount } = await supabase.from('squad_members').select('user_id', { count: 'exact', head: true }).eq('squad_id', invite.squad_id);
    if ((memberCount ?? 0) >= Number(squad.member_limit ?? 10)) throw new Error('This squad is already full.');
  }

  const status = args.accept ? 'accepted' : 'declined';
  const { error } = await supabase.from('squad_invites').update({ status }).eq('id', args.inviteId);
  if (error) throw error;

  if (args.accept) {
    const { error: memberError } = await supabase
      .from('squad_members')
      .upsert({ squad_id: invite.squad_id, user_id: args.userId, role: 'member' }, { onConflict: 'squad_id,user_id' });
    if (memberError) throw memberError;
    await supabase.from('squad_feed_events').insert({
      squad_id: invite.squad_id,
      event_type: 'member',
      title: 'Invite accepted',
      body: 'A player joined through a squad invite.',
      actor_user_id: args.userId,
    });
  }

  await createNotification({
    user_id: invite.invited_by,
    type: args.accept ? 'squad_invite_accepted' : 'squad_invite_declined',
    message: args.accept ? 'A player accepted your squad invite.' : 'A player declined your squad invite.',
    related_user_id: args.userId,
  });
  await logSquadAudit({ squadId: invite.squad_id, action: args.accept ? 'squad_invite_accepted' : 'squad_invite_declined', metadata: { invite_id: args.inviteId, target_user_id: args.userId } });
  return invite.squad_id;
}

export async function revokeSquadInvite(args: { squadId: string; inviteId: string; actorUserId: string }): Promise<void> {
  await ensureCanInvitePlayers(args.squadId, args.actorUserId);
  const { error } = await supabase.from('squad_invites').update({ status: 'revoked' }).eq('id', args.inviteId).eq('squad_id', args.squadId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'squad_invite_revoked', metadata: { invite_id: args.inviteId } });
}

export async function searchProfilesForSquadInvites(args: {
  squadId: string;
  query: string;
}): Promise<SquadInviteCandidate[]> {
  const query = args.query.trim();
  if (!query) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, city, xp, reliability_score')
    .ilike('username', `%${query}%`)
    .limit(8);
  if (error) throw error;

  const { data: members } = await supabase.from('squad_members').select('user_id').eq('squad_id', args.squadId);
  const memberSet = new Set((members ?? []).map((row: any) => row.user_id as string));
  return (data ?? [])
    .filter((row: any) => !memberSet.has(row.id))
    .map((row: any) => ({
      id: row.id,
      username: row.username ?? null,
      city: row.city ?? null,
      xp: Number(row.xp ?? 0),
      reliability_score: Number(row.reliability_score ?? 100),
    }));
}

export async function updateSquadMemberRole(args: {
  squadId: string;
  memberUserId: string;
  nextRole: SquadRole;
  actorUserId: string;
}): Promise<void> {
  const context = await ensureCanManageSpecificTarget({ squadId: args.squadId, actorUserId: args.actorUserId, targetUserId: args.memberUserId });
  const nextRole = normalizeRole(args.nextRole);
  if (!context.isOwner && roleRank(nextRole) >= roleRank(context.role)) throw new Error('You can only assign roles below your own level.');
  if (context.isOwner && nextRole === 'captain' && args.memberUserId !== context.squad.owner_id) throw new Error('Use owner transfer for a captain handoff.');
  const { error } = await supabase
    .from('squad_members')
    .update({ role: nextRole })
    .eq('squad_id', args.squadId)
    .eq('user_id', args.memberUserId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'member_role_updated', metadata: { actor_user_id: args.actorUserId, target_user_id: args.memberUserId, role: nextRole } });
}

export async function removeSquadMember(args: {
  squadId: string;
  memberUserId: string;
  actorUserId: string;
}): Promise<void> {
  await ensureCanManageSpecificTarget({ squadId: args.squadId, actorUserId: args.actorUserId, targetUserId: args.memberUserId });
  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('squad_id', args.squadId)
    .eq('user_id', args.memberUserId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'member_removed', metadata: { actor_user_id: args.actorUserId, target_user_id: args.memberUserId } });
}

export async function banSquadUser(args: {
  squadId: string;
  memberUserId: string;
  bannedByUserId: string;
  reason?: string;
}): Promise<void> {
  await ensureCanManageSpecificTarget({ squadId: args.squadId, actorUserId: args.bannedByUserId, targetUserId: args.memberUserId });
  await removeSquadMember({ squadId: args.squadId, memberUserId: args.memberUserId, actorUserId: args.bannedByUserId });
  const { error } = await supabase.from('squad_bans').upsert({
    squad_id: args.squadId,
    user_id: args.memberUserId,
    banned_by: args.bannedByUserId,
    reason: args.reason?.trim() || null,
  });
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'member_banned', metadata: { target_user_id: args.memberUserId, reason: args.reason ?? null } });
}

export async function fetchSquadChatMessages(args: {
  squadId: string;
  channel?: string;
  limit?: number;
}): Promise<SquadChatMessage[]> {
  const channel = (args.channel?.trim() || 'main').toLowerCase();
  const { data, error } = await supabase
    .from('squad_messages')
    .select('id, squad_id, sender_id, channel, body, created_at, profiles:profiles!squad_messages_sender_id_fkey(username)')
    .eq('squad_id', args.squadId)
    .eq('channel', channel)
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 40);
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    squad_id: row.squad_id,
    sender_id: row.sender_id,
    sender_username: row.profiles?.username ?? null,
    channel: row.channel ?? channel,
    body: row.body ?? '',
    created_at: row.created_at,
  })).reverse();
}

export async function postSquadChatMessage(args: {
  squadId: string;
  senderId: string;
  channel?: string;
  body: string;
}): Promise<void> {
  const body = args.body.trim();
  if (!body) throw new Error('Message cannot be empty.');

  const [membershipRes, channelsRes] = await Promise.all([
    supabase.from('squad_members').select('user_id').eq('squad_id', args.squadId).eq('user_id', args.senderId).maybeSingle(),
    supabase.from('squad_channels').select('channel_key, is_private').eq('squad_id', args.squadId),
  ]);

  if (membershipRes.error) throw membershipRes.error;
  if (!membershipRes.data) throw new Error('You must be a squad member to chat here.');

  const channel = (args.channel?.trim() || 'main').toLowerCase();
  const knownChannel = ((channelsRes.data ?? []) as any[]).find((row) => String(row.channel_key ?? '').toLowerCase() === channel);
  if (knownChannel?.is_private && !membershipRes.data) throw new Error('You do not have access to this private channel.');

  if (channel === 'announcements') {
    await ensureCanPostAnnouncements(args.squadId, args.senderId);
  }

  const { error } = await supabase.from('squad_messages').insert({
    squad_id: args.squadId,
    sender_id: args.senderId,
    channel,
    body,
  });
  if (error) throw error;

  if (channel === 'announcements') {
    await supabase.from('squad_feed_events').insert({
      squad_id: args.squadId,
      event_type: 'announcement',
      title: 'Channel update',
      body,
      actor_user_id: args.senderId,
    });
  } else {
    await supabase.from('squad_feed_events').insert({
      squad_id: args.squadId,
      event_type: 'member',
      title: 'Squad chat is active',
      body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
      actor_user_id: args.senderId,
    });
  }
}

export async function updateSquadAnnouncementPin(args: {
  squadId: string;
  announcementId: string;
  actorUserId: string;
  isPinned: boolean;
}): Promise<void> {
  await ensureCanPostAnnouncements(args.squadId, args.actorUserId);
  const { error } = await supabase
    .from('squad_announcements')
    .update({ is_pinned: args.isPinned })
    .eq('id', args.announcementId)
    .eq('squad_id', args.squadId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: args.isPinned ? 'announcement_pinned' : 'announcement_unpinned', metadata: { announcement_id: args.announcementId } });
}

export async function fetchSquadAnnouncements(squadId: string): Promise<SquadAnnouncement[]> {
  const { data, error } = await supabase
    .from('squad_announcements')
    .select('id, squad_id, author_id, title, body, is_pinned, created_at, profiles:profiles!squad_announcements_author_id_fkey(username)')
    .eq('squad_id', squadId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    squad_id: row.squad_id,
    author_id: row.author_id,
    author_username: row.profiles?.username ?? null,
    title: row.title,
    body: row.body,
    is_pinned: Boolean(row.is_pinned),
    created_at: row.created_at,
  }));
}

export async function createSquadAnnouncement(args: {
  squadId: string;
  authorId: string;
  title: string;
  body: string;
  isPinned?: boolean;
}): Promise<void> {
  await ensureCanPostAnnouncements(args.squadId, args.authorId);
  const { error } = await supabase.from('squad_announcements').insert({
    squad_id: args.squadId,
    author_id: args.authorId,
    title: args.title.trim(),
    body: args.body.trim(),
    is_pinned: Boolean(args.isPinned),
  });
  if (error) throw error;
  await supabase.from('squad_feed_events').insert({
    squad_id: args.squadId,
    event_type: 'announcement',
    title: args.title.trim(),
    body: args.body.trim(),
    actor_user_id: args.authorId,
  });
  await logSquadAudit({ squadId: args.squadId, action: 'announcement_created', metadata: { title: args.title.trim() } });
}

export async function fetchSquadAuditLogs(squadId: string): Promise<SquadAuditRecord[]> {
  const { data, error } = await supabase
    .from('squad_audit_logs')
    .select('id, squad_id, actor_user_id, action, target_user_id, metadata, created_at, actor:profiles!squad_audit_logs_actor_user_id_fkey(username), target:profiles!squad_audit_logs_target_user_id_fkey(username)')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id, squad_id: row.squad_id, actor_user_id: row.actor_user_id ?? null, actor_username: row.actor?.username ?? null, action: row.action, target_user_id: row.target_user_id ?? null, target_username: row.target?.username ?? null, metadata: row.metadata ?? {}, created_at: row.created_at,
  }));
}

export async function fetchSquadBanList(squadId: string): Promise<SquadBanRecord[]> {
  const { data, error } = await supabase
    .from('squad_bans')
    .select('squad_id, user_id, banned_by, reason, created_at, user:profiles!squad_bans_user_id_fkey(username), banner:profiles!squad_bans_banned_by_fkey(username)')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    squad_id: row.squad_id, user_id: row.user_id, username: row.user?.username ?? null, banned_by: row.banned_by, banned_by_username: row.banner?.username ?? null, reason: row.reason ?? null, created_at: row.created_at,
  }));
}

export async function unbanSquadUser(args: { squadId: string; userId: string; actorUserId: string }): Promise<void> {
  const context = await fetchActorContext(args.squadId, args.actorUserId);
  if (!context.permissions.canBanMembers) throw new Error('You do not have permission to manage bans.');
  const { error } = await supabase.from('squad_bans').delete().eq('squad_id', args.squadId).eq('user_id', args.userId);
  if (error) throw error;
  await logSquadAudit({ squadId: args.squadId, action: 'member_unbanned', metadata: { actor_user_id: args.actorUserId, target_user_id: args.userId } });
}
