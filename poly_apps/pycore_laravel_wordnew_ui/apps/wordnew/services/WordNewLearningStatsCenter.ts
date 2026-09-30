/* Wf learning-stats center — the ONE owner of GET /user/statistics. Home
 * dashboard, Settings profile card and the Profile page all read this store;
 * no surface fetches statistics itself. Refreshes (debounced) on any study
 * activity event and resets on logout / auth expiry. */

import { useSyncExternalStore } from 'react';
import { wfNewApi } from '../api';
import type { WfNewStatistics } from '../api';
import { wordNewEventBus } from './WordNewEventBus';

const ACTIVITY_REFRESH_MS = 2500;

type Listener = () => void;

class WordNewLearningStatsCenterClass {
  private snapshot: WfNewStatistics | null = null;
  private listeners = new Set<Listener>();
  private inflight: Promise<WfNewStatistics | null> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const onActivity = () => this.scheduleRefresh();
    wordNewEventBus.on('learning-stats-updated', onActivity);
    wordNewEventBus.on('recitation-updated', onActivity);
    wfNewApi.onAuthExpired(() => this.reset());
  }

  get(): WfNewStatistics | null {
    return this.snapshot;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Fetch now (deduplicated); logged-out resolves to null. */
  refresh(): Promise<WfNewStatistics | null> {
    if (!wfNewApi.isAuthenticated()) {
      this.set(null);
      return Promise.resolve(null);
    }
    if (this.inflight) return this.inflight;
    this.inflight = wfNewApi.getUserStatistics()
      .then((fresh) => {
        if (fresh) this.set(fresh);
        return this.snapshot;
      })
      .catch(() => this.snapshot)
      .finally(() => { this.inflight = null; });
    return this.inflight;
  }

  scheduleRefresh(delayMs: number = ACTIVITY_REFRESH_MS): void {
    if (!wfNewApi.isAuthenticated()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, delayMs);
  }

  reset(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.set(null);
  }

  private set(next: WfNewStatistics | null): void {
    if (next === this.snapshot) return;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}

export const wordNewLearningStatsCenter = new WordNewLearningStatsCenterClass();

export function useWordNewLearningStats(): WfNewStatistics | null {
  return useSyncExternalStore(
    wordNewLearningStatsCenter.subscribe,
    () => wordNewLearningStatsCenter.get(),
    () => null,
  );
}
