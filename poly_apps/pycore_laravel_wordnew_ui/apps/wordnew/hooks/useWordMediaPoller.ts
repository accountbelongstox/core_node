/**
 * useWordMediaPoller — reusable "poll word media until available" engine for
 * word tables (extracted from WfNewLibraryPage.requestWordMedia, which was a
 * fixed 3-try chain). The first request is active and prioritizes missing media;
 * later polls are passive reads so polling cannot repeatedly raise priority or
 * emit duplicate queue events.
 *
 * Behavior:
 *   - open-ended retry: ~4s cadence for the first ~30s, then backoff ~15–30s;
 *   - max 5 concurrent pollers (contract D5), the rest queued FIFO; explicit
 *     requests (row expand) jump the queue; a backed-off poller yields its slot
 *     to queued rows and resumes later at the slow cadence (no starvation);
 *   - viewport-driven: rows registered via `bindRowRef` are watched with ONE
 *     IntersectionObserver — visible rows lacking audio auto-request, and a
 *     poller pauses while its row is off-screen or the document is hidden;
 *   - stop when the preferred-accent audio AND image are ready; while a
 *     fallback-accent audio is served (accentFallback) keep polling for the
 *     preferred rendition at the backoff cadence only;
 *   - a fetch failure clears the request guard (plus a slow auto-retry while
 *     the row stays visible), so a later re-expand re-requests immediately.
 */
import { useEffect, useRef, useState } from 'react';
import { wfNewApi } from '../api';
import type { WfNewWordAccent, WfNewWordMedia } from '../api';

const MAX_ACTIVE_POLLERS = 5;
const FAST_INTERVAL_MS = 4000;
const FAST_WINDOW_MS = 30000;
const SLOW_BASE_MS = 15000;
const SLOW_STEP_MS = 5000;
const SLOW_MAX_MS = 30000;
const ERROR_RETRY_MS = 30000;

interface SchedulerConfig {
  getLanguage: () => string;
  getAccent: () => WfNewWordAccent | undefined;
  onMedia: (md5: string, media: WfNewWordMedia) => void;
}

/** Static facts about one table row (from the page payload) + live visibility. */
interface RowInfo {
  word: string;
  hasAudio: boolean;
  visible: boolean;
}

type EntryState = 'queued' | 'active' | 'paused' | 'settled';

interface PollEntry {
  md5: string;
  word: string;
  /** Explicitly requested (row expand) — jumps the queue on (re)enqueue. */
  urgent: boolean;
  state: EntryState;
  timer: ReturnType<typeof setTimeout> | null;
  /** Accumulated fast-phase polling time across active stints. */
  fastElapsedMs: number;
  activeSince: number;
  slowPolls: number;
  /** True for the initial or explicit active backend notification. */
  notifyBackend: boolean;
}

/** The non-React polling engine (all state private; hook below binds to React). */
class WordMediaPollScheduler {
  private entries = new Map<string, PollEntry>();
  private queue: string[] = [];
  private activeCount = 0;
  private rows = new Map<string, RowInfo>();
  private elements = new Map<string, Element>();
  private elementMd5 = new Map<Element, string>();
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private observer: IntersectionObserver | null = null;
  private suspended = true;
  private destroyed = false;

  constructor(private readonly cfg: SchedulerConfig) {}

  /** True while the word has an in-flight/queued/settled request (pending UI + guard). */
  isRequested(md5: string): boolean {
    return this.entries.has(md5);
  }

  /** Explicit request (row expand): starts or re-prioritizes a poller. */
  request(md5: string, word: string): void {
    if (this.destroyed) return;
    const existing = this.entries.get(md5);
    if (existing) {
      existing.urgent = true;
      existing.notifyBackend = true;
      if (existing.state === 'queued') {
        this.queue = this.queue.filter((m) => m !== md5);
        this.queue.unshift(md5);
      } else if (existing.state === 'paused') {
        this.enqueue(existing, true);
      }
      this.drain();
      return;
    }
    this.enqueue(this.makeEntry(md5, word, true), true);
    this.drain();
  }

  /** Register/unregister a row element for viewport-visibility tracking (G3/D5). */
  bindElement(md5: string, word: string, hasAudio: boolean, el: Element | null): void {
    if (this.destroyed) return;
    const info = this.rows.get(md5) ?? { word, hasAudio, visible: false };
    info.word = word;
    info.hasAudio = hasAudio;
    this.rows.set(md5, info);
    const prev = this.elements.get(md5);
    if (prev === el) return;
    if (prev) {
      this.observer?.unobserve(prev);
      this.elementMd5.delete(prev);
      this.elements.delete(md5);
    }
    if (!el) return;
    this.elements.set(md5, el);
    this.elementMd5.set(el, md5);
    this.ensureObserver();
    if (this.observer) {
      this.observer.observe(el);
    } else {
      // No IntersectionObserver support: treat every bound row as visible.
      info.visible = true;
      this.autoRequestIfNeeded(md5);
    }
  }

  /** Arm/resume: (re)create the observer, re-observe rows, resume paused pollers. */
  resume(): void {
    if (this.destroyed) return;
    this.suspended = false;
    this.ensureObserver();
    if (this.observer) {
      for (const el of this.elements.values()) this.observer.observe(el);
    }
    for (const e of this.entries.values()) {
      if (e.state === 'paused' && (this.rows.get(e.md5)?.visible ?? true)) {
        this.enqueue(e, e.urgent);
      }
    }
    this.drain();
  }

  /** Park everything (timers cancelled, observer off) but keep state for resume(). */
  suspend(): void {
    this.suspended = true;
    for (const e of this.entries.values()) {
      if (e.state === 'active' || e.state === 'queued') this.pause(e);
    }
    for (const t of this.retryTimers.values()) clearTimeout(t);
    this.retryTimers.clear();
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Final teardown (reset key change / unmount): suspend + reject late results. */
  dispose(): void {
    this.suspend();
    this.destroyed = true;
    this.entries.clear();
    this.queue = [];
    this.activeCount = 0;
    this.rows.clear();
    this.elements.clear();
    this.elementMd5.clear();
  }

  /** Mirror document.hidden into the engine (called on 'visibilitychange'). */
  handleDocumentVisibility(): void {
    if (this.destroyed || this.suspended) return;
    if (typeof document !== 'undefined' && document.hidden) {
      for (const e of this.entries.values()) {
        if (e.state === 'active' || e.state === 'queued') this.pause(e);
      }
    } else {
      for (const e of this.entries.values()) {
        if (e.state === 'paused' && (this.rows.get(e.md5)?.visible ?? true)) {
          this.enqueue(e, e.urgent);
        }
      }
      this.drain();
    }
  }

  // ---- internals ---------------------------------------------------------- //

  private makeEntry(md5: string, word: string, urgent: boolean): PollEntry {
    const e: PollEntry = {
      md5, word, urgent, state: 'queued', timer: null,
      fastElapsedMs: 0, activeSince: 0, slowPolls: 0, notifyBackend: true,
    };
    this.entries.set(md5, e);
    return e;
  }

  private enqueue(e: PollEntry, front: boolean): void {
    e.state = 'queued';
    if (this.queue.includes(e.md5)) return;
    if (front) this.queue.unshift(e.md5);
    else this.queue.push(e.md5);
  }

  private drain(): void {
    if (this.destroyed || this.suspended) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    while (this.activeCount < MAX_ACTIVE_POLLERS && this.queue.length > 0) {
      const md5 = this.queue.shift()!;
      const e = this.entries.get(md5);
      if (!e || e.state !== 'queued') continue;
      e.state = 'active';
      e.activeSince = Date.now();
      this.activeCount += 1;
      this.poll(e);
    }
  }

  /** Free the concurrency slot + timer of an active entry (state left to caller). */
  private releaseSlot(e: PollEntry): void {
    if (e.state === 'active') {
      this.activeCount -= 1;
      e.fastElapsedMs += Date.now() - e.activeSince;
    }
    if (e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
  }

  private pause(e: PollEntry): void {
    this.releaseSlot(e);
    if (e.state === 'queued') this.queue = this.queue.filter((m) => m !== e.md5);
    e.state = 'paused';
    this.drain();
  }

  /** Yield the slot to queued rows but keep the entry re-queued (fairness). */
  private park(e: PollEntry): void {
    this.releaseSlot(e);
    this.enqueue(e, false);
    this.drain();
  }

  private settle(e: PollEntry): void {
    this.releaseSlot(e);
    e.state = 'settled';
    this.drain();
  }

  /** Fetch failure: clear the guard (re-expand re-requests) + slow auto-retry. */
  private fail(e: PollEntry): void {
    this.releaseSlot(e);
    this.entries.delete(e.md5);
    if (this.destroyed || this.suspended) return;
    const t = setTimeout(() => {
      this.retryTimers.delete(e.md5);
      this.autoRequestIfNeeded(e.md5);
    }, ERROR_RETRY_MS);
    this.retryTimers.set(e.md5, t);
    this.drain();
  }

  private autoRequestIfNeeded(md5: string): void {
    if (this.destroyed || this.entries.has(md5)) return;
    const info = this.rows.get(md5);
    if (!info || !info.visible || info.hasAudio) return;
    this.enqueue(this.makeEntry(md5, info.word, false), false);
    this.drain();
  }

  private slowDelay(e: PollEntry): number {
    const delay = Math.min(SLOW_MAX_MS, SLOW_BASE_MS + e.slowPolls * SLOW_STEP_MS);
    e.slowPolls += 1;
    return delay;
  }

  private ensureObserver(): void {
    if (this.observer || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver((ents) => {
      for (const ent of ents) {
        const md5 = this.elementMd5.get(ent.target);
        if (md5) this.setRowVisible(md5, ent.isIntersecting);
      }
    }, { threshold: 0.01 });
  }

  private setRowVisible(md5: string, visible: boolean): void {
    const info = this.rows.get(md5);
    if (!info || info.visible === visible) return;
    info.visible = visible;
    const e = this.entries.get(md5);
    if (visible) {
      if (e) {
        if (e.state === 'paused') {
          this.enqueue(e, e.urgent);
          this.drain();
        }
      } else {
        this.autoRequestIfNeeded(md5);
      }
    } else if (e && (e.state === 'active' || e.state === 'queued')) {
      this.pause(e);
    }
  }

  private poll(e: PollEntry): void {
    if (this.destroyed || this.suspended || e.state !== 'active') return;
    if (typeof document !== 'undefined' && document.hidden) {
      this.pause(e);
      return;
    }
    const accent = this.cfg.getAccent();
    const notifyBackend = e.notifyBackend;
    e.notifyBackend = false;
    wfNewApi
      .getWordMedia(this.cfg.getLanguage(), e.word, {
        accent,
        passive: !notifyBackend,
      })
      .then((m) => {
        if (this.destroyed) return;
        this.cfg.onMedia(e.md5, m);
        const audioReady = m.audioStatus === 'ready';
        const preferredDone = audioReady && !m.accentFallback;
        const imageDone = m.imageStatus === 'ready';
        if (preferredDone && imageDone) {
          this.settle(e);
          return;
        }
        if (e.state !== 'active') return; // paused/re-queued while in flight
        // Cadence: fast for the first window; backoff after it — and ALWAYS
        // backoff once a (fallback-accent) audio is already playable (G10).
        const elapsed = e.fastElapsedMs + (Date.now() - e.activeSince);
        const slow = audioReady || elapsed >= FAST_WINDOW_MS;
        if (slow && this.queue.length > 0) {
          this.park(e);
          return;
        }
        const delayMs = slow ? this.slowDelay(e) : FAST_INTERVAL_MS;
        e.timer = setTimeout(() => {
          e.timer = null;
          this.poll(e);
        }, delayMs);
      })
      .catch(() => {
        if (!this.destroyed) this.fail(e);
      });
  }
}

export interface UseWordMediaPollerResult {
  /** On-demand resolved media, keyed by word md5 (overlay on the page payload). */
  mediaByMd5: Record<string, WfNewWordMedia>;
  /** True once a word has an in-flight/queued/settled request (pending UI). */
  isRequested: (md5: string) => boolean;
  /** Explicit request (row expand) — starts a poller / jumps the queue. */
  requestWord: (w: { md5: string; word: string }) => void;
  /** Per-row ref callback: registers the row element for viewport tracking. */
  bindRowRef: (w: { md5: string; word: string; hasAudio: boolean }) => (el: HTMLElement | null) => void;
}

export function useWordMediaPoller(opts: {
  language: string;
  accent?: WfNewWordAccent;
  /** Changing it tears the engine down and starts fresh (library/page change). */
  resetKey?: string | number;
}): UseWordMediaPollerResult {
  const [mediaByMd5, setMediaByMd5] = useState<Record<string, WfNewWordMedia>>({});
  const langRef = useRef(opts.language);
  langRef.current = opts.language;
  const accentRef = useRef(opts.accent);
  accentRef.current = opts.accent;

  const schedulerRef = useRef<WordMediaPollScheduler | null>(null);
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());

  // Recreate the engine synchronously on reset (render-time, so the new rows of
  // the incoming page bind to the NEW engine, not a torn-down one).
  const [prevKey, setPrevKey] = useState(opts.resetKey);
  if (prevKey !== opts.resetKey) {
    setPrevKey(opts.resetKey);
    setMediaByMd5({});
    schedulerRef.current?.dispose();
    schedulerRef.current = null;
    refCallbacks.current = new Map();
  }
  if (!schedulerRef.current) {
    schedulerRef.current = new WordMediaPollScheduler({
      getLanguage: () => langRef.current,
      getAccent: () => accentRef.current,
      onMedia: (md5, media) => setMediaByMd5((prev) => ({ ...prev, [md5]: media })),
    });
  }

  // Arm on mount, park on unmount (suspend keeps state, so a StrictMode
  // remount resumes cleanly); mirror document visibility into the engine.
  useEffect(() => {
    schedulerRef.current?.resume();
    const onDocVisibility = () => schedulerRef.current?.handleDocumentVisibility();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onDocVisibility);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onDocVisibility);
      }
      schedulerRef.current?.suspend();
    };
  }, [prevKey]);

  const apiRef = useRef<UseWordMediaPollerResult | null>(null);
  if (!apiRef.current) {
    apiRef.current = {
      mediaByMd5: {},
      isRequested: (md5) => schedulerRef.current?.isRequested(md5) ?? false,
      requestWord: (w) => schedulerRef.current?.request(w.md5, w.word),
      bindRowRef: (w) => {
        let cb = refCallbacks.current.get(w.md5);
        if (!cb) {
          cb = (el) => schedulerRef.current?.bindElement(w.md5, w.word, w.hasAudio, el);
          refCallbacks.current.set(w.md5, cb);
        }
        return cb;
      },
    };
  }
  apiRef.current.mediaByMd5 = mediaByMd5;
  return apiRef.current;
}
