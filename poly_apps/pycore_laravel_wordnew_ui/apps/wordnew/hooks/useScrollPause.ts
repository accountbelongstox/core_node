import { useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_PAUSE_MS = 2000;

/** Tracks whether the user is actively scrolling. The flag stays true while
 * scroll events keep firing and clears shortly after scrolling stops. */
export function useScrollPause(): { isScrolling: boolean; onScroll: () => void } {
  const [isScrolling, setIsScrolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = useCallback(() => {
    setIsScrolling(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsScrolling(false);
    }, SCROLL_PAUSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { isScrolling, onScroll };
}
