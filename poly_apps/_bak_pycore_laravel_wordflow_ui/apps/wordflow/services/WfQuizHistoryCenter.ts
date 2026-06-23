/* [v4.1-Iris] Wf quiz history center — ported from
 * qy_capacitor/services/QuizHistoryCenter.ts, re-shaped for the Wf shell:
 * records persist via WordflowStorage (QUIZ_HISTORY key, ISO date strings,
 * last 100 kept), completion broadcast via wfEventBus('quiz-completed'). */

import { StorageCenter, StorageKey } from '../../../core/api-libs/wordflow/WordflowStorage';
import { wfEventBus } from './WfEventBus';

export interface WfQuizRecord {
  id: string;
  date: string;
  score: number;
  total: number;
  accuracy: number;
  durationMs?: number;
  groupId?: string;
  mode?: string;
}

const MAX_RECORDS = 100;

/** Record accuracy in percent, recomputed from score/total when missing. */
function recordAccuracy(r: WfQuizRecord): number {
  if (typeof r.accuracy === 'number' && Number.isFinite(r.accuracy)) return r.accuracy;
  return r.total > 0 ? (r.score / r.total) * 100 : 0;
}

/** Strip a date to local day granularity. */
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Consecutive-day streak ending today/yesterday (ported from the original). */
function calculateStreak(records: WfQuizRecord[]): number {
  if (records.length === 0) return 0;

  const uniqueDayTimes = Array.from(
    new Set(
      records
        .map((r) => new Date(r.date))
        .filter((d) => !Number.isNaN(d.getTime()))
        .map((d) => dateOnly(d).getTime())
    )
  ).sort((a, b) => b - a);

  if (uniqueDayTimes.length === 0) return 0;

  const today = dateOnly(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Streak is only current if the most recent quiz was today or yesterday.
  if (uniqueDayTimes[0] !== today.getTime() && uniqueDayTimes[0] !== yesterday.getTime()) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDayTimes.length; i++) {
    const daysDiff = Math.floor((uniqueDayTimes[i - 1] - uniqueDayTimes[i]) / (1000 * 60 * 60 * 24));
    if (daysDiff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

class WfQuizHistoryCenterClass {
  private async loadAll(): Promise<WfQuizRecord[]> {
    try {
      const stored = await StorageCenter.get<WfQuizRecord[]>(StorageKey.QUIZ_HISTORY, []);
      return Array.isArray(stored) ? stored : [];
    } catch (error: any) {
      // Corrupt entry must not throw: degrade to an empty history.
      console.warn('[WfQuizHistoryCenter] Load failed (handled, empty):', error?.message || error);
      return [];
    }
  }

  /**
   * Add a quiz record (newest first, last 100 kept) and broadcast
   * 'quiz-completed' with the stored record.
   */
  async add(rec: Omit<WfQuizRecord, 'id' | 'date'> & { date?: string }): Promise<WfQuizRecord> {
    const record: WfQuizRecord = {
      ...rec,
      id: `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      date: rec.date ?? new Date().toISOString(),
    };

    const history = await this.loadAll();
    history.unshift(record);
    await StorageCenter.set(StorageKey.QUIZ_HISTORY, history.slice(0, MAX_RECORDS));

    wfEventBus.emit('quiz-completed', record);
    return record;
  }

  /**
   * All stored quiz records, newest first.
   */
  async getAll(): Promise<WfQuizRecord[]> {
    return this.loadAll();
  }

  /**
   * Aggregate stats over the stored history (scores in accuracy percent).
   */
  async getStats(): Promise<{ totalQuizzes: number; averageScore: number; bestScore: number; streak: number }> {
    const history = await this.loadAll();
    if (history.length === 0) {
      return { totalQuizzes: 0, averageScore: 0, bestScore: 0, streak: 0 };
    }

    const accuracies = history.map(recordAccuracy);
    return {
      totalQuizzes: history.length,
      averageScore: accuracies.reduce((sum, a) => sum + a, 0) / history.length,
      bestScore: Math.max(...accuracies),
      streak: calculateStreak(history),
    };
  }

  /**
   * Clear all quiz history.
   */
  async clear(): Promise<void> {
    await StorageCenter.set(StorageKey.QUIZ_HISTORY, []);
  }
}

export const wfQuizHistoryCenter = new WfQuizHistoryCenterClass();
