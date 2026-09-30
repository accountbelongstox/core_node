/** Event-driven refresh on pycore topics with optional slow fallback polling. */
import { useEffect, useRef } from 'react';
import { pycoreEventBus } from './PycoreEventBus';
import { PYCORE_BROWSER_EVENTS } from './PycoreNetwork';
import { logWarn } from '../../logstore/logStore';

type Options = {
  fallbackMs?: number;
  enabled?: boolean;
  debounceMs?: number;
  minIntervalMs?: number;
};

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MIN_INTERVAL_MS = 1_000;

const HTTP_RECONCILE_TOPICS = [
  PYCORE_BROWSER_EVENTS.httpEventServerRestarted,
  PYCORE_BROWSER_EVENTS.httpEventReplayLost,
];

export function usePycoreTopicRefresh(
  topics: string[],
  refresh: () => void | Promise<void>,
  options: Options = {},
) {
  const {
    fallbackMs = 0,
    enabled = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
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
          logWarn('usePycoreTopicRefresh', `refresh failed: ${error instanceof Error ? error.message : String(error)}`);
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
