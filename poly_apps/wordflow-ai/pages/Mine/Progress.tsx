import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';

interface LearningProgress {
  total_words: number;
  mastered_words: number;
  learning_words: number;
  review_due: number;
  current_streak: number;
  longest_streak: number;
  total_study_time: number;
  average_accuracy: number;
  daily_goal: number;
  today_progress: number;
}

export default function MineProgress() {
  const { user, navigate, t } = useContext(AppContext);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('weekly');

  useEffect(() => {
    if (user) {
      loadProgress();
    } else {
      navigate('login');
    }
  }, [user]);

  const loadProgress = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.user.getStatistics();
      if (result.success && result.data) {
        setProgress(result.data);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const progressPercentage = (progress.today_progress / progress.daily_goal) * 100;
  const retentionRate = progress.total_words > 0
    ? Math.round((progress.mastered_words / progress.total_words) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Learning Progress
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Track your learning journey
        </p>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Today's Progress */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">{t('home.todayGoal')}</p>
                <p className="text-4xl font-bold mt-1">{progress.today_progress}/{progress.daily_goal}</p>
                <p className="text-blue-100 text-xs mt-1">{t('home.words')}</p>
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-blue-300 flex items-center justify-center bg-blue-400/30">
                <span className="text-2xl font-bold">{Math.round(progressPercentage)}%</span>
              </div>
            </div>

            <div className="w-full bg-blue-400/30 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Timeframe Selector */}
        <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
          {(['daily', 'weekly', 'monthly', 'alltime'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {t(`stats.${tf}`)}
            </button>
          ))}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-purple-100 text-sm">Total Words</p>
              <p className="text-4xl font-bold mt-1">{progress.total_words}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-100 text-sm">Mastered</p>
              <p className="text-4xl font-bold mt-1">{progress.mastered_words}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
              <p className="text-orange-100 text-sm">Current Streak</p>
              <p className="text-4xl font-bold mt-1">{progress.current_streak}</p>
              <p className="text-orange-100 text-xs">days</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <div className="flex flex-col">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-blue-100 text-sm">Study Time</p>
              <p className="text-4xl font-bold mt-1">{Math.floor(progress.total_study_time / 60)}</p>
              <p className="text-blue-100 text-xs">hours</p>
            </div>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="space-y-3">
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('stats.accuracy')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{progress.average_accuracy}%</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t('stats.retention')}</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${retentionRate}%` }}
                  />
                </div>
                <p className="text-right text-sm font-semibold text-slate-900 dark:text-white mt-1">{retentionRate}%</p>
              </div>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Words Due for Review</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{progress.review_due}</p>
                </div>
              </div>
              {progress.review_due > 0 && (
                <button
                  onClick={() => navigate('learn/review')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Review
                </button>
              )}
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Longest Streak</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{progress.longest_streak} days</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
