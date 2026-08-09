import { useSyncExternalStore } from 'react';
import { WfNewApiPaths } from '../api';
import type {
  WfNewQueueDeliveryReceipt,
  WfNewQueueDeliveryStage,
  WfNewQueuePriorityResult,
  WfNewQueueWorkerPresence,
} from '../api';
import { getJSON, postJSON } from '../api/WfNewApiTransport';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';

export type WordNewQueueResource = 'audio' | 'translation';

export interface WordNewTrackedQueueReceipt extends WfNewQueueDeliveryReceipt {
  key: string;
  resource: WordNewQueueResource;
}

export interface WordNewQueueRuntimeSnapshot {
  laravelOnline: boolean;
  workers: WfNewQueueWorkerPresence[];
  receipts: ReadonlyMap<string, WordNewTrackedQueueReceipt>;
  version: number;
}

interface QueueWorkerWire {
  id?: string | number;
  kind?: string;
  name?: string;
  processor_types?: string[];
  capabilities?: string[];
  online?: boolean;
  last_seen?: string | null;
  claimed?: number;
  hostname?: string | null;
}

interface QueueReceiptWire {
  task_id?: string;
  stage?: WfNewQueueDeliveryStage;
  task_status?: string | null;
  worker?: QueueWorkerWire | null;
}

const normalizeValue = (value: string): string => value.trim().toLowerCase();

export const wordAudioQueueKey = (word: string, language: string): string =>
  `audio:word:${normalizeValue(language)}:${normalizeValue(word)}`;

export const sentenceAudioQueueKey = (text: string, language: string): string =>
  `audio:sentence:${normalizeValue(language)}:${normalizeValue(text)}`;

export const wordTranslationQueueKey = (
  word: string,
  language: string,
  targetLanguage: string,
): string => `translation:word:${normalizeValue(language)}:${normalizeValue(targetLanguage)}:${normalizeValue(word)}`;

class WordNewQueueRuntime {
  private readonly listeners = new Set<() => void>();
  private readonly receiptLimit = Math.max(1, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
  private readonly tracked = new Map<string, WordNewTrackedQueueReceipt>();
  private refreshInFlight: Promise<void> | null = null;
  private snapshot: WordNewQueueRuntimeSnapshot = {
    laravelOnline: false,
    workers: [],
    receipts: new Map(),
    version: 0,
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): WordNewQueueRuntimeSnapshot => this.snapshot;

  markWaiting(key: string, resource: WordNewQueueResource): void {
    const current = this.tracked.get(key);
    if (current && current.stage !== 'failed') return;
    this.setReceipt(key, resource, 'waiting');
  }

  markLaravelReceived(key: string, resource: WordNewQueueResource, taskId?: string | null): void {
    const current = this.tracked.get(key);
    this.setReceipt(key, resource, 'laravel_received', taskId || current?.taskId || '');
  }

  markReady(key: string, resource: WordNewQueueResource): void {
    const current = this.tracked.get(key);
    this.setReceipt(key, resource, 'completed', current?.taskId || '');
  }

  recordWordAudio(
    response: WfNewQueuePriorityResult,
    words: string[],
    language: string,
  ): void {
    const results = response.results || [];
    words.forEach((word, index) => {
      const result = results.find((item) => item.content === word) || results[index];
      this.markLaravelReceived(
        wordAudioQueueKey(word, language),
        'audio',
        result?.queue_task_id || result?.task_id,
      );
    });
  }

  recordSentenceAudio(response: WfNewQueuePriorityResult, fallbackItems: Array<{ text: string; language: string }>): void {
    const items = response.items || fallbackItems;
    items.forEach((item, index) => {
      const fallback = fallbackItems[index];
      const text = item.text || fallback?.text || '';
      const language = item.language || fallback?.language || '';
      if (!text || !language) return;
      this.markLaravelReceived(
        sentenceAudioQueueKey(text, language),
        'audio',
        item.task_id || item.queue_task_id,
      );
    });
  }

  async prioritizeTranslations(words: string[], language: string, targetLanguage: string): Promise<void> {
    const normalizedWords = Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)))
      .slice(0, this.receiptLimit);
    if (!language.trim() || !targetLanguage.trim() || normalizedWords.length === 0) return;
    normalizedWords.forEach((word) => {
      this.markWaiting(wordTranslationQueueKey(word, language, targetLanguage), 'translation');
    });
    const response = await postJSON<any>(WfNewApiPaths.translationQueueStack, {
      words: normalizedWords,
      language,
      target_language: targetLanguage,
    });
    const results = Array.isArray(response?.results) ? response.results : [];
    normalizedWords.forEach((word) => {
      const result = results.find((item: any) => item?.word === word);
      const key = wordTranslationQueueKey(word, language, targetLanguage);
      if (result?.status === 'already_translated') {
        this.markReady(key, 'translation');
        return;
      }
      this.markLaravelReceived(key, 'translation', result?.task_id);
    });
  }

  async refreshPresence(): Promise<void> {
    try {
      const response = await getJSON<any>(WfNewApiPaths.queueCenterOverview);
      this.replaceWorkers(Array.isArray(response?.workers) ? response.workers : [], true);
    } catch {
      this.replaceWorkers([], false);
    }
  }

  refreshReceipts(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const taskIds = Array.from(new Set(
      Array.from(this.tracked.values()).map((receipt) => receipt.taskId).filter(Boolean),
    )).slice(0, this.receiptLimit);
    if (taskIds.length === 0) return Promise.resolve();
    const pending = this.loadReceipts(taskIds).finally(() => {
      if (this.refreshInFlight === pending) this.refreshInFlight = null;
    });
    this.refreshInFlight = pending;
    return pending;
  }

  private async loadReceipts(taskIds: string[]): Promise<void> {
    try {
      const response = await getJSON<any>(WfNewApiPaths.queueCenterReceipts(taskIds));
      const receipts: QueueReceiptWire[] = Array.isArray(response?.receipts) ? response.receipts : [];
      const byTaskId = new Map(receipts.map((receipt) => [String(receipt.task_id || ''), receipt]));
      let changed = false;
      this.tracked.forEach((current, key) => {
        const wire = byTaskId.get(current.taskId);
        if (!wire?.stage) return;
        const worker = wire.worker ? this.normalizeWorker(wire.worker) : null;
        const next: WordNewTrackedQueueReceipt = {
          ...current,
          stage: wire.stage,
          status: wire.task_status ?? null,
          workerId: worker?.id ?? null,
          workerKind: worker?.kind ?? null,
        };
        this.tracked.set(key, next);
        changed = true;
      });
      const workers = Array.isArray(response?.workers) ? response.workers : [];
      this.replaceWorkers(workers, true, changed);
    } catch {
      this.replaceWorkers(this.snapshot.workers, false);
    }
  }

  private normalizeWorker(worker: QueueWorkerWire): WfNewQueueWorkerPresence {
    return {
      id: String(worker.id || ''),
      kind: worker.kind || 'pycore',
      name: worker.name || String(worker.id || ''),
      processorTypes: Array.isArray(worker.processor_types) ? worker.processor_types : [],
      capabilities: Array.isArray(worker.capabilities) ? worker.capabilities : [],
      online: worker.online === true,
      lastSeen: worker.last_seen ?? null,
      claimed: Number(worker.claimed || 0),
      hostname: worker.hostname ?? null,
    };
  }

  private replaceWorkers(workers: QueueWorkerWire[] | WfNewQueueWorkerPresence[], laravelOnline: boolean, force = false): void {
    const normalized = workers.map((worker) => 'processorTypes' in worker
      ? worker
      : this.normalizeWorker(worker));
    this.snapshot = {
      laravelOnline,
      workers: normalized,
      receipts: new Map(this.tracked),
      version: this.snapshot.version + (force || laravelOnline !== this.snapshot.laravelOnline ? 1 : 0),
    };
    this.emit();
  }

  private setReceipt(
    key: string,
    resource: WordNewQueueResource,
    stage: WfNewQueueDeliveryStage,
    taskId = '',
  ): void {
    if (this.tracked.size >= this.receiptLimit && !this.tracked.has(key)) {
      const oldestKey = this.tracked.keys().next().value as string | undefined;
      if (oldestKey) this.tracked.delete(oldestKey);
    }
    const current = this.tracked.get(key);
    this.tracked.delete(key);
    this.tracked.set(key, {
      key,
      resource,
      taskId: taskId || current?.taskId || '',
      stage,
      status: current?.status ?? null,
      workerId: current?.workerId ?? null,
      workerKind: current?.workerKind ?? null,
    });
    this.publish();
  }

  private publish(): void {
    this.snapshot = {
      ...this.snapshot,
      receipts: new Map(this.tracked),
      version: this.snapshot.version + 1,
    };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const wordNewQueueRuntime = new WordNewQueueRuntime();

export const useWordNewQueueRuntime = (): WordNewQueueRuntimeSnapshot =>
  useSyncExternalStore(wordNewQueueRuntime.subscribe, wordNewQueueRuntime.getSnapshot, wordNewQueueRuntime.getSnapshot);

export const useWordNewQueueReceipt = (key?: string): WordNewTrackedQueueReceipt | null => {
  const snapshot = useWordNewQueueRuntime();
  return key ? snapshot.receipts.get(key) || null : null;
};
