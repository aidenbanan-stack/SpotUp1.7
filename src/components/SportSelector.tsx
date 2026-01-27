import { Sport, SPORTS } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface SportSelectorProps {
  selected: Sport | 'all';
  onChange: (sport: Sport | 'all') => void;
  showAll?: boolean;
  className?: string;
}

export function SportSelector({ selected, onChange, showAll = true, className }: SportSelectorProps) {
  return (
    <ScrollArea className={cn('w-full', className)}>
      <div className="flex gap-2 pb-2">
        {showAll && (
          <button
            onClick={() => onChange('all')}
            className={cn(
              'sport-chip flex-shrink-0 flex items-center gap-2 border border-border/50',
              selected === 'all' ? 'sport-chip-active' : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
            )}
          >
            <span>🎯</span>
            <span>All Sports</span>
          </button>
        )}
        {SPORTS.map((sport) => (
          <button
            key={sport.id}
            onClick={() => onChange(sport.id)}
            className={cn(
              'sport-chip flex-shrink-0 flex items-center gap-2 border border-border/50',
              selected === sport.id ? 'sport-chip-active' : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
            )}
          >
            <span>{sport.icon}</span>
            <span>{sport.name}</span>
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

interface SportGridProps {
  selected: Sport[];
  onChange: (sports: Sport[]) => void;
  single?: boolean;
  className?: string;
}

export function SportGrid({ selected, onChange, single = false, className }: SportGridProps) {
  const handleToggle = (sport: Sport) => {
    if (single) {
      onChange([sport]);
    } else {
      if (selected.includes(sport)) {
        onChange(selected.filter(s => s !== sport));
      } else {
        onChange([...selected, sport]);
      }
    }
  };

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {SPORTS.map((sport) => (
        <button
          key={sport.id}
          onClick={() => handleToggle(sport.id)}
          className={cn(
            'glass-card p-4 flex flex-col items-center gap-2 transition-all duration-200',
            selected.includes(sport.id) 
              ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
              : 'border-border/50 hover:border-border'
          )}
        >
          <span className="text-3xl">{sport.icon}</span>
          <span className="text-sm font-medium">{sport.name}</span>
        </button>
      ))}
    </div>
  );
}
