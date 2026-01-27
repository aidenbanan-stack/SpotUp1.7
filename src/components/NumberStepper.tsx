import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function NumberStepper({ 
  value, 
  onChange, 
  min = 2, 
  max = 30, 
  step = 1,
  className 
}: NumberStepperProps) {
  const handleDecrement = () => {
    if (value - step >= min) {
      onChange(value - step);
    }
  };

  const handleIncrement = () => {
    if (value + step <= max) {
      onChange(value + step);
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleDecrement}
        disabled={value <= min}
        className="h-10 w-10 rounded-xl bg-secondary border-border"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <div className="w-16 text-center">
        <span className="text-xl font-bold">{value}</span>
        <span className="text-sm text-muted-foreground ml-1">players</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleIncrement}
        disabled={value >= max}
        className="h-10 w-10 rounded-xl bg-secondary border-border"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
