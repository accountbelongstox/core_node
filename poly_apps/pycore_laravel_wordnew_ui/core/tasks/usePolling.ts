import { useEffect, useMemo, useRef } from 'react';
import { Poller, type PollerOptions } from './Poller';

/** React lifecycle wrapper around Poller; returns a wake() for event-driven refreshes. */
export function usePolling(
  task: () => void | Promise<void>,
  options: PollerOptions & { enabled?: boolean },
): { wake: () => void } {
  const {
    enabled = true,
    intervalMs,
    immediate,
    pauseWhenHidden,
    backoff,
    maxIntervalMs,
    wakeDebounceMs,
  } = options;
  const taskRef = useRef(task);
  taskRef.current = task;
  const poller = useMemo(
    () => new Poller(() => taskRef.current(), {
      intervalMs,
      immediate,
      pauseWhenHidden,
      backoff,
      maxIntervalMs,
      wakeDebounceMs,
    }),
    [intervalMs, immediate, pauseWhenHidden, backoff, maxIntervalMs, wakeDebounceMs],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    poller.start();
    return () => poller.stop();
  }, [poller, enabled]);

  return useMemo(() => ({ wake: () => poller.wake() }), [poller]);
}
