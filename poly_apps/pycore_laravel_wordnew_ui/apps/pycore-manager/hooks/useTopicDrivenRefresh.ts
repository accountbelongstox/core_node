import { useEffect } from 'react';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { PYCORE_BROWSER_EVENTS } from '@/apps/pycore-manager/api';

type Options = {
  fallbackMs?: number;
  enabled?: boolean;
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
  const { fallbackMs = 0, enabled = true } = options;
  const topicKey = topics.join('|');

  useEffect(() => {
    if (!enabled) return;
    const subscribedTopics = Array.from(new Set([...topics, ...HTTP_RECONCILE_TOPICS]));
    const unsubs = subscribedTopics.map((topic) =>
      pycoreEventBus.subscribe(topic, () => {
        void refresh();
      }),
    );
    let intervalId: number | undefined;
    if (fallbackMs > 0) {
      intervalId = window.setInterval(() => {
        void refresh();
      }, fallbackMs);
    }
    return () => {
      unsubs.forEach((unsub) => unsub());
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [topicKey, refresh, enabled, fallbackMs]);
}
