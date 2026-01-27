import { ReliabilityStats } from '@/types';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReliabilityScoreProps {
  stats: ReliabilityStats;
  compact?: boolean;
  className?: string;
}

export function ReliabilityScore({ stats, compact = false, className }: ReliabilityScoreProps) {
  const scoreColor = stats.score >= 90 
    ? 'text-green-500' 
    : stats.score >= 70 
      ? 'text-yellow-500' 
      : 'text-red-500';

  const scoreLabel = stats.score >= 90 
    ? 'Excellent' 
    : stats.score >= 70 
      ? 'Good' 
      : 'Needs Improvement';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <CheckCircle className={cn('w-4 h-4', scoreColor)} />
        <span className={cn('font-bold', scoreColor)}>{stats.score}%</span>
      </div>
    );
  }

  return (
    <div className={cn('glass-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-foreground">Reliability Score</h4>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold', scoreColor)}>{stats.score}%</span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', 
            stats.score >= 90 ? 'bg-green-500/20 text-green-500' :
            stats.score >= 70 ? 'bg-yellow-500/20 text-yellow-500' :
            'bg-red-500/20 text-red-500'
          )}>
            {scoreLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-lg font-bold text-foreground">{stats.showUps}</p>
          <p className="text-xs text-muted-foreground">Show Ups</p>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
            <AlertCircle className="w-4 h-4" />
          </div>
          <p className="text-lg font-bold text-foreground">{stats.cancellations}</p>
          <p className="text-xs text-muted-foreground">Cancellations</p>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
            <XCircle className="w-4 h-4" />
          </div>
          <p className="text-lg font-bold text-foreground">{stats.noShows}</p>
          <p className="text-xs text-muted-foreground">No-Shows</p>
        </div>
      </div>
    </div>
  );
}
