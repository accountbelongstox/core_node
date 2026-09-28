import { useEffect, useRef, type RefObject } from 'react';

/** Calls `onReach` whenever the sentinel element scrolls within `rootMargin` of
 * the viewport while `enabled`; the latest callback is always used. A changed
 * `rearmKey` re-observes, so a sentinel still in view fires again after a load. */
export function useWfNewLoadMoreSentinel(
  sentinelRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onReach: () => void,
  rearmKey: string | number = '',
  rootMargin = '120px',
): void {
  const onReachRef = useRef(onReach);
  useEffect(() => { onReachRef.current = onReach; }, [onReach]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onReachRef.current();
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef, enabled, rearmKey, rootMargin]);
}
