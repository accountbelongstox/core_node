/* [v4.1-Iris] Wf recitation center — the daily-recitation (每日背诵) domain
 * layer over wordflowApi's /recitation/* surface. Owns:
 *   - EVENT BATCHING: recordAction(word, action) accumulates events and
 *     flushes them as ONE POST /recitation/log — debounced ~2s, immediately at
 *     10 buffered events, and on page-leave (window 'pagehide' + the page's
 *     unmount flushNow()). Every flush carries a FRESH batch_id so an offline
 *     replay of the persisted payload is idempotent server-side.
 *   - LIVE TODAY-STATE: the backend's `today` counters from each flush are
 *     kept and broadcast as 'recitation-updated' via wfEventBus so headers /
 *     home cards live-update without refetching.
 *   - QueuedError handling: a flush persisted offline is treated as LOCALLY
 *     COUNTED — today-progress is bumped optimistically (deduped by a local
 *     per-day unique-word set), the event fires with { pending: true }, and
 *     the centralized queued-offline toast (WordflowApi) is the only user
 *     feedback. Real failures re-queue the events for the next flush.
 *   - Read passthroughs: getTodayPlan / getSummary / getStreak. */

import {
  wordflowApi,
  type WfRecitationAction,
  type WfRecitationLogWord,
  type WfRecitationLogResult,
  type WfRecitationStreak,
  type WfRecitationSummary,
  type WfRecitationToday,
  type WfRecitationTodayPlan,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { isQueuedError } from '../../../core/api-libs/base';
import { wfEventBus } from './WfEventBus';

/** Debounce window between the last recordAction() and the flush. */
const FLUSH_DEBOUNCE_MS = 2000;
/** Buffered-event count that triggers an immediate flush. */
const FLUSH_MAX_BATCH = 10;

/** Fresh idempotency key for one flush (crypto.randomUUID with fallback). */
const newBatchId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* crypto unavailable — fall through */
  }
  return `wf-recite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/** Local calendar date (YYYY-MM-DD) — used to reset the per-day unique set. */
const localDateKey = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/** Payload of the 'recitation-updated' wfEventBus event. */
export interface WfRecitationUpdate {
  today: WfRecitationToday;
  date?: string;
  /** True when the underlying flush was queued offline (locally counted). */
  pending?: boolean;
}

class WfRecitationCenterClass {
  /** Buffered, not-yet-flushed log events (order preserved). */
  private pending: WfRecitationLogWord[] = [];
  /** Learning language of the buffered events (last writer wins). */
  private pendingLanguage: string | undefined;
  /** One session id per center lifetime (page session) for the backend logs. */
  private readonly sessionId: string = newBatchId();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Serializes flushes — a flush never overlaps a previous in-flight one. */
  private flushChain: Promise<void> = Promise.resolve();
  /** Last known today-counters (server-confirmed or optimistic). */
  private lastToday: WfRecitationToday | null = null;
  /** True while at least one flush sits in the offline queue unsynced. */
  private pendingSync = false;
  /** Local per-day unique-word set backing the optimistic unique count. */
  private localUniqueWords = new Set<string>();
  private localUniqueDate = localDateKey();

  constructor() {
    // Page-leave flush: 'pagehide' fires on tab close / navigation away. The
    // recite page ALSO calls flushNow() on unmount for in-app route changes.
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        void this.flushNow();
      });
    }
  }

  // ---- Live today-state ----

  /** Last known today-counters (null before the first plan load / flush). */
  getToday(): WfRecitationToday | null {
    return this.lastToday;
  }

  /** True when offline-queued recitation events still await replay. */
  hasPendingSync(): boolean {
    return this.pendingSync;
  }

  /** Subscribe to 'recitation-updated'. Returns an unsubscribe function. */
  subscribe(cb: (update: WfRecitationUpdate) => void): () => void {
    return wfEventBus.on('recitation-updated', (payload) => cb(payload as WfRecitationUpdate));
  }

  // ---- Event batching ----

  /**
   * Record one recitation event. Buffered and flushed as a batch (debounced
   * ~2s, immediate at 10 events, and on page-leave). Never throws — flush
   * failures are handled internally (queued-offline → optimistic count,
   * real failure → re-queued for the next flush).
   */
  recordAction(word: string, action: WfRecitationAction, language?: string): void {
    const trimmed = (word || '').trim();
    if (!trimmed) return;
    this.rolloverLocalDay();
    this.pending.push({ word: trimmed, action });
    if (language) this.pendingLanguage = language;
    this.localUniqueWords.add(trimmed.toLowerCase());

    if (this.pending.length >= FLUSH_MAX_BATCH) {
      void this.flushNow();
      return;
    }
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flushNow();
    }, FLUSH_DEBOUNCE_MS);
  }

  /**
   * Flush the buffered events now (debounce cancelled). Serialized — safe to
   * call concurrently (unmount + pagehide + size trigger). Resolves once this
   * flush settled; never rejects.
   */
  flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushChain = this.flushChain
      .then(() => this.doFlush())
      .catch(() => {
        /* doFlush handles its own errors — keep the chain unbroken */
      });
    return this.flushChain;
  }

  private async doFlush(): Promise<void> {
    if (this.pending.length === 0) return;
    const words = this.pending.splice(0, this.pending.length);
    const language = this.pendingLanguage;

    try {
      const result: WfRecitationLogResult = await wordflowApi.recitationLog({
        words,
        language,
        session_id: this.sessionId,
        // ONE fresh batch_id per flush — the replay-idempotency key.
        batch_id: newBatchId(),
      });
      this.lastToday = result.today;
      this.pendingSync = false;
      wfEventBus.emit('recitation-updated', {
        today: result.today,
        date: result.date,
        pending: false,
      } satisfies WfRecitationUpdate);
    } catch (error) {
      if (isQueuedError(error)) {
        // The write IS persisted (offline queue) and will replay with the same
        // batch_id — count it locally and mark the state pending-sync. The
        // centralized queued-offline toast already fired in WordflowApi.
        const optimistic = this.optimisticToday(words.length);
        this.lastToday = optimistic;
        this.pendingSync = true;
        wfEventBus.emit('recitation-updated', {
          today: optimistic,
          pending: true,
        } satisfies WfRecitationUpdate);
        return;
      }
      // Real failure (auth / validation / server error): keep the events for
      // the next flush so a transient failure never silently drops progress.
      console.error('[WfRecitationCenter] log flush failed:', error);
      this.pending.unshift(...words);
    }
  }

  /** Optimistic today-counters for a queued-offline flush. */
  private optimisticToday(flushedActions: number): WfRecitationToday {
    this.rolloverLocalDay();
    const base = this.lastToday;
    const goal = base?.goal ?? 0;
    const uniqueWords = Math.max(base?.unique_words ?? 0, this.localUniqueWords.size);
    return {
      unique_words: uniqueWords,
      actions: (base?.actions ?? 0) + flushedActions,
      goal,
      goal_met: goal > 0 && uniqueWords >= goal,
    };
  }

  /** Reset the local unique-word set when the local calendar day changes. */
  private rolloverLocalDay(): void {
    const today = localDateKey();
    if (today !== this.localUniqueDate) {
      this.localUniqueDate = today;
      this.localUniqueWords.clear();
      this.lastToday = null;
      this.pendingSync = false;
    }
  }

  // ---- Reads ----

  /**
   * Today's plan (due + new words, done/goal counters). Uncached server-state
   * (see wordflowApi). Seeds the live today-counters from done_today/goal so
   * headers have a baseline before the first flush. Rethrows on failure.
   */
  async getTodayPlan(params: { language?: string; limit?: number } = {}): Promise<WfRecitationTodayPlan> {
    const plan = await wordflowApi.recitationTodayPlan(params);
    this.rolloverLocalDay();
    this.lastToday = {
      unique_words: Math.max(plan.done_today ?? 0, this.localUniqueWords.size),
      actions: this.lastToday?.actions ?? 0,
      goal: plan.goal ?? 0,
      goal_met: (plan.goal ?? 0) > 0 && (plan.done_today ?? 0) >= (plan.goal ?? 0),
    };
    return plan;
  }

  /** Per-day summary (defaults to today; ~60s TTL in the API layer). */
  async getSummary(date?: string): Promise<WfRecitationSummary> {
    return wordflowApi.recitationSummary(date);
  }

  /** Streak counters + last-35-days strip (~60s TTL in the API layer). */
  async getStreak(): Promise<WfRecitationStreak> {
    return wordflowApi.recitationStreak();
  }
}

export const wfRecitationCenter = new WfRecitationCenterClass();
