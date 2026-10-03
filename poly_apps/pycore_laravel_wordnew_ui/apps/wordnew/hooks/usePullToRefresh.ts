import { useEffect, useRef, useState, type RefObject } from 'react';

export const PULL_REFRESH_THRESHOLD_PX = 64;
const PULL_REFRESH_MAX_PX = 96;
const PULL_RESISTANCE = 0.5;

/** True when the element and every scrollable ancestor (page included) sit at their top. */
function atScrollTop(element: HTMLElement): boolean {
  let node: HTMLElement | null = element;
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollTop > 0) return false;
    node = node.parentElement;
  }
  return (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;
}

/** Touch pull-down gesture on `ref`; awaits `onRefresh` while showing `pull` distance. */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown> | void,
  enabled = true,
): { pull: number; refreshing: boolean; ready: boolean } {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(false);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return undefined;
    let startY = 0;
    let armed = false;
    let distance = 0;

    const onStart = (event: TouchEvent) => {
      armed = !refreshingRef.current && event.touches.length === 1 && atScrollTop(element);
      startY = event.touches[0]?.clientY ?? 0;
      distance = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (!armed) return;
      const delta = (event.touches[0]?.clientY ?? 0) - startY;
      if (delta <= 0) {
        if (distance > 0) { distance = 0; setPull(0); }
        return;
      }
      if (!atScrollTop(element)) { armed = false; distance = 0; setPull(0); return; }
      distance = Math.min(PULL_REFRESH_MAX_PX, delta * PULL_RESISTANCE);
      if (event.cancelable) event.preventDefault();
      setPull(distance);
    };
    const onEnd = () => {
      if (!armed) return;
      armed = false;
      const trigger = distance >= PULL_REFRESH_THRESHOLD_PX;
      distance = 0;
      setPull(0);
      if (!trigger) return;
      refreshingRef.current = true;
      setRefreshing(true);
      void Promise.resolve(onRefreshRef.current()).finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
      });
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
  }, [ref, enabled]);

  return { pull, refreshing, ready: pull >= PULL_REFRESH_THRESHOLD_PX };
}
