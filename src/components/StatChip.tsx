import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatChipProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  className?: string;
}

export function StatChip({ icon: Icon, label, value, className }: StatChipProps) {
  return (
    <div className={cn('stat-chip flex items-center gap-2', className)}>
      {Icon && <Icon className="w-4 h-4 text-primary" />}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}

interface StatRowProps {
  stats: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
  }>;
  className?: string;
}

export function StatRow({ stats, className }: StatRowProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {stats.map((stat, index) => (
        <StatChip key={index} {...stat} />
      ))}
    </div>
  );
}
