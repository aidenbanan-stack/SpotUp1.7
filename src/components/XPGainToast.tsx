import { Gift, Sparkles, Zap } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

type ShowXpToastArgs = {
  gained: number;
  totalXp: number;
  title?: string;
  description?: string;
  icon?: 'daily' | 'generic';
};

function XPGainToastCard({
  gained,
  totalXp,
  title,
  description,
  icon = 'generic',
}: Required<ShowXpToastArgs>) {
  return (
    <div className="pointer-events-auto w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-primary/25 bg-background/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300">
      <div className="relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10" />
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-accent/10 blur-2xl" />

        <div className="relative flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary animate-pulse">
            {icon === 'daily' ? <Gift className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>

            <div className="mt-3 flex items-end justify-between gap-3 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">XP gained</div>
                <div className="text-xl font-bold text-primary">+{gained}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total XP</div>
                <div className="text-base font-semibold text-foreground">{totalXp.toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-full origin-left animate-[xp-toast-fill_4.5s_linear_forwards] rounded-full bg-gradient-to-r from-primary via-primary to-accent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function showXpToast(args: ShowXpToastArgs) {
  toast.custom(
    () => (
      <XPGainToastCard
        gained={args.gained}
        totalXp={args.totalXp}
        title={args.title ?? 'XP Earned'}
        description={args.description ?? 'Nice. Your progress just moved up.'}
        icon={args.icon ?? 'generic'}
      />
    ),
    { duration: 4500 }
  );
}

export function showDailyLoginToast(gained: number, totalXp: number) {
  showXpToast({
    gained,
    totalXp,
    title: 'Daily login bonus',
    description: 'You kept your reliability above 90% and earned your daily 5 XP bonus.',
    icon: 'daily',
  });
}
