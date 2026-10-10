import { useEffect, useRef, useState } from 'react';
import type { MobileRefreshHandler } from './mobileChrome';

export const PULL_THRESHOLD_PX = 64;
const PULL_MAX_PX = 110;
const PULL_RESISTANCE = 0.5;

export interface PullToRefreshState {
  pull: number;
  refreshing: boolean;
  ready: boolean;
}

/** Touch pull-down gesture on a scroll container; calls the current handler when released past the threshold. */
export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  handlerRef: React.MutableRefObject<MobileRefreshHandler | null>,
): PullToRefreshState {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    let startY: number | null = null;

    const setPullValue = (value: number): void => {
      pullRef.current = value;
      setPull(value);
    };
    const onStart = (event: TouchEvent): void => {
      startY = element.scrollTop <= 0 && handlerRef.current && !refreshingRef.current ? event.touches[0].clientY : null;
    };
    const onMove = (event: TouchEvent): void => {
      if (startY === null) return;
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0 || element.scrollTop > 0) {
        if (pullRef.current !== 0) setPullValue(0);
        return;
      }
      if (event.cancelable) event.preventDefault();
      setPullValue(Math.min(PULL_MAX_PX, delta * PULL_RESISTANCE));
    };
    const onEnd = async (): Promise<void> => {
      if (startY === null) return;
      startY = null;
      const handler = handlerRef.current;
      if (pullRef.current >= PULL_THRESHOLD_PX && handler) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullValue(PULL_THRESHOLD_PX);
        try {
          await handler();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullValue(0);
        }
        return;
      }
      setPullValue(0);
    };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: false });
    element.addEventListener('touchend', onEnd);
    element.addEventListener('touchcancel', onEnd);
    return () => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', onEnd);
    };
  }, [scrollRef, handlerRef]);

  return { pull, refreshing, ready: pull >= PULL_THRESHOLD_PX };
}
