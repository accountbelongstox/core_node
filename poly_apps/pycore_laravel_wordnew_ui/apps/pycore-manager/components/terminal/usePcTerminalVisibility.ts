import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SETTLE_MS = 120;
const LEAD_MARGIN = '45%';

type ScrollDirection = 'down' | 'up';

export interface PcTerminalVisibility {
  /** Window ids on screen plus the band about to enter in the scroll direction. */
  visible: ReadonlySet<string>;
  /** Stable ref callback registering a window's card / tile element. */
  refFor: (windowId: string) => (element: Element | null) => void;
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

/**
 * Which terminal cards are on screen. The observed band reaches 45% of the viewport ahead in the
 * scroll direction, so a card is ready as it scrolls in and nothing farther away is asked for.
 */
export function usePcTerminalVisibility(): PcTerminalVisibility {
  const elements = useRef(new Map<string, Element>());
  const idOf = useRef(new WeakMap<Element, string>());
  const refs = useRef(new Map<string, (element: Element | null) => void>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const intersecting = useRef(new Set<string>());
  const [direction, setDirection] = useState<ScrollDirection>('down');
  const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set());
  const timer = useRef<number | null>(null);

  const settle = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const next = new Set(intersecting.current);
      setVisible((previous) => (sameSet(previous, next) ? previous : next));
    }, SETTLE_MS);
  }, []);

  useEffect(() => {
    const positions = new WeakMap<object, number>();
    let lastWindowY = window.scrollY;
    const onScroll = (event: Event): void => {
      const target = event.target;
      const element = target instanceof Element ? target : null;
      const position = element ? element.scrollTop : window.scrollY;
      const key = element ?? window;
      const previous = positions.get(key) ?? (element ? 0 : lastWindowY);
      positions.set(key, position);
      lastWindowY = element ? lastWindowY : position;
      if (position === previous) return;
      setDirection(position > previous ? 'down' : 'up');
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const margin = direction === 'down' ? `0px 0px ${LEAD_MARGIN} 0px` : `${LEAD_MARGIN} 0px 0px 0px`;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = idOf.current.get(entry.target);
        if (!id) return;
        if (entry.isIntersecting) intersecting.current.add(id);
        else intersecting.current.delete(id);
      });
      settle();
    }, { rootMargin: margin });
    observerRef.current = observer;
    elements.current.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      observerRef.current = null;
      intersecting.current.clear();
    };
  }, [direction, settle]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const refFor = useCallback((windowId: string) => {
    const known = refs.current.get(windowId);
    if (known) return known;
    const callback = (element: Element | null): void => {
      const previous = elements.current.get(windowId);
      if (previous && previous !== element) {
        observerRef.current?.unobserve(previous);
        intersecting.current.delete(windowId);
        elements.current.delete(windowId);
        settle();
      }
      if (!element) return;
      elements.current.set(windowId, element);
      idOf.current.set(element, windowId);
      observerRef.current?.observe(element);
    };
    refs.current.set(windowId, callback);
    return callback;
  }, [settle]);

  return useMemo(() => ({ visible, refFor }), [visible, refFor]);
}
