/**
 * Book-reader sentence audio: queued resolve/bump/poll (max concurrent pollers)
 * + priority bumps through pycore, which owns Laravel interaction and worker wakeup.
 *
 * All network I/O is funneled through one module-level scheduler so a chapter
 * with dozens of cells cannot open hundreds of parallel connections to :9000.
 */
import { wfNewApi } from '../api';
import { pycoreApi } from '../../../core/api-libs/pycore';
import { absUrl } from '../api/WfNewApiMappers';

const MAX_ACTIVE_POLLERS = 4;
const POLL_INTERVAL_MS = 1200;
const POLL_STINT_MS = 48000;
const OUTER_RETRY_GAP_MS = 4000;
const MAX_OUTER_RETRIES = 8;
const FAIRNESS_YIELD_MS = 15000;

export interface WaitSentenceAudioOpts {
  shouldContinue?: () => boolean;
  variantKey?: string;
  urgent?: boolean;
  onReady?: (url: string) => void;
  onStatus?: (info: { exists: boolean; queued?: boolean; tts_status?: string | null }) => void;
  onSettled?: (url: string | null) => void;
}

type EntryState = 'queued' | 'active' | 'settled';

interface PollEntry {
  key: string;
  text: string;
  lang: string;
  variantKey?: string;
  urgent: boolean;
  bumpOnly: boolean;
  state: EntryState;
  timer: ReturnType<typeof setTimeout> | null;
  bumped: boolean;
  outerTries: number;
  stintStartedAt: number;
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

async function resolveOnce(text: string, lang: string, variantKey?: string) {
  return wfNewApi.resolveSentenceAudio(text, lang, variantKey);
}

async function bumpOnce(contentId: string, lang: string): Promise<void> {
  try {
    await pycoreApi.prioritizeSentenceAudioItem(contentId, lang);
  } catch {
    /* ignore */
  }
}

class SentenceAudioScheduler {
  private entries = new Map<string, PollEntry>();
  private queue: string[] = [];
  private activeCount = 0;
  private destroyed = false;

  request(text: string, lang: string, opts?: WaitSentenceAudioOpts & { bumpOnly?: boolean }): void {
    const trimmed = text.trim();
    if (!trimmed || this.destroyed) return;
    const key = cellKey(trimmed, lang, opts?.variantKey);
    const existing = this.entries.get(key);
    if (existing && existing.state !== 'settled') {
      if (opts?.urgent) existing.urgent = true;
      if (opts?.shouldContinue) existing.shouldContinue = opts.shouldContinue;
      if (opts?.onStatus) existing.onStatus = opts.onStatus;
      if (opts?.onReady) existing.onReady = opts.onReady;
      if (opts?.onSettled) existing.onSettled = opts.onSettled;
      if (existing.state === 'queued' && existing.urgent) {
        this.queue = this.queue.filter((k) => k !== key);
        this.queue.unshift(key);
      }
      this.drain();
      return;
    }
    const entry: PollEntry = {
      key,
      text: trimmed,
      lang,
      variantKey: opts?.variantKey,
      urgent: !!opts?.urgent,
      bumpOnly: !!opts?.bumpOnly,
      state: 'queued',
      timer: null,
      bumped: false,
      outerTries: 0,
      stintStartedAt: 0,
      shouldContinue: opts?.shouldContinue,
      onStatus: opts?.onStatus,
      onReady: opts?.onReady,
      onSettled: opts?.onSettled,
      waiters: [],
    };
    this.entries.set(key, entry);
    if (entry.urgent) this.queue.unshift(key);
    else this.queue.push(key);
    // Bump immediately at enqueue: content_id is only known after the first
    // resolve response, and a queued entry may wait long for a free poller
    // slot, so notify laravel now via the text-based batch endpoint (single
    // item). e.bumped dedupes the later tick bump for this stint; requeue()
    // still resets it, so stint/retry caps and per-stint re-bump are unchanged.
    entry.bumped = true;
    void pycoreApi.prioritizeSentenceAudio([{ text: trimmed, language: lang }]).catch(() => { /* ignore */ });
    this.drain();
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
        if (existing.state === 'queued' && existing.urgent) {
          this.queue = this.queue.filter((k) => k !== key);
          this.queue.unshift(key);
        }
        this.drain();
        return;
      }
      this.request(trimmed, lang, {
        ...opts,
        onSettled: (url) => {
          opts?.onSettled?.(url);
          resolve(url);
        },
      });
    });
  }

  bumpOnly(text: string, lang: string, variantKey?: string): void {
    this.request(text, lang, { variantKey, bumpOnly: true, urgent: true });
  }

  reset(): void {
    this.destroyed = true;
    for (const e of this.entries.values()) {
      if (e.timer) clearTimeout(e.timer);
      for (const w of e.waiters) w(null);
      e.onSettled?.(null);
    }
    this.entries.clear();
    this.queue = [];
    this.activeCount = 0;
    this.destroyed = false;
  }

  private drain(): void {
    if (this.destroyed) return;
    while (this.activeCount < MAX_ACTIVE_POLLERS && this.queue.length > 0) {
      const key = this.queue.shift()!;
      const e = this.entries.get(key);
      if (!e || e.state !== 'queued') continue;
      e.state = 'active';
      e.stintStartedAt = Date.now();
      this.activeCount += 1;
      void this.tick(e);
    }
  }

  private releaseSlot(e: PollEntry): void {
    if (e.state === 'active') this.activeCount -= 1;
    if (e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
  }

  private finish(e: PollEntry, url: string | null): void {
    this.releaseSlot(e);
    e.state = 'settled';
    if (url) e.onReady?.(url);
    e.onSettled?.(url);
    for (const w of e.waiters) w(url);
    e.waiters.length = 0;
    this.entries.delete(e.key);
    this.drain();
  }

  private requeue(e: PollEntry): void {
    this.releaseSlot(e);
    e.state = 'queued';
    e.outerTries += 1;
    e.bumped = false;
    if (e.outerTries >= MAX_OUTER_RETRIES) {
      this.finish(e, null);
      return;
    }
    e.timer = setTimeout(() => {
      e.timer = null;
      if (this.destroyed || !this.entries.has(e.key)) return;
      this.queue.push(e.key);
      this.drain();
    }, OUTER_RETRY_GAP_MS);
  }

  private maybeYield(e: PollEntry): boolean {
    if (this.queue.length === 0) return false;
    const elapsed = Date.now() - e.stintStartedAt;
    if (elapsed < FAIRNESS_YIELD_MS) return false;
    this.releaseSlot(e);
    e.state = 'queued';
    this.queue.push(e.key);
    this.drain();
    return true;
  }

  private scheduleNext(e: PollEntry): void {
    if (this.destroyed || e.state !== 'active') return;
    e.timer = setTimeout(() => {
      e.timer = null;
      void this.tick(e);
    }, POLL_INTERVAL_MS);
  }

  private async tick(e: PollEntry): Promise<void> {
    if (this.destroyed || e.state !== 'active') return;
    if (e.shouldContinue && !e.shouldContinue()) {
      this.finish(e, null);
      return;
    }
    try {
      const r = await resolveOnce(e.text, e.lang, e.variantKey);
      e.onStatus?.({ exists: !!r.exists, queued: r.queued, tts_status: r.tts_status ?? null });
      if (r.exists && r.url) {
        const abs = absUrl(r.url) ?? null;
        if (abs) {
          this.finish(e, abs);
          return;
        }
      }
      const cid = r.content_id || r.hash;
      if (!e.bumped && cid) {
        e.bumped = true;
        // Laravel bump raises tts_priority; Laravel may also best-effort nudge
        // co-located pycore. Wordnew never calls pycore directly.
        await bumpOnce(cid, e.lang);
      }
      if (e.bumpOnly) {
        this.finish(e, null);
        return;
      }
      if (!r.queued && !r.exists && !cid) {
        this.finish(e, null);
        return;
      }
      const stintElapsed = Date.now() - e.stintStartedAt;
      if (stintElapsed >= POLL_STINT_MS) {
        this.requeue(e);
        return;
      }
      if (this.maybeYield(e)) return;
      this.scheduleNext(e);
    } catch {
      this.requeue(e);
    }
  }
}

const scheduler = new SentenceAudioScheduler();

/** Enqueue a cell for queued resolve/bump/poll (viewport-driven requests). */
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

/** One-shot bump (playback assist) — still queued, never fires bare concurrent fetches. */
export function bumpSentenceAudioImmediate(text: string, lang: string, variantKey?: string): Promise<void> {
  scheduler.bumpOnly(text, lang, variantKey);
  return Promise.resolve();
}

/** Clear pollers when the chapter/page scope changes. */
export function resetSentenceAudioScheduler(): void {
  scheduler.reset();
}
