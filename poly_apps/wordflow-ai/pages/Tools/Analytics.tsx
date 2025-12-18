import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';

interface AnalyticsData {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  weakWords: number;
  totalStudyTime: number;
  averageAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  dailyAverage: number;
  weeklyProgress: number[];
}

export default function ToolsAnalytics() {
  const { user, navigate, t } = useContext(AppContext);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    if (user) {
      loadAnalytics();
    } else {
      setLoading(false);
    }
  }, [user, timeframe]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.user.getStatistics();
      if (result.success && result.data) {
        setAnalytics({
          totalWords: result.data.total_words_learned || 0,
          masteredWords: result.data.mastered_words || 0,
          learningWords: result.data.learning_words || 0,
          weakWords: result.data.weak_words || 0,
          totalStudyTime: result.data.total_study_time || 0,
          averageAccuracy: result.data.average_accuracy || 0,
          currentStreak: result.data.current_streak || 0,
          longestStreak: result.data.longest_streak || 0,
          dailyAverage: result.data.daily_average || 0,
          weeklyProgress: result.data.weekly_progress || [0, 0, 0, 0, 0, 0, 0],
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 flex items-center justify-center">
        <Card className="mx-6 max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-8">
          <Icons.Lock />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4 mb-2">
            Login Required
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Please login to view your learning analytics
          </p>
          <button
            onClick={() => navigate('login')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            {t('auth.login')}
          </button>
        </Card>
      </div>
    );
  }

  if (loading || !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const masteryPercentage = analytics.totalWords > 0
    ? Math.round((analytics.masteredWords / analytics.totalWords) * 100)
    : 0;

  const maxWeeklyValue = Math.max(...analytics.weeklyProgress, 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Learning Analytics
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Track your progress and insights
            </p>
          </div>

          {/* Timeframe Selector */}
          <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
            {(['week', 'month', 'year'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <Icons.Book />
              <p className="text-blue-100 text-sm mt-2">Total Words</p>
              <p className="text-4xl font-bold mt-1">{analytics.totalWords}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-100 text-sm mt-2">Mastered</p>
              <p className="text-4xl font-bold mt-1">{analytics.masteredWords}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-orange-100 text-sm mt-2">Study Time</p>
              <p className="text-4xl font-bold mt-1">{Math.floor(analytics.totalStudyTime / 60)}</p>
              <p className="text-orange-100 text-xs">hours</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <Icons.Sparkles />
              <p className="text-purple-100 text-sm mt-2">Streak</p>
              <p className="text-4xl font-bold mt-1">{analytics.currentStreak}</p>
              <p className="text-purple-100 text-xs">days</p>
            </div>
          </Card>
        </div>

        {/* Weekly Progress Chart */}
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white mb-4">
            Weekly Activity
          </h2>
          <div className="flex items-end justify-between gap-2 h-32">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
              const value = analytics.weeklyProgress[index];
              const height = (value / maxWeeklyValue) * 100;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t-lg relative" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{day}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-500">{value}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Mastery Progress */}
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white mb-4">
            Vocabulary Mastery
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 dark:text-slate-400">Mastered</span>
                <span className="font-bold text-slate-900 dark:text-white">{masteryPercentage}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${masteryPercentage}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.masteredWords}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Mastered</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.learningWords}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Learning</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{analytics.weakWords}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Weak</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-4">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{analytics.averageAccuracy}%</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Avg Accuracy</p>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-4">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{analytics.dailyAverage}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Daily Average</p>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-4">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{analytics.longestStreak}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Best Streak</p>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-4">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {Math.round(analytics.totalStudyTime / 60 / 7)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Hours/Week</p>
          </Card>
        </div>

        {/* Insights Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <Icons.Sparkles />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">AI Insights</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>You're learning {analytics.dailyAverage} words per day on average</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Your mastery rate is {masteryPercentage}%, keep up the good work!</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Current streak: {analytics.currentStreak} days. Try to beat your record of {analytics.longestStreak} days!</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
