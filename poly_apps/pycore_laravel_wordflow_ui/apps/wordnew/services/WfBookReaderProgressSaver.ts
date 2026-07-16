import { wfNewApi } from '../api';
import { wfNewNotify } from '../WfNewNotify';
import { wfReadingProgressCenter } from '../services/WfReadingProgressCenter';
import type { WfNewBookVerse } from '../api';

const DEBOUNCE_MS = 800;
const SAVE_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 5000;

export interface WfBookReaderProgressPayload {
  chapterIndex: number | null;
  verseSeq: number;
  grain: string;
  page: number;
}

interface WfBookReaderProgressSaverOpts {
  sourceKey: string;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  isPlaying: () => boolean;
  isFlat: () => boolean;
  getChapterIndex: () => number | null;
}

export class WfBookReaderProgressSaver {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPayload: WfBookReaderProgressPayload | null = null;
  private pendingRef = '';
  private saveInFlight = false;
  private timeoutNotified = false;

  constructor(private readonly opts: WfBookReaderProgressSaverOpts) {}

  cancel(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.debounceTimer = null;
    this.retryTimer = null;
    this.pendingPayload = null;
    this.saveInFlight = false;
  }

  schedule(verse: WfNewBookVerse, pageNum: number): void {
    const payload: WfBookReaderProgressPayload = {
      chapterIndex: this.opts.isFlat() ? null : this.opts.getChapterIndex(),
      verseSeq: verse.seq,
      grain: verse.grain,
      page: pageNum,
    };
    const ref = verse.ref || String(verse.seq);
    this.pendingPayload = payload;
    this.pendingRef = ref;

    void wfReadingProgressCenter.set(this.opts.sourceKey, {
      index: verse.seq,
      total: 0,
    });

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flushSave();
    }, DEBOUNCE_MS);
  }

  private async flushSave(): Promise<void> {
    if (!this.pendingPayload || this.saveInFlight) return;
    if (!this.opts.isPlaying()) return;
    if (!wfNewApi.isAuthenticated()) return;

    const payload = this.pendingPayload;
    const ref = this.pendingRef;
    this.saveInFlight = true;

    const saved = await this.saveWithTimeout(payload);
    this.saveInFlight = false;

    if (!this.opts.isPlaying()) return;

    if (saved) {
      this.timeoutNotified = false;
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
      wfNewNotify.push(this.opts.trans('reader.progressSaved', { ref }), 'success');
      return;
    }

    if (!this.timeoutNotified) {
      this.timeoutNotified = true;
      wfNewNotify.push(this.opts.trans('reader.progressSaveTimeout'), 'warning');
    }
    if (!this.retryTimer) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.opts.isPlaying()) {
          wfNewNotify.push(this.opts.trans('reader.progressSaveRetry'), 'info');
        }
        void this.flushSave();
      }, RETRY_DELAY_MS);
    }
  }

  private async saveWithTimeout(payload: WfBookReaderProgressPayload): Promise<boolean> {
    try {
      const result = await Promise.race([
        wfNewApi.saveBookReadingProgress(this.opts.sourceKey, payload),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SAVE_TIMEOUT_MS)),
      ]);
      if (!result) return false;
      return result.verseSeq === payload.verseSeq
        && (result.grain ?? 'sentence') === payload.grain
        && result.page === payload.page
        && (result.chapterIndex ?? null) === (payload.chapterIndex ?? null);
    } catch {
      return false;
    }
  }
}
