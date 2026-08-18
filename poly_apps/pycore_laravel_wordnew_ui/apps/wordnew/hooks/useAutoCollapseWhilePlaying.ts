import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_GRACE_MS = 3000;

/** Collapses a panel shortly after playback (re)starts. Manually expanding the
 * panel keeps it open; any interaction with the open panel re-arms the grace
 * timer, and every play start collapses it again. */
export function useAutoCollapseWhilePlaying(
  playing: boolean,
  graceMs = DEFAULT_GRACE_MS,
): { collapsed: boolean; toggle: () => void; noteInteraction: () => void } {
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCollapsed(true);
    }, graceMs);
  }, [clearTimer, graceMs]);

  useEffect(() => {
    if (playing) scheduleCollapse();
    return clearTimer;
  }, [playing, scheduleCollapse, clearTimer]);

  const toggle = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      if (playing) scheduleCollapse();
    } else {
      setCollapsed(true);
      clearTimer();
    }
  }, [collapsed, playing, scheduleCollapse, clearTimer]);

  const noteInteraction = useCallback(() => {
    if (playing && !collapsed) scheduleCollapse();
  }, [playing, collapsed, scheduleCollapse]);

  return { collapsed, toggle, noteInteraction };
}
