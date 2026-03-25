import type { Game } from '@/types';

const STALE_SCHEDULED_HOME_GRACE_MINUTES = 30;

export function getScheduledDiscoveryExpiry(game: Game): number {
  return game.dateTime.getTime() + STALE_SCHEDULED_HOME_GRACE_MINUTES * 60 * 1000;
}

export function isStaleScheduledGame(game: Game, now = Date.now()): boolean {
  return game.status === 'scheduled' && getScheduledDiscoveryExpiry(game) <= now;
}

export function isAffiliatedWithGame(game: Game, userId?: string | null): boolean {
  if (!userId) return false;

  return (
    game.hostId === userId ||
    game.playerIds.includes(userId) ||
    game.pendingRequestIds.includes(userId) ||
    game.checkedInIds.includes(userId)
  );
}

export function shouldShowGameOnHome(game: Game, now = Date.now()): boolean {
  if (game.status === 'scheduled' && isStaleScheduledGame(game, now)) {
    return false;
  }
  return true;
}
