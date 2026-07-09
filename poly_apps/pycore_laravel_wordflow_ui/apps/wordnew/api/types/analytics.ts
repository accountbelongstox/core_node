/** types/analytics.ts - analytics / activity timeline types. (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
export interface WeeklyActivity {
  day: string;
  mins: number;
  /** Words studied that day (shown in the bar-chart tooltip). */
  count: number;
}

export interface CategoryScore {
  name: string;
  count: number;
  /** 0-100 mastery for the category bar. */
  score: number;
}

export interface StudiedTimelineItem {
  word: string;
  status: 'Mastered' | 'Familiar' | 'Learning' | string;
  time: string;
}

export interface AnalyticsStats {
  totalStudyMins: number;
  retentionRate: number;
  cumulativeLearned: number;
  vocabularyTarget: number;
  streakDays: number;
  weeklyActivity: WeeklyActivity[];
  categoryScores: CategoryScore[];
  recentlyStudiedTimeline: StudiedTimelineItem[];
}

// ---- Backend endpoint management ------------------------------------------
