import { useEffect, useRef } from 'react';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { PYCORE_BROWSER_EVENTS } from '@/apps/pycore-manager/api';

type Options = {
  fallbackMs?: number;
  enabled?: boolean;
  debounceMs?: number;
  minIntervalMs?: number;
};

const HTTP_RECONCILE_TOPICS = [
  PYCORE_BROWSER_EVENTS.httpEventServerRestarted,
  PYCORE_BROWSER_EVENTS.httpEventReplayLost,
];

/**
 * Event-driven refresh with optional slow fallback polling (FIX V9).
 */
export function useTopicDrivenRefresh(
  topics: string[],
  refresh: () => void | Promise<void>,
  options: Options = {},
) {
  const {
    fallbackMs = 0,
    enabled = true,
    debounceMs = 250,
    minIntervalMs = 1_000,
  } = options;
  const topicKey = topics.join('|');
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending = false;
    let lastRunAt = 0;
    let refreshTimer: number | undefined;
    let refreshFlight: Promise<void> | null = null;
    function execute(): void {
      if (!active) return;
      if (refreshFlight) {
        pending = true;
        return;
      }
      lastRunAt = Date.now();
      refreshFlight = Promise.resolve()
        .then(() => refreshRef.current())
        .catch((error: unknown) => {
          console.error('[useTopicDrivenRefresh] refresh failed', error);
        })
        .finally(() => {
          refreshFlight = null;
          if (!active || !pending) return;
          pending = false;
          schedule();
        });
    }
    function schedule(): void {
      if (!active) return;
      pending = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      const elapsed = Date.now() - lastRunAt;
      const delay = Math.max(debounceMs, minIntervalMs - elapsed);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        execute();
      }, delay);
    }
    const subscribedTopics = Array.from(new Set([...topics, ...HTTP_RECONCILE_TOPICS]));
    const unsubs = subscribedTopics.map((topic) =>
      pycoreEventBus.subscribe(topic, () => {
        schedule();
      }),
    );
    let intervalId: number | undefined;
    if (fallbackMs > 0) {
      intervalId = window.setInterval(() => {
        schedule();
      }, fallbackMs);
    }
    return () => {
      active = false;
      unsubs.forEach((unsub) => unsub());
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [topicKey, enabled, fallbackMs, debounceMs, minIntervalMs]);
}
