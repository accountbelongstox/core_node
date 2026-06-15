/**
 * Learning Progress Tracker
 * Manages learning progress with automatic backend sync
 */

import { ApiCenter } from './ApiCenter';
import { StorageCenter, StorageKey } from './StorageCenter';
import { EventBus } from './EventBus';

export interface WordProgress {
  wordId: string;
  word: string;
  groupId?: string;
  language: string;
  masteryLevel: number; // 0-100
  lastReviewedAt?: Date;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  timeSpent: number; // seconds
}

export interface LearningSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  groupId?: string;
  language: string;
  wordsLearned: number;
  wordsReviewed: number;
  totalTimeSpent: number;
  accuracy: number;
}

class LearningProgressTrackerClass {
  private currentSession: LearningSession | null = null;
  private sessionStartTime: number = 0;
  private wordStartTime: number = 0;
  private syncQueue: WordProgress[] = [];
  private isSyncing = false;

  /**
   * Start a new learning session
   */
  startSession(groupId?: string, language: string = 'en'): void {
    this.currentSession = {
      sessionId: `session_${Date.now()}`,
      startTime: new Date(),
      groupId,
      language,
      wordsLearned: 0,
      wordsReviewed: 0,
      totalTimeSpent: 0,
      accuracy: 0,
    };
    this.sessionStartTime = Date.now();
    console.log('[LearningProgressTracker] Session started:', this.currentSession.sessionId);
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.totalTimeSpent = Math.floor((Date.now() - this.sessionStartTime) / 1000);

    // Save session to storage
    this.saveSessionToStorage(this.currentSession);

    // Sync any remaining progress
    await this.syncProgressToBackend();

    console.log('[LearningProgressTracker] Session ended:', {
      duration: this.currentSession.totalTimeSpent,
      wordsLearned: this.currentSession.wordsLearned,
      wordsReviewed: this.currentSession.wordsReviewed,
      accuracy: this.currentSession.accuracy,
    });

    // Emit session end event
    EventBus.emit('learning-session-ended', this.currentSession);

    this.currentSession = null;
  }

  /**
   * Start tracking a word
   */
  startWordTracking(wordId: string): void {
    this.wordStartTime = Date.now();
  }

  /**
   * Record word review result
   */
  async recordWordReview(
    wordId: string,
    word: string,
    correct: boolean,
    groupId?: string,
    language?: string
  ): Promise<void> {
    const timeSpent = Math.floor((Date.now() - this.wordStartTime) / 1000);
    const lang = language || this.currentSession?.language || 'en';

    // Get or create progress
    const progress = this.getWordProgress(wordId) || {
      wordId,
      word,
      groupId,
      language: lang,
      masteryLevel: 0,
      reviewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      timeSpent: 0,
    };

    // Update progress
    progress.reviewCount++;
    if (correct) {
      progress.correctCount++;
      progress.masteryLevel = Math.min(100, progress.masteryLevel + 10);
    } else {
      progress.incorrectCount++;
      progress.masteryLevel = Math.max(0, progress.masteryLevel - 5);
    }
    progress.timeSpent += timeSpent;
    progress.lastReviewedAt = new Date();

    // Save locally
    this.saveWordProgress(progress);

    // Update session stats
    if (this.currentSession) {
      if (progress.reviewCount === 1) {
        this.currentSession.wordsLearned++;
      } else {
        this.currentSession.wordsReviewed++;
      }
      const totalReviews = this.currentSession.wordsLearned + this.currentSession.wordsReviewed;
      const totalCorrect = progress.correctCount;
      this.currentSession.accuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;
    }

    // Add to sync queue
    this.syncQueue.push(progress);

    // Sync to backend (debounced)
    this.debouncedSync();

    // Emit progress update event
    EventBus.emit('word-progress-updated', progress);
  }

  /**
   * Get word progress from storage
   */
  getWordProgress(wordId: string): WordProgress | null {
    const allProgress = StorageCenter.learning.getWordProgress();
    return allProgress[wordId] || null;
  }

  /**
   * Save word progress to storage
   */
  private saveWordProgress(progress: WordProgress): void {
    const allProgress = StorageCenter.learning.getWordProgress();
    allProgress[progress.wordId] = progress;
    StorageCenter.learning.setWordProgress(allProgress);
  }

  /**
   * Get all word progress
   */
  getAllProgress(): Record<string, WordProgress> {
    return StorageCenter.learning.getWordProgress();
  }

  /**
   * Get session history
   */
  getSessionHistory(): LearningSession[] {
    return StorageCenter.learning.getSessionHistory();
  }

  /**
   * Save session to storage
   */
  private saveSessionToStorage(session: LearningSession): void {
    const history = StorageCenter.learning.getSessionHistory();
    history.push(session);
    // Keep only last 100 sessions
    if (history.length > 100) {
      history.shift();
    }
    StorageCenter.learning.setSessionHistory(history);
  }

  /**
   * Sync progress to backend (debounced)
   */
  private syncTimeout: NodeJS.Timeout | null = null;
  private debouncedSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.syncProgressToBackend();
    }, 2000); // Wait 2 seconds before syncing
  }

  /**
   * Sync progress to backend
   */
  private async syncProgressToBackend(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) return;

    this.isSyncing = true;
    const toSync = [...this.syncQueue];
    this.syncQueue = [];

    try {
      console.log(`[LearningProgressTracker] Syncing ${toSync.length} progress records to backend`);

      for (const progress of toSync) {
        try {
          await ApiCenter.learning.updateProgress({
            word_id: progress.wordId,
            group_id: progress.groupId,
            language: progress.language,
            mastery_level: progress.masteryLevel,
            time_spent: progress.timeSpent,
            correct: progress.correctCount > progress.incorrectCount,
          });
        } catch (error) {
          console.error('[LearningProgressTracker] Failed to sync progress for word:', progress.wordId, error);
          // Re-add to queue for retry
          this.syncQueue.push(progress);
        }
      }

      console.log('[LearningProgressTracker] Sync completed successfully');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get statistics summary
   */
  getStatsSummary(): {
    totalWordsLearned: number;
    totalReviews: number;
    averageMastery: number;
    totalTimeSpent: number;
  } {
    const allProgress = this.getAllProgress();
    const progressArray = Object.values(allProgress);

    if (progressArray.length === 0) {
      return {
        totalWordsLearned: 0,
        totalReviews: 0,
        averageMastery: 0,
        totalTimeSpent: 0,
      };
    }

    const totalWordsLearned = progressArray.length;
    const totalReviews = progressArray.reduce((sum, p) => sum + p.reviewCount, 0);
    const totalMastery = progressArray.reduce((sum, p) => sum + p.masteryLevel, 0);
    const averageMastery = totalMastery / totalWordsLearned;
    const totalTimeSpent = progressArray.reduce((sum, p) => sum + p.timeSpent, 0);

    return {
      totalWordsLearned,
      totalReviews,
      averageMastery: Math.round(averageMastery),
      totalTimeSpent,
    };
  }

  /**
   * Clear all progress (use with caution)
   */
  clearAllProgress(): void {
    StorageCenter.learning.clearWordProgress();
    StorageCenter.learning.clearSessionHistory();
    console.log('[LearningProgressTracker] All progress cleared');
  }
}

export const LearningProgressTracker = new LearningProgressTrackerClass();
