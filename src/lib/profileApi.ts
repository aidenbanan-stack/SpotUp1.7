import { supabase } from '@/lib/supabaseClient';
import { PLAYER_LEVELS, type PlayerLevel, type Sport, type User } from '@/types';

type PublicProfileRow = {
  id: string;
  username: string | null;
  profile_photo_url: string | null;
  bio?: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  username: string | null;
  profile_photo_url: string | null;

  // Extended profile fields (recommended)
  bio: string | null;
  age: number | null;
  height: string | null;
  city: string | null;
  primary_sport: Sport | null;
  secondary_sports: Sport[] | null;
  onboarding_completed: boolean | null;

  // Optional progression fields (added by SQL updates)
  xp?: number | null;
  show_ups?: number | null;
  cancellations?: number | null;
  no_shows?: number | null;
  reliability_score?: number | null;

  created_at?: string;
};

function emailToUsername(email: string): string {
  const base = email.split('@')[0] || 'player';
  // Keep it simple and URL-safe.
  return base.replace(/[^a-zA-Z0-9_\.]/g, '').slice(0, 18) || 'player';
}

function levelFromXP(xp: number): PlayerLevel {
  const value = Number.isFinite(xp) ? xp : 0;
  // Find the highest level whose minXP is <= xp.
  let current: PlayerLevel = PLAYER_LEVELS[0].id;
  for (const lvl of PLAYER_LEVELS) {
    if (value >= lvl.minXP) current = lvl.id;
  }
  return current;
}

function profileToUser(row: ProfileRow): User {
  const email = row.email ?? '';
  const username = row.username ?? (email ? emailToUsername(email) : 'player');
  const photo =
    row.profile_photo_url ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=spotup';

  return {
    id: row.id,
    username,
    email,
    bio: row.bio ?? '',
    age: row.age ?? 20,
    height: row.height ?? "5'9\"",
    city: row.city ?? 'Irvine, CA',
    primarySport: row.primary_sport ?? 'basketball',
    secondarySports: row.secondary_sports ?? [],
    skillLevel: 'intermediate',
    profilePhotoUrl: photo,
    onboardingCompleted: Boolean(row.onboarding_completed),

    stats: { gamesPlayed: 0, gamesHosted: 0, reliability: row.reliability_score ?? 100 },
    xp: row.xp ?? 0,
    level: levelFromXP(row.xp ?? 0),
    badges: [],
    reliabilityStats: {
      showUps: row.show_ups ?? 0,
      cancellations: row.cancellations ?? 0,
      noShows: row.no_shows ?? 0,
      score: row.reliability_score ?? 100,
    },
    votesReceived: { bestScorer: 0, bestDefender: 0, bestTeammate: 0 },
    uniqueCourtsPlayed: 0,
  };
}

function publicProfileToUser(row: PublicProfileRow): User {
  const username = row.username ?? 'player';
  const photo =
    row.profile_photo_url ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=spotup';

  return {
    id: row.id,
    username,
    email: '',
    bio: row.bio ?? '',
    age: 20,
    height: "5'9",
    city: '',
    primarySport: 'basketball',
    secondarySports: [],
    skillLevel: 'intermediate',
    profilePhotoUrl: photo,
    onboardingCompleted: true,
    stats: { gamesPlayed: 0, gamesHosted: 0, reliability: 100 },
    xp: 0,
    level: levelFromXP(row.xp ?? 0),
    badges: [],
    reliabilityStats: { showUps: 0, cancellations: 0, noShows: 0, score: 100 },
    votesReceived: { bestScorer: 0, bestDefender: 0, bestTeammate: 0 },
    uniqueCourtsPlayed: 0,
  };
}


/**
 * Required table (Supabase SQL):
 * public.profiles(
 *   id uuid primary key references auth.users(id),
 *   email text,
 *   username text,
 *   profile_photo_url text,
 *   bio text,
 *   age int,
 *   height text,
 *   city text,
 *   primary_sport text,
 *   secondary_sports text[],
 *   onboarding_completed boolean default false,
 *   created_at timestamptz default now()
 * )
 */
export async function getOrCreateMyProfile(): Promise<User> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  const email = me.email ?? null;
  const md: any = me.user_metadata ?? {};
  const usernameFromMeta: string | null = md.full_name || md.name || null;
  const photoFromMeta: string | null = md.avatar_url || md.picture || null;

  const { data: existing, error: selErr } = await supabase
    .from('profiles')
    .select(
      'id,email,username,profile_photo_url,bio,age,height,city,primary_sport,secondary_sports,onboarding_completed,xp,show_ups,cancellations,no_shows,reliability_score'
    )
    .eq('id', me.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return profileToUser(existing as ProfileRow);

  const insert: Partial<ProfileRow> = {
    id: me.id,
    email,
    username: usernameFromMeta ?? (email ? emailToUsername(email) : 'player'),
    profile_photo_url: photoFromMeta,
    onboarding_completed: false,
  };

  const { data: created, error: insErr } = await supabase
    .from('profiles')
    .insert(insert)
    .select(
      'id,email,username,profile_photo_url,bio,age,height,city,primary_sport,secondary_sports,onboarding_completed,xp,show_ups,cancellations,no_shows,reliability_score'
    )
    .single();

  if (insErr) throw insErr;
  return profileToUser(created as ProfileRow);
}

/**
 * Fetch a single user profile by id.
 * Returns null if the profile does not exist.
 */
export async function fetchProfileById(id: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,email,username,profile_photo_url,bio,age,height,city,primary_sport,secondary_sports,onboarding_completed,xp,show_ups,cancellations,no_shows,reliability_score'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? profileToUser(data as ProfileRow) : null;
  } catch (err: any) {
    // RLS can block reading other users' profiles. Fall back to a safe public RPC.
    const { data, error } = await supabase.rpc('get_public_profiles', { p_user_ids: [id] });
    if (error) throw err;
    const row = (data?.[0] ?? null) as any;
    return row ? publicProfileToUser(row as PublicProfileRow) : null;
  }
}

/**
 * Fetch many user profiles by their ids.
 */
export async function fetchProfilesByIds(ids: string[]): Promise<User[]> {
  if (!ids.length) return [];

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,email,username,profile_photo_url,bio,age,height,city,primary_sport,secondary_sports,onboarding_completed,xp,show_ups,cancellations,no_shows,reliability_score'
      )
      .in('id', ids);

    if (error) throw error;
    return (data ?? []).map((row) => profileToUser(row as ProfileRow));
  } catch (err) {
    const { data, error } = await supabase.rpc('get_public_profiles', { p_user_ids: ids });
    if (error) throw err;
    return (data ?? []).map((row: any) => publicProfileToUser(row as PublicProfileRow));
  }
}

/**
 * Search profiles by username/email (used for Discover + message requests).
 */
export async function searchProfiles(query: string, limit = 20): Promise<User[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id,email,username,profile_photo_url,bio,age,height,city,primary_sport,secondary_sports,onboarding_completed,xp,show_ups,cancellations,no_shows,reliability_score'
    )
    .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => profileToUser(row as ProfileRow));
}

export type UpdateMyProfileInput = {
  username?: string;
  profilePhotoUrl?: string;
  bio?: string;
  age?: number;
  height?: string;
  city?: string;
  primarySport?: Sport;
  secondarySports?: Sport[];
  onboardingCompleted?: boolean;
};

export async function updateMyProfile(input: UpdateMyProfileInput) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) throw new Error('Not signed in');

  const userId = authData.user.id;
  const email = authData.user.email ?? null;

  // Map your app fields to DB columns exactly
  const payload: any = {
    id: userId, // REQUIRED for your RLS policies
    email,
  };

  if (typeof input.username === 'string') payload.username = input.username;
  if (typeof input.bio === 'string') payload.bio = input.bio;
  if (typeof input.age === 'number') payload.age = input.age;
  if (typeof input.height === 'string') payload.height = input.height || null;
  if (typeof input.city === 'string') payload.city = input.city;

  if (input.primarySport) payload.primary_sport = input.primarySport;
  if (Array.isArray(input.secondarySports)) payload.secondary_sports = input.secondarySports;

  if (typeof input.profilePhotoUrl === 'string') payload.profile_photo_url = input.profilePhotoUrl;

  if (typeof input.onboardingCompleted === 'boolean') {
    payload.onboarding_completed = input.onboardingCompleted;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return profileToUser(data as ProfileRow);
}

/**
 * Optional: upload an avatar file to Supabase Storage bucket "avatars" and return public URL.
 * You must create the bucket in Supabase: Storage -> Buckets -> New bucket (name: avatars) and set it public.
 */
export async function uploadMyAvatar(file: File): Promise<string> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = auth.user;
  if (!me) throw new Error('Not signed in.');

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${me.id}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
