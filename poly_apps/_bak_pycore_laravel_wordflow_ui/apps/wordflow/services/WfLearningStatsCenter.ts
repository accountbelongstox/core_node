/* [v4.1-Iris] Wf learning stats center — ported from
 * qy_capacitor/services/LearningStatsCenter.ts, re-shaped for the Wf shell:
 * data comes from wordflowApi (which owns the TTL caches in WordflowStorage);
 * this layer only adds force-refresh (cache invalidation), answer reporting and
 * a 'learning-stats-updated' subscription via wfEventBus. */

import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { StorageCenter, StorageKey } from '../../../core/api-libs/wordflow/WordflowStorage';
import { wfEventBus } from './WfEventBus';

class WfLearningStatsCenterClass {
  /**
   * Learning stats from the API (TTL-cached by wordflowApi).
   * Pass force=true to drop the cache and re-fetch.
   */
  async getStats(force?: boolean): Promise<any> {
    if (force) {
      await StorageCenter.cache.invalidate(StorageKey.LEARNING_STATS_CACHE);
    }
    return wordflowApi.getLearningStats();
  }

  /**
   * Review queue from the API (TTL-cached by wordflowApi).
   */
  async getReviewQueue(force?: boolean): Promise<any[]> {
    if (force) {
      await StorageCenter.cache.invalidate(StorageKey.REVIEW_QUEUE_CACHE);
    }
    return wordflowApi.getReviewQueue();
  }

  /**
   * Daily words from the API (TTL-cached by wordflowApi).
   */
  async getDailyWords(count?: number): Promise<any[]> {
    return wordflowApi.getDailyWords(count);
  }

  /**
   * Report a learning answer: posts progress to the backend (which invalidates
   * the stats/review caches) and broadcasts 'learning-stats-updated'.
   */
  async reportAnswer(p: { word_id: string | number; group_id?: string; correct: boolean }): Promise<void> {
    await wordflowApi.updateLearningProgress(p);
    wfEventBus.emit('learning-stats-updated', p);
  }

  /**
   * Drop all learning-related caches and broadcast so subscribers re-fetch.
   */
  async refresh(): Promise<void> {
    await Promise.all([
      StorageCenter.cache.invalidate(StorageKey.LEARNING_STATS_CACHE),
      StorageCenter.cache.invalidate(StorageKey.REVIEW_QUEUE_CACHE),
      StorageCenter.cache.invalidate(StorageKey.DAILY_WORDS_CACHE),
    ]);
    wfEventBus.emit('learning-stats-updated');
  }

  /**
   * Subscribe to 'learning-stats-updated'. Returns an unsubscribe function.
   */
  subscribe(cb: () => void): () => void {
    return wfEventBus.on('learning-stats-updated', () => cb());
  }
}

export const wfLearningStatsCenter = new WfLearningStatsCenterClass();
