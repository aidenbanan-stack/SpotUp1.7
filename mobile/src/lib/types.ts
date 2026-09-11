export type Sport = string;
export type Audience = "members" | "followers" | "private";
export interface Profile {
  id: string;
  name: string;
  bio: string;
  sports: Sport[];
  city: string;
  avatar_url: string | null;
  legacy_avatar_url?: string | null;
  showcase_visibility: Audience;
  comments_policy: string;
  tags_policy: string;
  interactions_policy: string;
}
export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}
export interface Game {
  id: string;
  host_id: string;
  title: string;
  sport_id: Sport;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  skill: string;
  format: string;
  description: string;
  visibility: string;
  status: "upcoming" | "live" | "completed" | "cancelled";
  locations: Venue;
  profiles: Profile;
  game_players: Player[];
}
export interface Player {
  user_id: string;
  game_id: string;
  checked_in_at: string | null;
  confirmed_at: string | null;
  checked_out_at: string | null;
  profiles?: Profile;
}
export interface Squad {
  id: string;
  owner_id: string;
  name: string;
  sport_id: Sport;
  description: string;
  join_policy?: string;
  member_limit?: number;
  min_xp?: number;
  squad_members: { user_id: string; profiles?: Profile; role?: string }[];
}
export interface Tournament {
  id: string;
  organizer_id: string;
  name: string;
  sport_id: Sport;
  starts_at: string;
  registration_deadline: string;
  max_teams: number;
  status: string;
  locations: Venue;
  tournament_teams: Team[];
}
export interface Team {
  id: string;
  squad_id: string;
  squads: Squad;
}
export interface Match {
  id: string;
  round: number;
  slot: number;
  team_a: string | null;
  team_b: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
}
export interface Media {
  id: string;
  object_path: string;
  state: string;
  duration_seconds: number | null;
  byte_size: number | null;
}
export interface Clip {
  id: string;
  creator_id: string;
  media_id: string;
  caption: string;
  sport_id: Sport;
  category: string;
  created_at: string;
  game_id?: string | null;
  squad_id?: string | null;
  tournament_id?: string | null;
  location_id?: string | null;
  visibility?: Audience;
  profiles: Profile;
  media_assets: Media;
  reactions?: { user_id: string }[];
  saved_posts?: { user_id: string }[];
  comments?: { id: string }[];
  reason?: string;
}
export interface Summary {
  xp: number;
  level: number;
  games: number;
  reliability: number | null;
  followers: number;
}
export interface Message {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: Profile;
}
export const SPORTS: { id: Sport; name: string; icon: string }[] = [
  { id: "basketball", name: "Basketball", icon: "basketball-outline" },
  { id: "soccer", name: "Soccer", icon: "football-outline" },
  { id: "volleyball", name: "Volleyball", icon: "tennisball-outline" },
  { id: "tennis", name: "Tennis", icon: "tennisball-outline" },
  { id: "badminton", name: "Badminton", icon: "fitness-outline" },
  { id: "baseball", name: "Baseball", icon: "fitness-outline" },
  { id: "cricket", name: "Cricket", icon: "fitness-outline" },
  { id: "dodgeball", name: "Dodgeball", icon: "fitness-outline" },
  { id: "flag-football", name: "Flag football", icon: "fitness-outline" },
  { id: "futsal", name: "Futsal", icon: "fitness-outline" },
  { id: "handball", name: "Handball", icon: "fitness-outline" },
  { id: "field-hockey", name: "Field hockey", icon: "fitness-outline" },
  { id: "ice-hockey", name: "Ice hockey", icon: "fitness-outline" },
  { id: "kickball", name: "Kickball", icon: "fitness-outline" },
  { id: "lacrosse", name: "Lacrosse", icon: "fitness-outline" },
  { id: "netball", name: "Netball", icon: "fitness-outline" },
  { id: "padel", name: "Padel", icon: "fitness-outline" },
  { id: "pickleball", name: "Pickleball", icon: "fitness-outline" },
  { id: "rounders", name: "Rounders", icon: "fitness-outline" },
  { id: "rugby", name: "Rugby", icon: "fitness-outline" },
  { id: "softball", name: "Softball", icon: "fitness-outline" },
  { id: "squash", name: "Squash", icon: "fitness-outline" },
  { id: "table-tennis", name: "Table tennis", icon: "fitness-outline" },
  { id: "ultimate", name: "Ultimate frisbee", icon: "fitness-outline" },
  { id: "other", name: "Other sports", icon: "fitness-outline" },
];
export const CATEGORIES = [
  "Highlights",
  "Funny moments",
  "Skills",
  "Dunks",
  "Goals",
  "Tricks",
  "Training",
  "Game clips",
  "Challenges",
  "Tournament moments",
];
