import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Target,
  Award,
  RefreshCw,
  AlertCircle,
  Lock,
  BookOpen,
  Languages
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import type { LearningStatsData } from '@/apps/laravel-manager/api';
import { commonClasses } from '../../styles/theme';
import { TRANSLATIONS } from '../../constants';
import { useAppState } from '../../contexts/AppStateContext';
import { logError, logInfo } from '../../core/logstore/logStore';

interface StatisticsPanelProps {
  userId?: string;
}

/**
 * Mapped from GET /user/stats (AppQyV1ProfileController::getStatistics).
 * Only fields with a real backing data source are kept — total_study_time is
 * reported as a known gap by the backend (always 0) and is NOT shown.
 */
interface UserStats {
  totalWords: number;
  learnedWords: number;      // total_words_learned (total - new)
  masteredWords: number;
  needsReview: number;
  accuracy: number;          // average_accuracy (%)
  completionRate: number;    // mastered / total (%)
  dailyAverage: number;
  studyDays: number;
  currentStreak: number;
  longestStreak: number;
  todayProgress: number;
  dailyGoal: number;
  /** Words touched per day, oldest → today (7 entries). */
  weeklyProgress: number[];
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ userId }) => {
  const { lang } = useAppState();
  const t = TRANSLATIONS[lang].vocabulary;

  const [stats, setStats] = useState<UserStats | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const loadStatistics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAuthRequired(false);

    try {
      const [userRes, learningRes] = await Promise.all([
        api.appQyV1.getStats(),
        // Supplementary series (selected libraries / languages); non-fatal.
        api.appQyV1.getLearningStats()
      ]);

      if (!userRes.success || !userRes.data) {
        if (userRes.status === 401 || userRes.status === 403) {
          setAuthRequired(true);
          setStats(null);
          setLearningStats(null);
          return;
        }
        throw new Error(userRes.error || t.stats_load_failed);
      }

      const d: any = userRes.data;
      const weekly = Array.isArray(d.weekly_progress)
        ? d.weekly_progress.map((v: any) => Number(v) || 0).slice(-7)
        : [];

      setStats({
        totalWords: Number(d.total_words ?? d.totalWords) || 0,
        learnedWords: Number(d.total_words_learned ?? d.learned_count) || 0,
        masteredWords: Number(d.mastered_words) || 0,
        needsReview: Number(d.needs_review ?? d.review_count) || 0,
        accuracy: Number(d.average_accuracy ?? d.averageAccuracy) || 0,
        completionRate: Number(d.daily_goal_progress ?? d.completionRate) || 0,
        dailyAverage: Number(d.daily_average) || 0,
        studyDays: Number(d.study_days ?? d.studyDays) || 0,
        currentStreak: Number(d.current_streak) || 0,
        longestStreak: Number(d.longest_streak) || 0,
        todayProgress: Number(d.today_progress) || 0,
        dailyGoal: Math.max(1, Number(d.daily_goal) || 20),
        weeklyProgress: weekly
      });

      if (learningRes.success && learningRes.data) {
        setLearningStats(learningRes.data as LearningStatsData);
      } else {
        setLearningStats(null);
      }

      logInfo('vocab', 'Statistics loaded from /user/stats + /learning/stats');
    } catch (error: any) {
      console.error('Failed to load statistics:', error);
      setLoadError(error?.message || t.stats_load_failed);
      logError('vocab', `Statistics load failed: ${error?.message || 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [t.stats_load_failed]);

  useEffect(() => {
    loadStatistics();
  }, [userId, loadStatistics]);

  /** Weekday labels for the trailing 7-day chart (oldest → today). */
  const weekDayLabels = (count: number): string[] => {
    const labels: string[] = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    return labels;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 max-w-2xl mx-auto text-center`}>
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t.login_required}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t.stats_login_hint}
          </p>
          <button
            onClick={loadStatistics}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loadError || !stats) {
    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 max-w-2xl mx-auto text-center`}>
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t.stats_load_failed}
          </h2>
          {loadError && <p className="text-gray-600 dark:text-gray-400 mb-4">{loadError}</p>}
          <button
            onClick={loadStatistics}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const weekly = stats.weeklyProgress;
  const weeklyMax = Math.max(1, ...weekly);
  const labels = weekDayLabels(weekly.length);
  const goalRemaining = stats.dailyGoal - stats.todayProgress;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Learning Statistics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track your vocabulary learning progress
          </p>
        </div>
        <button
          onClick={loadStatistics}
          disabled={loading}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Words Learned */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Words Learned
            </h3>
            <Target className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.learnedWords}
            </p>
            <p className="text-sm text-gray-500 mb-1">/ {stats.totalWords}</p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{
                  width: `${stats.totalWords > 0
                    ? Math.min((stats.learnedWords / stats.totalWords) * 100, 100)
                    : 0}%`
                }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {stats.dailyAverage} words / study day on average
          </p>
        </div>

        {/* Mastered */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Mastered
            </h3>
            <BookOpen className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.masteredWords}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.completionRate}% of your collection
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {stats.needsReview} due for review
          </p>
        </div>

        {/* Accuracy */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Accuracy
            </h3>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.accuracy}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Average review accuracy</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Across {stats.studyDays} study days
          </p>
        </div>

        {/* Streak */}
        <div className={`${commonClasses.card} p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Daily Streak
            </h3>
            <Award className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.currentStreak}
          </p>
          <p className="text-sm text-gray-500 mt-1">Consecutive days</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
            Longest streak: {stats.longestStreak} days
          </p>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <div className={`${commonClasses.card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Today's Progress
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {stats.todayProgress} / {stats.dailyGoal} words
            </p>
          </div>
          <Calendar className="w-6 h-6 text-indigo-500" />
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-4 rounded-full transition-all flex items-center justify-end pr-2"
            style={{ width: `${Math.min((stats.todayProgress / stats.dailyGoal) * 100, 100)}%` }}
          >
            {stats.todayProgress >= stats.dailyGoal && (
              <span className="text-xs font-semibold text-white">Goal!</span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {goalRemaining > 0
            ? `${goalRemaining} more words to reach your daily goal`
            : 'Daily goal achieved! Great job!'}
        </p>
      </div>

      {/* Weekly Activity (only real series available: /user/stats weekly_progress) */}
      <div className={`${commonClasses.card} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Last 7 Days
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-3 h-3 bg-indigo-500 rounded"></div>
            <span>Words studied</span>
          </div>
        </div>

        {weekly.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No activity data yet.
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-2 h-48">
            {weekly.map((value, index) => (
              <div key={index} className="flex flex-col items-center gap-1">
                <div className="flex-1 w-full flex flex-col justify-end">
                  <div
                    className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                    style={{ height: `${(value / weeklyMax) * 100}%` }}
                    title={`Words: ${value}`}
                  />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {labels[index]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Learning Setup (from GET /learning/stats) */}
      {learningStats && (
        <div className={`${commonClasses.card} p-6`}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Learning Setup
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <BookOpen className="w-8 h-8 text-indigo-500" />
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {learningStats.selected_libraries_count ?? 0} selected libraries
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Word sources for learning
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Languages className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {Array.isArray(learningStats.learning_languages) && learningStats.learning_languages.length > 0
                    ? learningStats.learning_languages.join(', ')
                    : '—'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Learning languages (native: {learningStats.native_language || '—'})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Target className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {learningStats.stats?.learning_words ?? 0} in progress
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {learningStats.stats?.new_words ?? 0} new • {learningStats.stats?.mastered_words ?? 0} mastered
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticsPanel;
