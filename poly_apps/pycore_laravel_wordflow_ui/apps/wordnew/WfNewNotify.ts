/**
 * WfNewNotify — the /wordnew NOTIFICATION CENTER (one reusable store).
 *
 * Replaces the per-component toast state that WfNewApp owned and prop-drilled as
 * `addToast` into 9 files. Now there is ONE source of truth: any module calls
 * `wfNewNotify.push(text, type)` (no prop-drilling), and the renderer subscribes
 * via `useWfNewToasts()` — the project's useSyncExternalStore store pattern
 * (mirrors core/logstore + core/notify).
 *
 * Built-in DEDUP: identical messages fired within a short window collapse to one
 * (e.g. a burst of 401s across concurrent requests no longer stacks N copies of
 * "Session expired"); this complements the one-shot guard in WfNewApiHttp.
 */

import { useSyncExternalStore } from 'react';

export type WfNewToastType = 'success' | 'info' | 'warning' | 'star';

export interface WfNewToastItem {
  id: string;
  text: string;
  type: WfNewToastType;
}

const MAX_VISIBLE = 4;
const DEDUP_WINDOW_MS = 1500;

class WfNewNotifyStore {
  private toasts: WfNewToastItem[] = [];
  private listeners = new Set<() => void>();
  private seq = 0;
  private lastKey = '';
  private lastAt = 0;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  /** Stable reference between changes (required by useSyncExternalStore). */
  getSnapshot = (): WfNewToastItem[] => this.toasts;

  private emit(): void {
    for (const l of this.listeners) l();
  }

  /** Show a toast. Identical text+type within DEDUP_WINDOW_MS is collapsed. */
  push = (text: string, type: WfNewToastType = 'info'): void => {
    if (!text) return;
    const now = Date.now();
    const key = `${type}|${text}`;
    if (key === this.lastKey && now - this.lastAt < DEDUP_WINDOW_MS) return;
    this.lastKey = key;
    this.lastAt = now;
    const id = `t-${now}-${this.seq++}`;
    // New array ref → subscribers re-render; cap the visible stack.
    this.toasts = [...this.toasts, { id, text, type }].slice(-MAX_VISIBLE);
    this.emit();
  };

  dismiss = (id: string): void => {
    const next = this.toasts.filter((t) => t.id !== id);
    if (next.length !== this.toasts.length) {
      this.toasts = next;
      this.emit();
    }
  };

  clear = (): void => {
    if (this.toasts.length) {
      this.toasts = [];
      this.emit();
    }
  };
}

/** Global singleton — the one notification center for /wordnew. */
export const wfNewNotify = new WfNewNotifyStore();

/** Reactive hook for the toast renderer. */
export function useWfNewToasts(): WfNewToastItem[] {
  return useSyncExternalStore(wfNewNotify.subscribe, wfNewNotify.getSnapshot, wfNewNotify.getSnapshot);
}
