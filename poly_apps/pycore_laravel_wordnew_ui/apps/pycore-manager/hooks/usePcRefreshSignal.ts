import { useEffect, useRef } from 'react';

/**
 * Runs `refresh` whenever the page-level refresh signal changes. The initial
 * value never fires: the view loads itself on mount.
 */
export function usePcRefreshSignal(signal: number | undefined, refresh: () => void | Promise<void>): void {
  const first = useRef(true);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (signal === undefined) return;
    void refreshRef.current();
  }, [signal]);
}
