import { useEffect } from 'react';
import { pycoreEventBus } from '../../../core/api-libs/pycore/PycoreEventBus';

type Options = {
  fallbackMs?: number;
  enabled?: boolean;
};

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
    const unsubs = topics.map((topic) =>
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
