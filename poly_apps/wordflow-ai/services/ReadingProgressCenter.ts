/**
 * Reading Progress Center - Unified Reading Progress Management
 * Centralized management of reading progress for word groups
 */

import { StorageCenter, StorageKey } from './StorageCenter';
import { EventBus } from './EventBus';

export interface ReadingProgress {
  groupId: string;
  groupName?: string;
  currentWordIndex: number;
  totalWords: number;
  startedAt: Date;
  lastReadAt: Date;
  completedAt?: Date;
  totalTimeSpent: number; // seconds
  wordsRead: number;
  progressPercent: number;
}

type ProgressListener = (progressMap: Map<string, ReadingProgress>) => void;

class ReadingProgressCenterClass {
  private progressMap: Map<string, ReadingProgress> = new Map();
  private listeners: Set<ProgressListener> = new Set();

  /**
   * Initialize - load from storage
   */
  async initialize(): Promise<void> {
    const stored = await StorageCenter.get<Array<[string, ReadingProgress]>>(
      StorageKey.READING_PROGRESS,
      []
    );

    // Convert array back to Map and restore dates
    this.progressMap = new Map(
      (stored || []).map(([key, progress]) => [
        key,
        {
          ...progress,
          startedAt: new Date(progress.startedAt),
          lastReadAt: new Date(progress.lastReadAt),
          completedAt: progress.completedAt ? new Date(progress.completedAt) : undefined,
        },
      ])
    );

    console.log('[ReadingProgressCenter] Loaded', this.progressMap.size, 'reading progress records');
  }

  /**
   * Start reading a group (or resume)
   */
  async startReading(groupId: string, groupName?: string, totalWords?: number): Promise<ReadingProgress> {
    let progress = this.progressMap.get(groupId);

    if (progress) {
      // Resume existing progress
      progress.lastReadAt = new Date();
      console.log('[ReadingProgressCenter] Resuming reading:', groupId);
    } else {
      // Start new reading session
      progress = {
        groupId,
        groupName,
        currentWordIndex: 0,
        totalWords: totalWords || 0,
        startedAt: new Date(),
        lastReadAt: new Date(),
        totalTimeSpent: 0,
        wordsRead: 0,
        progressPercent: 0,
      };
      console.log('[ReadingProgressCenter] Started reading:', groupId);
    }

    this.progressMap.set(groupId, progress);
    await this.save();
    this.notifyListeners();

    return progress;
  }

  /**
   * Update reading progress
   */
  async updateProgress(
    groupId: string,
    currentIndex: number,
    timeSpent?: number
  ): Promise<ReadingProgress | undefined> {
    const progress = this.progressMap.get(groupId);

    if (!progress) {
      console.warn('[ReadingProgressCenter] No progress found for group:', groupId);
      return undefined;
    }

    progress.currentWordIndex = currentIndex;
    progress.lastReadAt = new Date();
    progress.wordsRead = currentIndex + 1;

    if (timeSpent !== undefined) {
      progress.totalTimeSpent += timeSpent;
    }

    // Calculate progress percent
    if (progress.totalWords > 0) {
      progress.progressPercent = Math.round((progress.wordsRead / progress.totalWords) * 100);
    }

    // Check if completed
    if (progress.currentWordIndex >= progress.totalWords - 1 && !progress.completedAt) {
      progress.completedAt = new Date();
      console.log('[ReadingProgressCenter] Reading completed:', groupId);
      EventBus.emit('reading-completed', progress);
    }

    this.progressMap.set(groupId, progress);
    await this.save();
    this.notifyListeners();

    return progress;
  }

  /**
   * Get progress for a group
   */
  getProgress(groupId: string): ReadingProgress | undefined {
    return this.progressMap.get(groupId);
  }

  /**
   * Get all progress records
   */
  getAllProgress(): ReadingProgress[] {
    return Array.from(this.progressMap.values());
  }

  /**
   * Get active (not completed) progress records
   */
  getActiveProgress(): ReadingProgress[] {
    return this.getAllProgress().filter(p => !p.completedAt);
  }

  /**
   * Get completed progress records
   */
  getCompletedProgress(): ReadingProgress[] {
    return this.getAllProgress().filter(p => p.completedAt !== undefined);
  }

  /**
   * Get recently read groups (last 7 days)
   */
  getRecentlyRead(days: number = 7): ReadingProgress[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.getAllProgress()
      .filter(p => p.lastReadAt >= cutoffDate)
      .sort((a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime());
  }

  /**
   * Reset progress for a group
   */
  async resetProgress(groupId: string): Promise<boolean> {
    const deleted = this.progressMap.delete(groupId);

    if (deleted) {
      await this.save();
      this.notifyListeners();
      console.log('[ReadingProgressCenter] Reset progress for:', groupId);
    }

    return deleted;
  }

  /**
   * Clear all progress
   */
  async clearAllProgress(): Promise<void> {
    this.progressMap.clear();
    await this.save();
    this.notifyListeners();
    console.log('[ReadingProgressCenter] Cleared all reading progress');
  }

  /**
   * Clear completed progress (older than N days)
   */
  async clearCompletedProgress(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let clearedCount = 0;

    for (const [groupId, progress] of this.progressMap.entries()) {
      if (progress.completedAt && progress.completedAt < cutoffDate) {
        this.progressMap.delete(groupId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      await this.save();
      this.notifyListeners();
      console.log('[ReadingProgressCenter] Cleared', clearedCount, 'completed progress records');
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalGroups: number;
    activeGroups: number;
    completedGroups: number;
    totalWordsRead: number;
    totalTimeSpent: number;
    averageProgress: number;
  } {
    const allProgress = this.getAllProgress();

    const totalGroups = allProgress.length;
    const activeGroups = allProgress.filter(p => !p.completedAt).length;
    const completedGroups = allProgress.filter(p => p.completedAt).length;
    const totalWordsRead = allProgress.reduce((sum, p) => sum + p.wordsRead, 0);
    const totalTimeSpent = allProgress.reduce((sum, p) => sum + p.totalTimeSpent, 0);
    const averageProgress =
      totalGroups > 0
        ? allProgress.reduce((sum, p) => sum + p.progressPercent, 0) / totalGroups
        : 0;

    return {
      totalGroups,
      activeGroups,
      completedGroups,
      totalWordsRead,
      totalTimeSpent,
      averageProgress,
    };
  }

  /**
   * Subscribe to progress changes
   */
  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current data
    listener(new Map(this.progressMap));

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.progressMap.size;
  }

  /**
   * Private: Save to storage
   */
  private async save(): Promise<void> {
    // Convert Map to array for serialization
    const data = Array.from(this.progressMap.entries());
    await StorageCenter.set(StorageKey.READING_PROGRESS, data);
  }

  /**
   * Private: Notify all listeners
   */
  private notifyListeners(): void {
    const mapCopy = new Map(this.progressMap);
    this.listeners.forEach(listener => listener(mapCopy));
  }
}

export const ReadingProgressCenter = new ReadingProgressCenterClass();
