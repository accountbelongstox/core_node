/**
 * Records the words an orchestration played into its API-side virtual read
 * batch (`learning/virtual-batches/{name}/reads`), so the next plan of the
 * task - or any task reading the same batch - treats them as read.
 *
 * Words are collected per task and flushed debounced; each flush has its own
 * request key and is retried with the same key after a failure (Laravel records
 * a request key once). `real` read state records nothing.
 */
import { wfNewApi } from '../../api';
import type { OrchComposeTask, OrchWordState } from '../../../../shared/orchestration/orchTypes';

const FLUSH_DELAY_MS = 3_000;
const RETRY_DELAY_MS = 30_000;
const MAX_IDS_PER_REQUEST = 500;

interface PendingFlush {
  batch: string;
  language: string;
  wordIds: Set<number>;
}

interface FailedFlush extends Omit<PendingFlush, 'wordIds'> {
  wordIds: number[];
  requestKey: string;
}

class WordNewOrchVirtualReadsService {
  private readonly pending = new Map<string, PendingFlush>();
  private readonly failed: FailedFlush[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;

  /** Words of `task` that finished playing (lower-case). */
  played(task: OrchComposeTask, words: readonly string[], states: ReadonlyMap<string, OrchWordState>): void {
    if (task.config.readState === 'real' || !task.config.virtualBatch || !wfNewApi.isAuthenticated()) return;
    const key = `${task.config.virtualBatch}\u0000${task.language}`;
    const entry = this.pending.get(key) ?? { batch: task.config.virtualBatch, language: task.language, wordIds: new Set<number>() };
    words.forEach((word) => {
      const id = states.get(word)?.wordId ?? 0;
      if (id > 0) entry.wordIds.add(id);
    });
    if (entry.wordIds.size === 0) return;
    this.pending.set(key, entry);
    this.schedule(FLUSH_DELAY_MS);
  }

  private schedule(delay: number): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private async flush(): Promise<void> {
    const batches: FailedFlush[] = this.failed.splice(0);
    this.pending.forEach((entry) => {
      const ids = [...entry.wordIds];
      for (let offset = 0; offset < ids.length; offset += MAX_IDS_PER_REQUEST) {
        this.sequence += 1;
        batches.push({
          batch: entry.batch,
          language: entry.language,
          wordIds: ids.slice(offset, offset + MAX_IDS_PER_REQUEST),
          requestKey: `wfnew-orch:${Date.now().toString(36)}:${this.sequence}`,
        });
      }
    });
    this.pending.clear();
    for (const flush of batches) {
      const ok = await wfNewApi.recordVirtualReads(flush.batch, flush.language, flush.wordIds, flush.requestKey)
        .then(() => true, () => false);
      if (!ok) this.failed.push(flush);
    }
    if (this.failed.length > 0) this.schedule(RETRY_DELAY_MS);
  }
}

export const wordNewOrchVirtualReads = new WordNewOrchVirtualReadsService();
