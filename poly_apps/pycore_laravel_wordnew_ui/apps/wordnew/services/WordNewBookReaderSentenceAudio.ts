/**
 * Book-reader sentence audio: queued head-move and one batched read-only lookup for every waiting
 * cell (one request per tick, never one per sentence). Laravel owns queue ordering and worker wakeup.
 * The poll slows down while nothing becomes ready and does not request at all while the server is
 * paused by its schema gate (serverSchemaGate).
 */
import { wfNewApi } from '../api';
import { wordNewQueueCenter } from './WordNewQueueCenter';
import { serverSchemaGate } from '../../../core/integrations/laravel/ServerSchemaGate';
import { Backoff } from '../../../core/tasks/Backoff';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';
import { diffQueueContext } from '../../../core/tasks/DiffQueueContext';
import { wordNewClipReady } from './WordNewClipReady';

const POLL_INTERVAL_MS = Math.max(
  250,
  Number(QUEUE_CENTER_DIFF_DELIVERY.poll_interval_ms || 1000),
);
const POLL_MAX_INTERVAL_MS = 15000;
/** A cell that stays missing this long stops being watched (the next view of it asks again). */
const WATCH_MAX_MS = 384000;
const DIFF_SCOPE = 'wordnew:sentence-audio:consumer';

export interface WaitSentenceAudioOpts {
  shouldContinue?: () => boolean;
  variantKey?: string;
  urgent?: boolean;
  onReady?: (url: string) => void;
  onStatus?: (info: { exists: boolean; queued?: boolean; tts_status?: string | null }) => void;
  onSettled?: (url: string | null) => void;
}

type EntryState = 'waiting' | 'settled';

interface PollEntry {
  key: string;
  text: string;
  lang: string;
  variantKey?: string;
  urgent: boolean;
  headOnly: boolean;
  state: EntryState;
  /** Resource id the `clip.ready` push announces. */
  readyId: string;
  startedAt: number;
  statusSent: boolean;
  shouldContinue?: () => boolean;
  onStatus?: WaitSentenceAudioOpts['onStatus'];
  onReady?: WaitSentenceAudioOpts['onReady'];
  onSettled?: WaitSentenceAudioOpts['onSettled'];
  waiters: Array<(url: string | null) => void>;
}

function cellKey(text: string, lang: string, variantKey?: string): string {
  const v = variantKey ?? '';
  return `${lang}::${v}::${text.trim().slice(0, 128)}`;
}

/**
 * Cells requested in one pass (a page renders ~100 at once) are coalesced:
 * one diff-context touch / consume and one queue-head command per flush.
 * Viewport requests are moved to the head by `useReaderQueueHead` (one batched
 * command for the visible page); only urgent and head-only requests move here.
 */
class SentenceAudioScheduler {
  private entries = new Map<string, PollEntry>();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;
  private readonly backoff = new Backoff(POLL_INTERVAL_MS, POLL_MAX_INTERVAL_MS, { jitter: 'none' });
  private destroyed = false;
  private pendingTouch: string[] = [];
  private pendingConsume: string[] = [];
  private pendingHead = new Map<string, { text: string; language: string }>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readyOff: (() => void) | null = null;

  constructor() {
    serverSchemaGate.subscribe(() => {
      if (serverSchemaGate.getSnapshot().schema !== 'pending') this.schedulePoll(0);
    });
  }

  /** A `clip.ready` push (or a reconnect: ids null) re-checks the waiting cells at once. */
  private wake(ids: ReadonlySet<string> | null): void {
    if (ids && ![...this.entries.values()].some((e) => ids.has(e.readyId))) return;
    this.backoff.reset();
    this.schedulePoll(0);
  }

  private releaseReady(): void {
    if (this.entries.size > 0) return;
    this.readyOff?.();
    this.readyOff = null;
  }

  private scheduleFlush(): void {
    this.flushTimer ??= setTimeout(() => this.flush(), 0);
  }

  private flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.pendingTouch.length) diffQueueContext.touch(DIFF_SCOPE, this.pendingTouch);
    if (this.pendingConsume.length) diffQueueContext.consume(DIFF_SCOPE, this.pendingConsume);
    const heads = [...this.pendingHead.values()];
    this.pendingTouch = [];
    this.pendingConsume = [];
    this.pendingHead.clear();
    const limit = QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit;
    for (let offset = 0; offset < heads.length; offset += limit) {
      void wordNewQueueCenter.moveSentencesToHead(heads.slice(offset, offset + limit)).catch(() => { /* ignore */ });
    }
  }

  request(text: string, lang: string, opts?: WaitSentenceAudioOpts & { headOnly?: boolean }): boolean {
    const trimmed = text.trim();
    if (!trimmed || this.destroyed) return false;
    const key = cellKey(trimmed, lang, opts?.variantKey);
    const existing = this.entries.get(key);
    if (existing && existing.state !== 'settled') {
      if (opts?.urgent) existing.urgent = true;
      if (opts?.shouldContinue) existing.shouldContinue = opts.shouldContinue;
      if (opts?.onStatus) existing.onStatus = opts.onStatus;
      if (opts?.onReady) existing.onReady = opts.onReady;
      if (opts?.onSettled) existing.onSettled = opts.onSettled;
      if (opts?.urgent || opts?.headOnly) {
        this.pendingHead.set(key, { text: trimmed, language: lang });
        this.scheduleFlush();
      }
      this.schedulePoll(0);
      return true;
    }
    if (this.entries.size >= QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit) return false;
    const entry: PollEntry = {
      key,
      text: trimmed,
      lang,
      variantKey: opts?.variantKey,
      urgent: !!opts?.urgent,
      headOnly: !!opts?.headOnly,
      state: 'waiting',
      readyId: wordNewClipReady.idOf('sentence', lang, trimmed),
      startedAt: Date.now(),
      statusSent: false,
      shouldContinue: opts?.shouldContinue,
      onStatus: opts?.onStatus,
      onReady: opts?.onReady,
      onSettled: opts?.onSettled,
      waiters: [],
    };
    this.entries.set(key, entry);
    this.readyOff ??= wordNewClipReady.subscribe((ids) => this.wake(ids));
    this.backoff.reset();
    this.pendingTouch.push(key);
    // Urgent / head-only cells are moved now (text-based batch endpoint, coalesced per flush);
    // polling is passive afterwards and never changes queue order.
    if (entry.urgent || entry.headOnly) this.pendingHead.set(key, { text: trimmed, language: lang });
    this.scheduleFlush();
    this.schedulePoll(0);
    return true;
  }

  waitForUrl(text: string, lang: string, opts?: WaitSentenceAudioOpts): Promise<string | null> {
    return new Promise((resolve) => {
      const trimmed = text.trim();
      if (!trimmed) {
        resolve(null);
        return;
      }
      const key = cellKey(trimmed, lang, opts?.variantKey);
      const existing = this.entries.get(key);
      if (existing && existing.state !== 'settled') {
        existing.waiters.push(resolve);
        if (opts?.urgent) existing.urgent = true;
        if (opts?.shouldContinue) existing.shouldContinue = opts.shouldContinue;
        if (opts?.onStatus) existing.onStatus = opts.onStatus;
        if (opts?.onReady) existing.onReady = opts.onReady;
        this.schedulePoll(0);
        return;
      }
      const accepted = this.request(trimmed, lang, {
        ...opts,
        onSettled: (url) => {
          opts?.onSettled?.(url);
          resolve(url);
        },
      });
      if (!accepted) resolve(null);
    });
  }

  moveToHeadOnly(text: string, lang: string, variantKey?: string): void {
    this.request(text, lang, { variantKey, headOnly: true, urgent: true });
  }

  reset(): void {
    this.destroyed = true;
    const keys = Array.from(this.entries.keys());
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.backoff.reset();
    for (const e of this.entries.values()) {
      for (const w of e.waiters) w(null);
      e.onSettled?.(null);
    }
    this.entries.clear();
    this.releaseReady();
    this.pendingConsume.push(...keys);
    this.flush();
    this.destroyed = false;
  }

  private finish(e: PollEntry, url: string | null): void {
    e.state = 'settled';
    if (url) e.onReady?.(url);
    e.onSettled?.(url);
    for (const w of e.waiters) w(url);
    e.waiters.length = 0;
    this.entries.delete(e.key);
    this.releaseReady();
    this.pendingConsume.push(e.key);
    this.scheduleFlush();
  }

  private schedulePoll(delayMs: number): void {
    if (this.destroyed || this.polling || this.entries.size === 0) return;
    if (this.pollTimer) {
      if (delayMs > 0) return;
      clearTimeout(this.pollTimer);
    }
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.poll();
    }, delayMs);
  }

  /** One read-only lookup for every waiting cell; a settled cell leaves, the rest wait for the next (slower) tick. */
  private async poll(): Promise<void> {
    if (this.destroyed || this.polling || this.entries.size === 0) return;
    if (serverSchemaGate.getSnapshot().schema === 'pending') return;
    this.polling = true;
    let found = false;
    try {
      const now = Date.now();
      const waiting: PollEntry[] = [];
      for (const e of [...this.entries.values()]) {
        if (e.state !== 'waiting') continue;
        if (e.headOnly || (e.shouldContinue && !e.shouldContinue()) || now - e.startedAt > WATCH_MAX_MS) this.finish(e, null);
        else waiting.push(e);
      }
      const limit = QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit;
      for (let offset = 0; offset < waiting.length && !this.destroyed; offset += limit) {
        const batch = waiting.slice(offset, offset + limit);
        const answers = await wfNewApi.lookupAudio(batch.map((e) => ({ kind: 'sentence' as const, language: e.lang, text: e.text })));
        batch.forEach((e, index) => {
          if (e.state !== 'waiting') return;
          const url = answers[index]?.ready ? answers[index].url : null;
          if (url) {
            found = true;
            e.onStatus?.({ exists: true });
            this.finish(e, url);
          } else if (!e.statusSent) {
            e.statusSent = true;
            e.onStatus?.({ exists: false, queued: true });
          }
        });
      }
    } catch (error) {
      serverSchemaGate.observeError(error);
    } finally {
      this.polling = false;
    }
    if (found) this.backoff.reset();
    this.schedulePoll(wordNewClipReady.pollDelayMs(this.backoff.next()));
  }
}

const scheduler = new SentenceAudioScheduler();

/** Enqueue a cell for queued resolve/head-move/poll (viewport-driven requests). */
export function requestSentenceAudio(text: string, lang: string, opts?: WaitSentenceAudioOpts): void {
  scheduler.request(text, lang, opts);
}

/** Poll until MP3 exists or retries exhaust; shares the global poller pool. */
export function waitForSentenceAudioUrl(
  text: string,
  lang: string,
  opts?: WaitSentenceAudioOpts,
): Promise<string | null> {
  return scheduler.waitForUrl(text, lang, opts);
}

/** One-shot queue-head move for playback assist. */
export function moveSentenceAudioToHeadImmediate(text: string, lang: string, variantKey?: string): Promise<void> {
  scheduler.moveToHeadOnly(text, lang, variantKey);
  return Promise.resolve();
}

/** Clear pollers when the chapter/page scope changes. */
export function resetSentenceAudioScheduler(): void {
  scheduler.reset();
}
