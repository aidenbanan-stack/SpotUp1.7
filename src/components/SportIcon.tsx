import { Sport, SPORTS } from '@/types';
import { cn } from '@/lib/utils';

interface SportIconProps {
  sport: Sport;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

const sportColorClasses: Record<Sport, string> = {
  basketball: 'bg-sport-basketball/20 border-sport-basketball/30',
  soccer: 'bg-sport-soccer/20 border-sport-soccer/30',
  pickleball: 'bg-sport-pickleball/20 border-sport-pickleball/30',
  football: 'bg-sport-football/20 border-sport-football/30',
  baseball: 'bg-sport-baseball/20 border-sport-baseball/30',
  volleyball: 'bg-sport-volleyball/20 border-sport-volleyball/30',
  frisbee: 'bg-sport-frisbee/20 border-sport-frisbee/30',
};

export function SportIcon({ sport, size = 'md', showLabel = false, className }: SportIconProps) {
  const sportData = SPORTS.find(s => s.id === sport);
  
  if (!sportData) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span 
        className={cn(
          'flex items-center justify-center rounded-xl border',
          sizeClasses[size],
          sportColorClasses[sport],
          size === 'sm' && 'w-8 h-8',
          size === 'md' && 'w-10 h-10',
          size === 'lg' && 'w-12 h-12',
          size === 'xl' && 'w-14 h-14'
        )}
      >
        {sportData.icon}
      </span>
      {showLabel && (
        <span className="font-medium text-foreground">{sportData.name}</span>
      )}
    </div>
  );
}

export function SportBadge({ sport, className }: { sport: Sport; className?: string }) {
  const sportData = SPORTS.find(s => s.id === sport);
  
  if (!sportData) return null;

  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        sportColorClasses[sport],
        className
      )}
    >
      <span>{sportData.icon}</span>
      <span>{sportData.name}</span>
    </span>
  );
}
