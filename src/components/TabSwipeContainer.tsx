import { type ReactNode, type TouchEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAdjacentBottomTab, isBottomTabPath } from '@/lib/tabNavigation';
import { cn } from '@/lib/utils';

type SwipeDirection = -1 | 1;

type Props = {
  children: ReactNode;
};

const SWIPE_THRESHOLD_PX = 72;
const EDGE_RESISTANCE = 0.35;
const EXIT_DURATION_MS = 170;

function shouldIgnoreSwipe(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, [role="button"], [role="dialog"], [data-no-page-swipe="true"], .gm-style, .mapboxgl-map'
    )
  );
}

export function TabSwipeContainer({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const isTabPage = isBottomTabPath(location.pathname);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const axisLockRef = useRef<'x' | 'y' | null>(null);
  const ignoreSwipeRef = useRef(false);
  const swipeIntentRef = useRef<SwipeDirection | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [entryDirection, setEntryDirection] = useState<SwipeDirection | 0>(0);
  const [isSettled, setIsSettled] = useState(true);

  const canSwipe = useMemo(() => isTabPage, [isTabPage]);

  useLayoutEffect(() => {
    const direction = Number((location.state as { tabSwipeDirection?: number } | null)?.tabSwipeDirection);
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;

    if (direction === -1 || direction === 1) {
      setEntryDirection(direction as SwipeDirection);
      setIsSettled(false);
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setEntryDirection(0);
          setIsSettled(true);
        });
      });
    } else {
      setEntryDirection(0);
      setIsSettled(true);
    }

    return () => {
      if (firstFrame !== null) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
    };
  }, [location.key, location.state]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const resetGesture = () => {
    startXRef.current = null;
    startYRef.current = null;
    axisLockRef.current = null;
    ignoreSwipeRef.current = false;
    swipeIntentRef.current = null;
    setDragX(0);
    setIsAnimatingOut(false);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!canSwipe || event.touches.length !== 1) return;
    ignoreSwipeRef.current = shouldIgnoreSwipe(event.target);
    if (ignoreSwipeRef.current) return;
    const touch = event.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    axisLockRef.current = null;
    swipeIntentRef.current = null;
    setIsAnimatingOut(false);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!canSwipe || ignoreSwipeRef.current || startXRef.current === null || startYRef.current === null || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;

    if (!axisLockRef.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      axisLockRef.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    }

    if (axisLockRef.current !== 'x') return;

    const rawDirection: SwipeDirection = dx < 0 ? 1 : -1;
    const nextPath = getAdjacentBottomTab(location.pathname, rawDirection);
    const constrainedDx = nextPath ? dx : dx * EDGE_RESISTANCE;

    swipeIntentRef.current = nextPath ? rawDirection : null;
    setDragX(constrainedDx);
  };

  const handleTouchEnd = () => {
    if (!canSwipe || ignoreSwipeRef.current || startXRef.current === null) {
      resetGesture();
      return;
    }

    const direction = swipeIntentRef.current;
    const nextPath = direction ? getAdjacentBottomTab(location.pathname, direction) : null;

    if (direction && nextPath && Math.abs(dragX) >= SWIPE_THRESHOLD_PX) {
      setIsAnimatingOut(true);
      setDragX(direction === 1 ? -window.innerWidth : window.innerWidth);
      exitTimerRef.current = window.setTimeout(() => {
        navigate(nextPath, { state: { tabSwipeDirection: direction } });
      }, EXIT_DURATION_MS);
      return;
    }

    resetGesture();
  };

  const handleTouchCancel = () => {
    resetGesture();
  };

  const style = canSwipe
    ? {
        transform: `translate3d(${dragX + entryDirection * (isSettled ? 0 : window.innerWidth * 0.18)}px, 0, 0)`,
        transition: isAnimatingOut
          ? `transform ${EXIT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
          : startXRef.current !== null && axisLockRef.current === 'x'
            ? 'none'
            : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        touchAction: 'pan-y',
      }
    : undefined;

  return (
    <div
      className={cn('min-h-screen', canSwipe && 'will-change-transform')}
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      data-no-page-swipe={canSwipe ? undefined : 'true'}
    >
      {children}
    </div>
  );
}
