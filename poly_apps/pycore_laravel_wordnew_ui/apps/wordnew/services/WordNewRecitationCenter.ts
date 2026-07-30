/* [v4.1-Iris] Wf recitation center — the daily-recitation (每日背诵) domain
 * layer over wfNewApi's /recitation/* surface. Owns:
 *   - EVENT BATCHING: recordAction(word, action) accumulates events and
 *     flushes them as ONE POST /recitation/log — debounced ~2s, immediately at
 *     10 buffered events, and on page-leave (window 'pagehide' + the page's
 *     unmount flushNow()). Every flush carries a FRESH batch_id so an offline
 *     replay of the persisted payload is idempotent server-side.
 *   - LIVE TODAY-STATE: the backend's `today` counters from each flush are
 *     kept and broadcast as 'recitation-updated' via wordNewEventBus so headers /
 *     home cards live-update without refetching.
 *   - QueuedError handling: a flush persisted offline is treated as LOCALLY
 *     COUNTED — today-progress is bumped optimistically (deduped by a local
 *     per-day unique-word set), the event fires with { pending: true }, and
 *     the centralized queued-offline toast (wfNewApi transport) is the only user
 *     feedback. Real failures re-queue the events for the next flush.
 *   - Read passthroughs: getTodayPlan / getSummary / getStreak. */

import {
  wfNewApi,
  type WordNewRecitationAction,
  type WordNewRecitationLogWord,
  type WordNewRecitationLogResult,
  type WordNewRecitationStreak,
  type WordNewRecitationSummary,
  type WordNewRecitationToday,
  type WordNewRecitationTodayPlan,
} from '../api';
import { isQueuedError } from '../../../core/api-libs/base';
import { wordNewEventBus } from './WordNewEventBus';

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

/** Payload of the 'recitation-updated' wordNewEventBus event. */
export interface WordNewRecitationUpdate {
  today: WordNewRecitationToday;
  date?: string;
  /** True when the underlying flush was queued offline (locally counted). */
  pending?: boolean;
}

class WordNewRecitationCenterClass {
  /** Buffered, not-yet-flushed log events (order preserved). */
  private pending: WordNewRecitationLogWord[] = [];
  /** Learning language of the buffered events (last writer wins). */
  private pendingLanguage: string | undefined;
  /** One session id per center lifetime (page session) for the backend logs. */
  private readonly sessionId: string = newBatchId();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Serializes flushes — a flush never overlaps a previous in-flight one. */
  private flushChain: Promise<void> = Promise.resolve();
  /** Last known today-counters (server-confirmed or optimistic). */
  private lastToday: WordNewRecitationToday | null = null;
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
  getToday(): WordNewRecitationToday | null {
    return this.lastToday;
  }

  /** True when offline-queued recitation events still await replay. */
  hasPendingSync(): boolean {
    return this.pendingSync;
  }

  /** Subscribe to 'recitation-updated'. Returns an unsubscribe function. */
  subscribe(cb: (update: WordNewRecitationUpdate) => void): () => void {
    return wordNewEventBus.on('recitation-updated', (payload) => cb(payload as WordNewRecitationUpdate));
  }

  // ---- Event batching ----

  /**
   * Record one recitation event. Buffered and flushed as a batch (debounced
   * ~2s, immediate at 10 events, and on page-leave). Never throws — flush
   * failures are handled internally (queued-offline → optimistic count,
   * real failure → re-queued for the next flush).
   */
  recordAction(word: string, action: WordNewRecitationAction, language?: string): void {
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
      const result: WordNewRecitationLogResult = await wfNewApi.recitationLog({
        words,
        language,
        session_id: this.sessionId,
        // ONE fresh batch_id per flush — the replay-idempotency key.
        batch_id: newBatchId(),
      });
      this.lastToday = result.today;
      this.pendingSync = false;
      wordNewEventBus.emit('recitation-updated', {
        today: result.today,
        date: result.date,
        pending: false,
      } satisfies WordNewRecitationUpdate);
    } catch (error) {
      if (isQueuedError(error)) {
        // The write IS persisted (offline queue) and will replay with the same
        // batch_id — count it locally and mark the state pending-sync. The
        // centralized queued-offline toast already fired in the wfNewApi transport.
        const optimistic = this.optimisticToday(words.length);
        this.lastToday = optimistic;
        this.pendingSync = true;
        wordNewEventBus.emit('recitation-updated', {
          today: optimistic,
          pending: true,
        } satisfies WordNewRecitationUpdate);
        return;
      }
      // Auth failure is terminal, not transient: the token is missing/invalid
      // and every retry will 401 again, so drop the batch instead of re-queueing
      // it (the recite loop keeps feeding events — re-queueing floods the API).
      const status = (error as { status?: number } | null)?.status;
      if (status === 401 || status === 403) {
        console.warn('[WordNewRecitationCenter] log flush dropped (unauthenticated)');
        return;
      }
      // Real failure (validation / server error): keep the events for
      // the next flush so a transient failure never silently drops progress.
      console.error('[WordNewRecitationCenter] log flush failed:', error);
      this.pending.unshift(...words);
    }
  }

  /** Optimistic today-counters for a queued-offline flush. */
  private optimisticToday(flushedActions: number): WordNewRecitationToday {
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
   * (see wfNewApi). Seeds the live today-counters from done_today/goal so
   * headers have a baseline before the first flush. Rethrows on failure.
   */
  async getTodayPlan(params: { language?: string; limit?: number } = {}): Promise<WordNewRecitationTodayPlan> {
    const plan = await wfNewApi.recitationTodayPlan(params);
    this.rolloverLocalDay();
    this.lastToday = {
      unique_words: Math.max(plan.done_today ?? 0, this.localUniqueWords.size),
      actions: this.lastToday?.actions ?? 0,
      goal: plan.goal ?? 0,
      goal_met: (plan.goal ?? 0) > 0 && (plan.done_today ?? 0) >= (plan.goal ?? 0),
    };
    return plan;
  }

  /** Per-day summary (defaults to today; shared resource-cache TTL applies). */
  async getSummary(date?: string): Promise<WordNewRecitationSummary> {
    return wfNewApi.recitationSummary(date);
  }

  /** Streak counters + last-35-days strip (shared resource-cache TTL applies). */
  async getStreak(): Promise<WordNewRecitationStreak> {
    return wfNewApi.recitationStreak();
  }
}

export const wordNewRecitationCenter = new WordNewRecitationCenterClass();
