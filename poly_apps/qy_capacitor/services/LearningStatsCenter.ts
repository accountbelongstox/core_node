/**
 * Learning Stats Center - Unified Learning Statistics Management
 * Centralized management of learning progress, daily words, review queue, and statistics
 */

import { Word, LearningStats, RetentionStat, LearningProgress } from '../types';
import { ApiCenter } from './ApiCenter';
import { StorageCenter, StorageKey } from './StorageCenter';
import { EventBus } from './EventBus';

interface LearningStatsData {
  dailyWords: Word[];
  reviewQueue: Word[];
  stats: LearningStats | null;
  retentionStats: RetentionStat[];
  progress: LearningProgress | null;
  lastUpdated: number;
}

type StatsListener = (data: LearningStatsData) => void;

class LearningStatsCenterClass {
  private data: LearningStatsData = {
    dailyWords: [],
    reviewQueue: [],
    stats: null,
    retentionStats: [],
    progress: null,
    lastUpdated: 0,
  };

  private listeners: Set<StatsListener> = new Set();
  private loading: boolean = false;

  /**
   * Initialize - load from storage
   */
  async initialize(): Promise<void> {
    const cached = StorageCenter.get<LearningStatsData>(StorageKey.LEARNING_STATS) as unknown as LearningStatsData | null;
    if (cached) {
      console.log('[LearningStatsCenter] Loaded from storage');
      this.data = cached;
      this.notifyListeners();
    }

    // Only fetch fresh data if user is authenticated
    const token = StorageCenter.auth.getToken();
    if (token) {
      // Fetch fresh data in background. Failures are environmental
      // (offline / backend down); keep the cached state and warn.
      this.refresh().catch(err => {
        console.warn('[LearningStatsCenter] Background refresh failed (handled, using cached state):', err?.message || err);
      });
    } else {
      console.log('[LearningStatsCenter] User not authenticated, skipping API refresh');
    }
  }

  /**
   * Refresh all learning stats from API
   */
  async refresh(): Promise<void> {
    // Check authentication first - this API requires login
    const token = await StorageCenter.auth.getToken();
    if (!token) {
      console.log('[LearningStatsCenter] No authentication token, skipping API refresh');
      return;
    }

    if (this.loading) {
      console.log('[LearningStatsCenter] Refresh already in progress');
      return;
    }

    this.loading = true;
    console.log('[LearningStatsCenter] Refreshing all stats...');

    try {
      // Parallel fetch all stats
      const [dailyWords, reviewQueue, retentionStats] = await Promise.allSettled([
        this.fetchDailyWords(),
        this.fetchReviewQueue(),
        this.fetchRetentionStats(),
      ]);

      // Update data with successful results
      if (dailyWords.status === 'fulfilled') {
        this.data.dailyWords = dailyWords.value;
      }
      if (reviewQueue.status === 'fulfilled') {
        this.data.reviewQueue = reviewQueue.value;
      }
      if (retentionStats.status === 'fulfilled') {
        this.data.retentionStats = retentionStats.value;
      }

      this.data.lastUpdated = Date.now();
      this.save();
      this.notifyListeners();

      console.log('[LearningStatsCenter] Refresh completed');
      EventBus.emit('learning-stats-updated', this.data);
    } catch (error: any) {
      // Defensive: the inner fetches already use allSettled, but a failure
      // here must still degrade gracefully and keep last good state.
      console.warn('[LearningStatsCenter] Refresh failed (handled, keeping last good state):', error?.message || error);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get daily words
   */
  getDailyWords(): Word[] {
    return [...this.data.dailyWords];
  }

  /**
   * Get review queue
   */
  getReviewQueue(): Word[] {
    return [...this.data.reviewQueue];
  }

  /**
   * Get learning stats
   */
  getStats(): LearningStats | null {
    return this.data.stats;
  }

  /**
   * Get retention stats
   */
  getRetentionStats(): RetentionStat[] {
    return [...this.data.retentionStats];
  }

  /**
   * Get learning progress
   */
  getProgress(): LearningProgress | null {
    return this.data.progress;
  }

  /**
   * Get all data
   */
  getAllData(): LearningStatsData {
    return { ...this.data };
  }

  /**
   * Update word progress
   */
  async updateWordProgress(wordId: string, correct: boolean): Promise<void> {
    console.log('[LearningStatsCenter] Updating word progress:', wordId, correct);

    // Update review queue (remove word)
    this.data.reviewQueue = this.data.reviewQueue.filter(w => w.id !== wordId);

    // TODO: Call API to update progress
    // await ApiCenter.words.updateProgress(wordId, correct);

    // Refresh stats
    this.save();
    this.notifyListeners();

    // Emit event
    EventBus.emit('word-progress-updated', { wordId, correct });
  }

  /**
   * Mark daily goal as complete
   */
  async completeDailyGoal(): Promise<void> {
    console.log('[LearningStatsCenter] Daily goal completed');

    // TODO: Call API to update daily goal
    // await ApiCenter.user.updateDailyGoal();

    // Emit event
    EventBus.emit('daily-goal-completed', { date: new Date() });

    // Refresh stats
    await this.refresh();
  }

  /**
   * Subscribe to stats changes
   */
  subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current data
    listener({ ...this.data });

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if currently loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Get last updated timestamp
   */
  getLastUpdated(): number {
    return this.data.lastUpdated;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data = {
      dailyWords: [],
      reviewQueue: [],
      stats: null,
      retentionStats: [],
      progress: null,
      lastUpdated: 0,
    };
    this.save();
    this.notifyListeners();
  }

  /**
   * Private: Fetch daily words from API
   */
  private async fetchDailyWords(): Promise<Word[]> {
    console.log('[LearningStatsCenter] Fetching daily words...');

    // TODO: Implement actual API call
    // const response = await ApiCenter.words.getDailyWords();
    // return response.success ? response.data : [];

    // For now, return empty array
    return [];
  }

  /**
   * Private: Fetch review queue from API
   */
  private async fetchReviewQueue(): Promise<Word[]> {
    console.log('[LearningStatsCenter] Fetching review queue...');

    // TODO: Implement actual API call
    // const response = await ApiCenter.words.getReviewQueue();
    // return response.success ? response.data : [];

    // For now, return empty array
    return [];
  }

  /**
   * Private: Fetch retention stats from API
   */
  private async fetchRetentionStats(): Promise<RetentionStat[]> {
    console.log('[LearningStatsCenter] Fetching retention stats...');

    try {
      const response = await ApiCenter.user.getRetentionStats();
      return response.success && response.data ? response.data : [];
    } catch (error: any) {
      // Offline / backend down: fall back to a safe empty list.
      console.warn('[LearningStatsCenter] Failed to fetch retention stats (handled, empty fallback):', error?.message || error);
      return [];
    }
  }

  /**
   * Private: Save to storage
   */
  private save(): void {
    StorageCenter.set(StorageKey.LEARNING_STATS, this.data);
  }

  /**
   * Private: Notify all listeners
   */
  private notifyListeners(): void {
    const dataCopy = { ...this.data };
    this.listeners.forEach(listener => listener(dataCopy));
  }
}

export const LearningStatsCenter = new LearningStatsCenterClass();
