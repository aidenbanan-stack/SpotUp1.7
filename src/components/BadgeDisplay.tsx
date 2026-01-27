import { Badge as BadgeType, AVAILABLE_BADGES } from '@/types';
import { cn } from '@/lib/utils';

interface BadgeDisplayProps {
  badges: BadgeType[];
  showAll?: boolean;
  maxDisplay?: number;
  className?: string;
}

export function BadgeDisplay({ 
  badges, 
  showAll = false, 
  maxDisplay = 6,
  className 
}: BadgeDisplayProps) {
  const displayBadges = showAll ? AVAILABLE_BADGES : badges;
  const visibleBadges = displayBadges.slice(0, maxDisplay);
  const remainingCount = displayBadges.length - maxDisplay;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {visibleBadges.map((badge) => {
        const isEarned = badges.some(b => b.id === badge.id);
        return (
          <div
            key={badge.id}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all',
              isEarned 
                ? 'bg-primary/20 border border-primary/40 text-foreground' 
                : 'bg-muted/50 border border-border/50 text-muted-foreground opacity-50'
            )}
            title={`${badge.name}: ${badge.description}`}
          >
            <span className="text-base">{badge.icon}</span>
            <span className="font-medium">{badge.name}</span>
          </div>
        );
      })}
      {remainingCount > 0 && (
        <div className="flex items-center px-3 py-1.5 rounded-full bg-secondary text-sm text-muted-foreground">
          +{remainingCount} more
        </div>
      )}
    </div>
  );
}

interface SingleBadgeProps {
  badge: BadgeType;
  size?: 'sm' | 'md' | 'lg';
}

export function SingleBadge({ badge, size = 'md' }: SingleBadgeProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };

  return (
    <div 
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30',
        sizeClasses[size]
      )}
      title={`${badge.name}: ${badge.description}`}
    >
      {badge.icon}
    </div>
  );
}
