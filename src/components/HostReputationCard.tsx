import { HostReputation } from '@/types';
import { Star, CheckCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HostReputationCardProps {
  reputation: HostReputation;
  compact?: boolean;
  className?: string;
}

export function HostReputationCard({ reputation, compact = false, className }: HostReputationCardProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(reputation.rating));

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {reputation.isTrustedHost && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Trusted
          </span>
        )}
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 fill-primary text-primary" />
          <span className="text-sm font-medium">{reputation.rating.toFixed(1)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Host Reputation
        </h4>
        {reputation.isTrustedHost && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Trusted Host
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-0.5 mb-1">
            {stars.map((filled, i) => (
              <Star 
                key={i} 
                className={cn(
                  'w-4 h-4',
                  filled ? 'fill-primary text-primary' : 'text-muted-foreground'
                )} 
              />
            ))}
          </div>
          <p className="text-lg font-bold text-foreground">{reputation.rating.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Rating</p>
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{reputation.completionRate}%</p>
          <p className="text-xs text-muted-foreground">Completion</p>
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{reputation.totalHosted}</p>
          <p className="text-xs text-muted-foreground">Hosted</p>
        </div>
      </div>
    </div>
  );
}
