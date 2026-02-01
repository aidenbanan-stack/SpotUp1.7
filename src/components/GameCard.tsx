import { Game } from '@/types';
import { SportIcon, SportBadge } from './SportIcon';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Users, Lock } from 'lucide-react';
import { format } from 'date-fns';

function safeFormatDateTime(value: any) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    return {
      shortDay: format(d, 'MMM d'),
      longDay: format(d, 'EEE, MMM d'),
      time: format(d, 'h:mm a'),
      date: d,
    };
  } catch {
    return null;
  }
}

interface GameCardProps {
  game: Game;
  onClick?: () => void;
  variant?: 'default' | 'compact';
  className?: string;
  viewerUserId?: string;
}

function obfuscateAreaName(areaName: string): string {
  // Best-effort: show "City, ST" (or last two comma-separated parts) without street/address.
  const raw = (areaName || '').trim();
  if (!raw) return 'Location';
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  return parts.slice(-2).join(', ');
}

export function GameCard({
  game,
  onClick,
  variant = 'default',
  className,
  viewerUserId,
}: GameCardProps) {
  const dt = safeFormatDateTime(game.dateTime);
  const isUpcoming = dt ? dt.date > new Date() : false;

  const canSeeExactLocation =
    !game.isPrivate ||
    (!!viewerUserId && (game.hostId === viewerUserId || game.playerIds.includes(viewerUserId)));

  const displayLocation = canSeeExactLocation
    ? game.location.areaName
    : obfuscateAreaName(game.location.areaName);

  // ---------- COMPACT CARD ----------
  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'glass-card p-4 w-full text-left transition-all duration-200 hover:border-primary/50 animate-fade-in',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <SportIcon sport={game.sport} size="md" />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {game.title}
            </h3>

            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />

              {dt ? (
                <span>
                  {dt.shortDay} at {dt.time}
                </span>
              ) : (
                <span className="text-destructive">Time TBD</span>
              )}

              {game.isPrivate && <Lock className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>
              {game.playerIds.length}/{game.maxPlayers}
            </span>
          </div>
        </div>
      </button>
    );
  }

  // ---------- DEFAULT CARD ----------
  return (
    <button
      onClick={onClick}
      className={cn(
        'glass-card p-5 w-full text-left transition-all duration-200 hover:border-primary/50 animate-fade-in',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <SportIcon sport={game.sport} size="lg" />

          <div>
            <h3 className="font-bold text-lg text-foreground">
              {game.title}
            </h3>

            <div className="flex items-center gap-2 mt-0.5">
              <SportBadge sport={game.sport} />

              {game.isPrivate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {game.description}
      </p>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4 text-primary" />

          {dt ? (
            <span>
              {dt.longDay} · {dt.time}
            </span>
          ) : (
            <span className="text-destructive">Time TBD</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-4 h-4 text-primary" />
          <span>{displayLocation}</span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-4 h-4 text-primary" />
          <span>
            {game.playerIds.length}/{game.maxPlayers} players
          </span>
        </div>
      </div>

      {game.host && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
          <img
            src={game.host.profilePhotoUrl}
            alt={game.host.username}
            className="w-8 h-8 rounded-full object-cover"
          />

          <div>
            <span className="text-xs text-muted-foreground">
              Hosted by
            </span>
            <p className="text-sm font-medium text-foreground">
              {game.host.username}
            </p>
          </div>
        </div>
      )}
    </button>
  );
}
