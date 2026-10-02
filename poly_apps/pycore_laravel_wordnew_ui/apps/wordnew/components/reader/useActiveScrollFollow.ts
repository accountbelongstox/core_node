import { useCallback, useEffect, useRef } from 'react';

const USER_SCROLL_PAUSE_MS = 2500;
const ACTIVE_ROW_TOP_FRACTION = 3;

/** Scroll `el` so it sits about a third from the top of `container` (rect based, any offsetParent). */
export function scrollRowToUpperMiddle(el: HTMLElement, container: HTMLElement): void {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const top = elRect.top - containerRect.top + container.scrollTop - container.clientHeight / ACTIVE_ROW_TOP_FRACTION;
  container.scrollTo({ top, behavior: 'smooth' });
}

/**
 * Keeps the playing row in the upper-middle of a scroll container. A manual scroll pauses
 * following for a short while; a user-picked row (`markUserPick`) resumes it immediately.
 */
export function useActiveScrollFollow(
  scrollRef: React.RefObject<HTMLElement | null>,
  activeDomId: string | null,
  retriggerKey: unknown,
): { onScrollUser: () => void; markUserPick: () => void } {
  const pausedUntil = useRef(0);
  const userPicked = useRef(false);

  useEffect(() => {
    if (!activeDomId) return;
    if (!userPicked.current && Date.now() < pausedUntil.current) return;
    const container = scrollRef.current;
    const el = container?.querySelector(`[id="${activeDomId}"]`) as HTMLElement | null;
    if (el && container) scrollRowToUpperMiddle(el, container);
    userPicked.current = false;
  }, [activeDomId, retriggerKey, scrollRef]);

  const onScrollUser = useCallback(() => {
    pausedUntil.current = Date.now() + USER_SCROLL_PAUSE_MS;
  }, []);

  const markUserPick = useCallback(() => {
    userPicked.current = true;
    pausedUntil.current = 0;
  }, []);

  return { onScrollUser, markUserPick };
}
