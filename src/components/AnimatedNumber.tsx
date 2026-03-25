import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  className?: string;
  durationMs?: number;
  format?: (value: number) => string;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedNumber({
  value,
  className,
  durationMs = 700,
  format = (v) => v.toLocaleString(),
}: Props) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [bump, setBump] = useState(false);
  const prevValueRef = useRef<number>(value);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      prevValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    const from = prevValueRef.current;
    const to = value;
    if (from === to) return;

    setBump(true);
    const bumpTimer = window.setTimeout(() => setBump(false), Math.min(durationMs, 650));

    const start = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeOutCubic(progress);
      const next = Math.round(from + (to - from) * eased);
      setDisplayValue(next);

      if (progress < 1) {
        raf = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(to);
      }
    };

    raf = window.requestAnimationFrame(step);
    prevValueRef.current = to;

    return () => {
      window.clearTimeout(bumpTimer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [durationMs, value]);

  return (
    <span
      className={cn(
        'inline-block tabular-nums transition-all duration-500',
        bump && 'scale-110 text-primary drop-shadow-[0_0_14px_rgba(255,59,59,0.35)]',
        className
      )}
    >
      {format(displayValue)}
    </span>
  );
}
