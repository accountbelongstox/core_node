import { useEffect, useSyncExternalStore } from 'react';
import type { WfNewQueueCommandResult } from '../api/WfNewApiTypes';
import {
  QUEUE_CENTER_DIFF_DELIVERY,
  type QueueDeliveryResourceKind,
} from '../../../core/contracts/QueueCenterContract';
import {
  LARAVEL_REALTIME_EVENTS,
  laravelApi,
  laravelRealtime,
  type LaravelTranslationStackResult,
} from '../../../core/integrations/laravel';
import {
  WordNewQueueDeliveryRuntime,
  type QueueDeliveryRuntimeSnapshot,
  type QueueDeliveryTrackedReceipt,
} from './queue/WordNewQueueDeliveryRuntime';

export type WordNewQueueResource = QueueDeliveryResourceKind;
export type WordNewTrackedQueueReceipt = QueueDeliveryTrackedReceipt<WordNewQueueResource>;
export type WordNewQueueRuntimeSnapshot = QueueDeliveryRuntimeSnapshot<WordNewQueueResource>;

const normalizeValue = (value: string): string => value.trim().toLowerCase();
const RECEIPT_QUERY_LIMIT = 32;
const RECEIPT_REFRESH_MS = 2000;
const PRESENCE_FALLBACK_REFRESH_MS = 60000;

export const wordAudioQueueKey = (word: string, language: string): string =>
  `audio:word:${normalizeValue(language)}:${normalizeValue(word)}`;

export const sentenceAudioQueueKey = (text: string, language: string): string =>
  `audio:sentence:${normalizeValue(language)}:${normalizeValue(text)}`;

export const wordTranslationQueueKey = (
  word: string,
  language: string,
  targetLanguage: string,
): string => `translation:word:${normalizeValue(language)}:${normalizeValue(targetLanguage)}:${normalizeValue(word)}`;

class WordNewQueueRuntime extends WordNewQueueDeliveryRuntime<WordNewQueueResource> {
  constructor() {
    super({
      loadOverview: () => laravelApi.getQueueCenterOverview(),
      loadReceipts: (taskIds) => laravelApi.getQueueCenterReceipts(taskIds),
    }, {
      receiptLimit: QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit,
      queryLimit: RECEIPT_QUERY_LIMIT,
      lifecycle: {
        receiptRefreshMs: RECEIPT_REFRESH_MS,
        presenceFallbackRefreshMs: PRESENCE_FALLBACK_REFRESH_MS,
        subscribePresence: (handler) => {
          const unsubscribe = laravelRealtime.subscribe(
            LARAVEL_REALTIME_EVENTS.workerPresence,
            () => handler(),
          );
          laravelRealtime.start();
          return () => {
            unsubscribe();
            laravelRealtime.stop();
          };
        },
      },
    });
  }

  recordWordAudio(response: WfNewQueueCommandResult, words: string[], language: string): void {
    const results = response.results || [];
    const resultsByWord = new Map(results.map((item) => [
      normalizeValue(item.word || item.content || ''),
      item,
    ]));
    words.forEach((word, index) => {
      const result = resultsByWord.get(normalizeValue(word)) || results[index];
      const key = wordAudioQueueKey(word, language);
      if (response.success === false || result?.success === false) {
        this.markFailed(key, 'audio');
        return;
      }
      if (result?.audio_status === 'ready'
        || result?.status === 'already_available'
        || result?.status === 'already_completed') {
        this.markReady(key, 'audio');
        return;
      }
      if (!result?.queue_task_id) {
        this.markFailed(key, 'audio');
        return;
      }
      this.markLaravelReceived(
        key,
        'audio',
        result.queue_task_id,
        result.queue_position,
        result.head_action,
      );
    });
  }

  recordSentenceAudio(
    response: WfNewQueueCommandResult,
    fallbackItems: Array<{ text: string; language: string }>,
  ): void {
    if (!response.success) {
      fallbackItems.forEach((item) => {
        this.markFailed(sentenceAudioQueueKey(item.text, item.language), 'audio');
      });
      return;
    }
    const items = response.items || [];
    const itemsByKey = new Map(items.map((item) => [
      sentenceAudioQueueKey(item.text || '', item.language || ''),
      item,
    ]));
    fallbackItems.forEach((fallback) => {
      const text = fallback.text;
      const language = fallback.language;
      const key = sentenceAudioQueueKey(text, language);
      const item = itemsByKey.get(key);
      if (item?.success === false || item?.status === 'failed' || !item) {
        this.markFailed(key, 'audio');
        return;
      }
      if (item.status === 'already_available' || item.status === 'already_completed') {
        this.markReady(key, 'audio');
        return;
      }
      if (!item.task_id && !item.queue_task_id) {
        this.markFailed(key, 'audio');
        return;
      }
      this.markLaravelReceived(
        key,
        'audio',
        item.task_id || item.queue_task_id,
        item.queue_position,
        item.head_action,
      );
    });
  }

  recordTranslations(
    response: LaravelTranslationStackResult,
    words: string[],
    language: string,
    targetLanguage: string,
  ): void {
    const results = Array.isArray(response?.results) ? response.results : [];
    const resultsByWord = new Map(results.map((item) => [normalizeValue(item.word || ''), item]));
    words.forEach((word) => {
      const result = resultsByWord.get(normalizeValue(word));
      const key = wordTranslationQueueKey(word, language, targetLanguage);
      if (response?.success === false) {
        this.markFailed(key, 'translation');
        return;
      }
      if (result?.status === 'already_translated') {
        this.markReady(key, 'translation');
        return;
      }
      if (result?.status === 'skipped_invalid') {
        this.markFailed(key, 'translation');
        return;
      }
      if (!result?.task_id) {
        this.markFailed(key, 'translation');
        return;
      }
      this.markLaravelReceived(key, 'translation', result.task_id);
    });
  }
}

export const wordNewQueueRuntime = new WordNewQueueRuntime();

export const useWordNewQueueRuntime = (): WordNewQueueRuntimeSnapshot =>
  useSyncExternalStore(wordNewQueueRuntime.subscribe, wordNewQueueRuntime.getSnapshot, wordNewQueueRuntime.getSnapshot);

export const useWordNewQueueRuntimeLifecycle = (): void => {
  useEffect(() => wordNewQueueRuntime.start(), []);
};

export const useWordNewQueueReceipt = (key?: string): WordNewTrackedQueueReceipt | null => {
  const snapshot = useWordNewQueueRuntime();
  return key ? snapshot.receipts.get(key) || null : null;
};
