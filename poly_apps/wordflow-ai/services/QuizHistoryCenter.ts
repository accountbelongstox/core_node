/**
 * Quiz History Center - Unified Quiz History Management
 * Centralized management of quiz records and statistics
 */

import { StorageCenter, StorageKey } from './StorageCenter';
import { EventBus } from './EventBus';

export interface QuizRecord {
  id: string;
  date: Date;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  groupId: string;
  groupName?: string;
  timeSpent: number; // seconds
  averageTimePerQuestion: number; // seconds
  language?: string;
}

export interface QuizStats {
  totalQuizzes: number;
  totalQuestions: number;
  totalCorrect: number;
  totalTime: number;
  averageScore: number;
  bestScore: number;
  streak: number; // days in a row
  lastQuizDate: Date | null;
}

type HistoryListener = (records: QuizRecord[]) => void;

class QuizHistoryCenterClass {
  private history: QuizRecord[] = [];
  private listeners: Set<HistoryListener> = new Set();
  private MAX_RECORDS = 100; // Keep last 100 quiz records

  /**
   * Initialize - load from storage
   */
  initialize(): void {
    const stored = StorageCenter.get<QuizRecord[]>(StorageKey.QUIZ_HISTORY, []);
    // Convert date strings back to Date objects
    this.history = stored.map(record => ({
      ...record,
      date: new Date(record.date),
    }));
    console.log('[QuizHistoryCenter] Loaded', this.history.length, 'quiz records');
  }

  /**
   * Add a new quiz record
   */
  addRecord(record: Omit<QuizRecord, 'id' | 'averageTimePerQuestion'>): void {
    const newRecord: QuizRecord = {
      ...record,
      id: this.generateId(),
      averageTimePerQuestion: record.timeSpent / record.totalQuestions,
    };

    // Add to beginning
    this.history.unshift(newRecord);

    // Keep only last MAX_RECORDS
    if (this.history.length > this.MAX_RECORDS) {
      this.history = this.history.slice(0, this.MAX_RECORDS);
    }

    this.save();
    this.notifyListeners();

    // Emit event
    EventBus.emit('quiz-completed', newRecord);

    console.log('[QuizHistoryCenter] Added quiz record:', newRecord.id);
  }

  /**
   * Get all quiz history
   */
  getHistory(limit?: number): QuizRecord[] {
    return limit ? this.history.slice(0, limit) : [...this.history];
  }

  /**
   * Get history by group ID
   */
  getHistoryByGroup(groupId: string, limit?: number): QuizRecord[] {
    const filtered = this.history.filter(r => r.groupId === groupId);
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Get history by date range
   */
  getHistoryByDateRange(startDate: Date, endDate: Date): QuizRecord[] {
    return this.history.filter(r =>
      r.date >= startDate && r.date <= endDate
    );
  }

  /**
   * Get recent quizzes (last N days)
   */
  getRecentQuizzes(days: number = 7): QuizRecord[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.history.filter(r => r.date >= cutoffDate);
  }

  /**
   * Get quiz statistics
   */
  getStats(): QuizStats {
    if (this.history.length === 0) {
      return {
        totalQuizzes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        totalTime: 0,
        averageScore: 0,
        bestScore: 0,
        streak: 0,
        lastQuizDate: null,
      };
    }

    const totalQuizzes = this.history.length;
    const totalQuestions = this.history.reduce((sum, r) => sum + r.totalQuestions, 0);
    const totalCorrect = this.history.reduce((sum, r) => sum + r.correctAnswers, 0);
    const totalTime = this.history.reduce((sum, r) => sum + r.timeSpent, 0);
    const averageScore = (totalCorrect / totalQuestions) * 100;
    const bestScore = Math.max(...this.history.map(r => r.score));
    const streak = this.calculateStreak();
    const lastQuizDate = this.history[0]?.date || null;

    return {
      totalQuizzes,
      totalQuestions,
      totalCorrect,
      totalTime,
      averageScore,
      bestScore,
      streak,
      lastQuizDate,
    };
  }

  /**
   * Get statistics for a specific group
   */
  getStatsByGroup(groupId: string): QuizStats {
    const groupHistory = this.getHistoryByGroup(groupId);

    if (groupHistory.length === 0) {
      return {
        totalQuizzes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        totalTime: 0,
        averageScore: 0,
        bestScore: 0,
        streak: 0,
        lastQuizDate: null,
      };
    }

    const totalQuizzes = groupHistory.length;
    const totalQuestions = groupHistory.reduce((sum, r) => sum + r.totalQuestions, 0);
    const totalCorrect = groupHistory.reduce((sum, r) => sum + r.correctAnswers, 0);
    const totalTime = groupHistory.reduce((sum, r) => sum + r.timeSpent, 0);
    const averageScore = (totalCorrect / totalQuestions) * 100;
    const bestScore = Math.max(...groupHistory.map(r => r.score));
    const lastQuizDate = groupHistory[0]?.date || null;

    return {
      totalQuizzes,
      totalQuestions,
      totalCorrect,
      totalTime,
      averageScore,
      bestScore,
      streak: 0, // Per-group streak not implemented
      lastQuizDate,
    };
  }

  /**
   * Delete a quiz record
   */
  deleteRecord(id: string): boolean {
    const index = this.history.findIndex(r => r.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.save();
      this.notifyListeners();
      console.log('[QuizHistoryCenter] Deleted quiz record:', id);
      return true;
    }
    return false;
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history = [];
    this.save();
    this.notifyListeners();
    console.log('[QuizHistoryCenter] Cleared all quiz history');
  }

  /**
   * Clear history older than N days
   */
  clearOldHistory(days: number): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const beforeCount = this.history.length;
    this.history = this.history.filter(r => r.date >= cutoffDate);

    if (beforeCount !== this.history.length) {
      this.save();
      this.notifyListeners();
      console.log('[QuizHistoryCenter] Cleared', beforeCount - this.history.length, 'old records');
    }
  }

  /**
   * Subscribe to history changes
   */
  subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current data
    listener([...this.history]);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.history.length;
  }

  /**
   * Private: Calculate current streak (consecutive days)
   */
  private calculateStreak(): number {
    if (this.history.length === 0) return 0;

    const sortedDates = this.history
      .map(r => this.getDateOnly(r.date))
      .sort((a, b) => b.getTime() - a.getTime());

    // Remove duplicates (same day)
    const uniqueDates = Array.from(
      new Set(sortedDates.map(d => d.getTime()))
    ).map(t => new Date(t));

    const today = this.getDateOnly(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if streak is current (today or yesterday)
    const mostRecent = uniqueDates[0];
    if (mostRecent.getTime() !== today.getTime() &&
        mostRecent.getTime() !== yesterday.getTime()) {
      return 0; // Streak broken
    }

    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const current = uniqueDates[i];
      const previous = uniqueDates[i - 1];

      const daysDiff = Math.floor(
        (previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Private: Get date without time
   */
  private getDateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Private: Generate unique ID
   */
  private generateId(): string {
    return `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Save to storage
   */
  private save(): void {
    StorageCenter.set(StorageKey.QUIZ_HISTORY, this.history);
  }

  /**
   * Private: Notify all listeners
   */
  private notifyListeners(): void {
    const historyCopy = [...this.history];
    this.listeners.forEach(listener => listener(historyCopy));
  }
}

export const QuizHistoryCenter = new QuizHistoryCenterClass();
