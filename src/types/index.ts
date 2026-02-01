export type Sport = 
  | 'basketball'
  | 'soccer'
  | 'pickleball'
  | 'football'
  | 'baseball'
  | 'volleyball'
  | 'frisbee';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';

// Gamification Types
export type PlayerLevel = 'rookie' | 'regular' | 'hooper' | 'vet' | 'court_legend';

export interface PlayerLevelInfo {
  id: PlayerLevel;
  name: string;
  minXP: number;
  icon: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: Date;
  category: 'play' | 'host' | 'social' | 'explorer' | 'tournament';
}

export interface PostGameVote {
  id: string;
  gameId: string;
  voterId: string;
  votedUserId: string;
  category: 'best_scorer' | 'best_defender' | 'best_teammate';
  createdAt: Date;
}

export interface HostReputation {
  rating: number; // 1-5
  completionRate: number; // percentage
  totalHosted: number;
  isTrustedHost: boolean;
}

export interface ReliabilityStats {
  showUps: number;
  cancellations: number;
  noShows: number;
  score: number; // calculated percentage
}

export interface User {
  bio?: string;
  onboardingCompleted?: boolean;
  id: string;
  username: string;
  email: string;
  age: number;
  height: string;
  city: string;
  primarySport: Sport;
  secondarySports: Sport[];
  skillLevel: SkillLevel;
  profilePhotoUrl: string;
  stats: {
    gamesPlayed: number;
    gamesHosted: number;
    reliability: number;
  };
  // Gamification
  xp: number;
  level: PlayerLevel;
  badges: Badge[];
  reliabilityStats: ReliabilityStats;
  hostReputation?: HostReputation;
  votesReceived: {
    bestScorer: number;
    bestDefender: number;
    bestTeammate: number;
  };
  // Court exploration
  uniqueCourtsPlayed?: number;
}

export interface Game {
  id: string;
  hostId: string;
  host?: User;
  sport: Sport;
  title: string;
  description: string;
  dateTime: Date;
  duration: number;
  skillRequirement: SkillLevel;
  maxPlayers: number;
  playerIds: string[];
  players?: User[];
  pendingRequestIds: string[];
  isPrivate: boolean;
  status: GameStatus;
  checkedInIds: string[];
  runsStarted: boolean;
  endedAt?: Date;
  postGameVotes?: PostGameVotes;
  postGameVoters?: PostGameVoters;
  location: {
    latitude: number;
    longitude: number;
    areaName: string;
  };
  createdAt: Date;
  completedAt?: Date;
  postGameVotes?: PostGameVote[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'game_invite' | 'game_approved' | 'game_denied' | 'game_reminder' | 'game_cancelled' | 'tournament_invite' | 'tournament_start';
  relatedGameId?: string;
  relatedUserId?: string;
  relatedTournamentId?: string;
  message: string;
  createdAt: Date;
  read: boolean;
}

export interface FriendRequest {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'rejected';
}

// Tournament Types
export type TournamentFormat = '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
export type SeriesType = 'single_elimination' | 'best_of_3';
export type PointsStyle = '1s_and_2s' | '2s_and_3s';
export type TeamCount = 2 | 4 | 8 | 16 | 32;
export type CheckInStatus = 'not_started' | 'on_my_way' | 'arrived';

export type GameStatus = 'scheduled' | 'live' | 'finished';

export type PostGameVoteCategory =
  | 'best_shooter'
  | 'best_passer'
  | 'best_all_around'
  | 'best_scorer'
  | 'best_defender';

export type PostGameVotes = Record<PostGameVoteCategory, Record<string, number>>;
export type PostGameVoters = Record<string, Partial<Record<PostGameVoteCategory, string>>>;


export interface TournamentTeam {
  id: string;
  name: string;
  playerIds: string[];
  players?: User[];
  captainId: string;
  checkInStatus: CheckInStatus;
  isEliminated: boolean;
}

export interface TournamentMatch {
  id: string;
  roundNumber: number;
  matchNumber: number;
  team1Id?: string;
  team2Id?: string;
  team1?: TournamentTeam;
  team2?: TournamentTeam;
  team1Score?: number;
  team2Score?: number;
  winnerId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'forfeit';
  // For Best of 3
  games?: { team1Score: number; team2Score: number }[];
}

export interface Tournament {
  id: string;
  name: string;
  hostId: string;
  host?: User;
  sport: Sport;
  format: TournamentFormat;
  seriesType: SeriesType;
  teamCount: TeamCount;
  playToScore: number;
  pointsStyle: PointsStyle;
  makeItTakeIt: boolean;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  dateTime: Date;
  notes?: string;
  teams: TournamentTeam[];
  soloPlayers: { id: string; player?: User }[];
  matches: TournamentMatch[];
  status: 'open' | 'roster_locked' | 'in_progress' | 'completed' | 'cancelled';
  minReliability: number; // default 80
  createdAt: Date;
}

export const SPORTS: { id: Sport; name: string; icon: string }[] = [
  { id: 'basketball', name: 'Basketball', icon: '🏀' },
  { id: 'soccer', name: 'Soccer', icon: '⚽' },
  { id: 'pickleball', name: 'Pickleball', icon: '🏓' },
  { id: 'football', name: 'Flag Football', icon: '🏈' },
  { id: 'baseball', name: 'Baseball', icon: '⚾' },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐' },
  { id: 'frisbee', name: 'Ultimate Frisbee', icon: '🥏' },
];

export const SKILL_LEVELS: { id: SkillLevel; name: string }[] = [
  { id: 'beginner', name: 'Beginner' },
  { id: 'intermediate', name: 'Intermediate' },
  { id: 'advanced', name: 'Advanced' },
  { id: 'elite', name: 'Elite' },
];

export const PLAYER_LEVELS: PlayerLevelInfo[] = [
  { id: 'rookie', name: 'Rookie', minXP: 0, icon: '🌱' },
  { id: 'regular', name: 'Regular', minXP: 100, icon: '⭐' },
  { id: 'hooper', name: 'Hooper', minXP: 500, icon: '🔥' },
  { id: 'vet', name: 'Vet', minXP: 1500, icon: '💎' },
  { id: 'court_legend', name: 'Court Legend', minXP: 5000, icon: '👑' },
];

export const AVAILABLE_BADGES: Badge[] = [
  { id: 'first_game', name: 'First Game', description: 'Played your first game', icon: '🎮', category: 'play' },
  { id: 'game_streak_10', name: 'On Fire', description: 'Played 10 games in a row', icon: '🔥', category: 'play' },
  { id: 'multi_sport', name: 'Multi-Sport Athlete', description: 'Played 3+ different sports', icon: '🏅', category: 'explorer' },
  { id: 'court_explorer', name: 'Court Explorer', description: 'Played at 5+ different locations', icon: '🗺️', category: 'explorer' },
  { id: 'first_host', name: 'Game Host', description: 'Hosted your first game', icon: '🎯', category: 'host' },
  { id: 'super_host', name: 'Super Host', description: 'Hosted 10+ games with 4.5+ rating', icon: '🌟', category: 'host' },
  { id: 'reliable_player', name: 'Reliable Player', description: '95%+ reliability score', icon: '✅', category: 'social' },
  { id: 'mvp_scorer', name: 'MVP Scorer', description: 'Voted best scorer 5+ times', icon: '🏆', category: 'social' },
  { id: 'team_player', name: 'Team Player', description: 'Voted best teammate 5+ times', icon: '🤝', category: 'social' },
  { id: 'lockdown', name: 'Lockdown', description: 'Voted best defender 5+ times', icon: '🛡️', category: 'social' },
  { id: 'tournament_winner', name: 'Tournament Champion', description: 'Won a tournament', icon: '🏆', category: 'tournament' },
  { id: 'tournament_host', name: 'Tournament Host', description: 'Successfully hosted a tournament', icon: '🎪', category: 'tournament' },
];

export const TOURNAMENT_FORMATS: { id: TournamentFormat; name: string }[] = [
  { id: '1v1', name: '1v1' },
  { id: '2v2', name: '2v2' },
  { id: '3v3', name: '3v3' },
  { id: '4v4', name: '4v4' },
  { id: '5v5', name: '5v5' },
];

export const TEAM_COUNTS: TeamCount[] = [2, 4, 8, 16, 32];

export function calculatePlayerLevel(xp: number): PlayerLevel {
  const levels = [...PLAYER_LEVELS].reverse();
  for (const level of levels) {
    if (xp >= level.minXP) {
      return level.id;
    }
  }
  return 'rookie';
}

export function calculateReliabilityScore(stats: ReliabilityStats): number {
  const total = stats.showUps + stats.cancellations + stats.noShows;
  if (total === 0) return 100;
  const penalty = (stats.cancellations * 5) + (stats.noShows * 15);
  return Math.max(0, Math.round(100 - (penalty / total)));
}

export function canCreateTournament(user: User): { allowed: boolean; requirements: { reliability: boolean; hostRating: boolean; gamesHosted: boolean } } {
  const reliabilityOk = user.reliabilityStats.score >= 90;
  const hostRatingOk = (user.hostReputation?.rating ?? 0) >= 4.0;
  const gamesHostedOk = (user.hostReputation?.totalHosted ?? 0) >= 5;
  
  return {
    allowed: reliabilityOk && hostRatingOk && gamesHostedOk,
    requirements: {
      reliability: reliabilityOk,
      hostRating: hostRatingOk,
      gamesHosted: gamesHostedOk,
    }
  };
}

export function canJoinTournament(user: User, minReliability: number = 80): boolean {
  return user.reliabilityStats.score >= minReliability;
}

export function getPlayersPerTeam(format: TournamentFormat): number {
  return parseInt(format.split('v')[0]);
}
