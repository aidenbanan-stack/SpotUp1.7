import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';

type ProfileRow = {
  id: string;
  email: string | null;
  username: string | null;
  profile_photo_url: string | null;
  created_at?: string;
};

function emailToUsername(email: string): string {
  const base = email.split('@')[0] || 'player';
  // Keep it simple and URL-safe.
  return base.replace(/[^a-zA-Z0-9_\.]/g, '').slice(0, 18) || 'player';
}

function profileToUser(row: ProfileRow): User {
  const email = row.email ?? '';
  const username = row.username ?? (email ? emailToUsername(email) : 'player');
  const photo = row.profile_photo_url ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=spotup';

  // The app UI expects a richer User shape. For now we provide sensible defaults.
  return {
    id: row.id,
    username,
    email,
    age: 20,
    height: "5'9\"",
    city: 'Irvine, CA',
    primarySport: 'basketball',
    secondarySports: [],
    skillLevel: 'intermediate',
    profilePhotoUrl: photo,
    stats: { gamesPlayed: 0, gamesHosted: 0, reliability: 100 },
    xp: 0,
    level: 'rookie',
    badges: [],
    reliabilityStats: { showUps: 0, cancellations: 0, noShows: 0, score: 100 },
    votesReceived: { bestScorer: 0, bestDefender: 0, bestTeammate: 0 },
    uniqueCourtsPlayed: 0,
  };
}

/**
 * Fetch the signed-in user's profile row, creating it if needed.
 * Requires a table: public.profiles(id uuid pk references auth.users(id), email, username, profile_photo_url)
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
    .select('id,email,username,profile_photo_url')
    .eq('id', me.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return profileToUser(existing as ProfileRow);

  const insert: ProfileRow = {
    id: me.id,
    email,
    username: usernameFromMeta ?? (email ? emailToUsername(email) : 'player'),
    profile_photo_url: photoFromMeta,
  };

  const { data: created, error: insErr } = await supabase
    .from('profiles')
    .insert(insert)
    .select('id,email,username,profile_photo_url')
    .single();

  if (insErr) throw insErr;
  return profileToUser(created as ProfileRow);
}

/**
 * Fetch a single user profile by id.
 * Returns null if the profile does not exist.
 */
export async function fetchProfileById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,username,profile_photo_url')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? profileToUser(data as ProfileRow) : null;
}

/**
 * Fetch many user profiles by their ids.
 */
export async function fetchProfilesByIds(ids: string[]): Promise<User[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,username,profile_photo_url')
    .in('id', ids);

  if (error) throw error;
  return (data ?? []).map((row) => profileToUser(row as ProfileRow));
}
