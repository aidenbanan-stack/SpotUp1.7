import { PLAYER_LEVELS, PlayerLevel } from '@/types';
import { cn } from '@/lib/utils';

interface PlayerLevelBadgeProps {
  level: PlayerLevel;
  xp: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlayerLevelBadge({ 
  level, 
  xp, 
  showProgress = false, 
  size = 'md',
  className 
}: PlayerLevelBadgeProps) {
  const levelInfo = PLAYER_LEVELS.find(l => l.id === level);
  const currentLevelIndex = PLAYER_LEVELS.findIndex(l => l.id === level);
  const nextLevel = PLAYER_LEVELS[currentLevelIndex + 1];
  
  const progressToNext = nextLevel 
    ? ((xp - levelInfo!.minXP) / (nextLevel.minXP - levelInfo!.minXP)) * 100
    : 100;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30',
        sizeClasses[size]
      )}>
        <span>{levelInfo?.icon}</span>
        <span className="font-semibold text-foreground">{levelInfo?.name}</span>
        <span className="text-muted-foreground">({xp.toLocaleString()} XP)</span>
      </div>
      
      {showProgress && nextLevel && (
        <div className="space-y-1">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressToNext, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {nextLevel.minXP - xp} XP to {nextLevel.name} {nextLevel.icon}
          </p>
        </div>
      )}
    </div>
  );
}
