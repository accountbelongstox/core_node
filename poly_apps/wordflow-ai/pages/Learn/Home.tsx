import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';

interface LearningStats {
  wordsLearned: number;
  currentStreak: number;
  todayGoal: number;
  todayProgress: number;
}

interface RecentActivity {
  id: string;
  type: 'reading' | 'flashcard' | 'quiz' | 'listening';
  title: string;
  progress: number;
  lastAccessed: string;
}

export default function LearnHome() {
  const { user, navigate, t } = useContext(AppContext);
  const [stats, setStats] = useState<LearningStats>({
    wordsLearned: 0,
    currentStreak: 0,
    todayGoal: 20,
    todayProgress: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLearningData();
  }, [user]);

  const loadLearningData = async () => {
    setLoading(true);
    try {
      if (user) {
        // Load actual user statistics
        const statsResult = await ApiCenter.learning.getStats(user.id);
        if (statsResult.success && statsResult.data) {
          setStats({
            wordsLearned: statsResult.data.total_words_learned || 0,
            currentStreak: statsResult.data.current_streak || 0,
            todayGoal: statsResult.data.daily_goal || 20,
            todayProgress: statsResult.data.today_progress || 0
          });
        }
      }
    } catch (error) {
      console.error('Failed to load learning data:', error);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = (stats.todayProgress / stats.todayGoal) * 100;

  const learningModes = [
    {
      id: 'reading',
      title: t('home.reading'),
      subtitle: t('home.flowContext'),
      icon: <Icons.Book />,
      color: 'from-blue-500 to-blue-600',
      route: 'learn/practice?mode=reading'
    },
    {
      id: 'flashcards',
      title: t('home.flashcards'),
      subtitle: t('home.spacedRepetition'),
      icon: <Icons.Sparkles />,
      color: 'from-purple-500 to-purple-600',
      route: 'learn/practice?mode=flashcards'
    },
    {
      id: 'quiz',
      title: t('home.quiz'),
      subtitle: t('home.gamifiedTest'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-green-500 to-green-600',
      route: 'learn/practice?mode=quiz'
    },
    {
      id: 'listening',
      title: t('nav.listening'),
      subtitle: t('home.passive') + ' - ' + t('home.audioLoop'),
      icon: <Icons.Sound />,
      color: 'from-orange-500 to-orange-600',
      route: 'learn/practice?mode=listening'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-8 max-w-md mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {user ? t('home.hiUser').replace('{name}', user.username) : t('home.welcomeGuest')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('home.welcome')}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Today's Progress Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">{t('home.todayGoal')}</p>
                <p className="text-3xl font-bold mt-1">{stats.todayProgress}/{stats.todayGoal}</p>
                <p className="text-blue-100 text-xs mt-1">{t('home.words')}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="w-16 h-16 rounded-full border-4 border-blue-300 flex items-center justify-center bg-blue-400/30">
                  <span className="text-xl font-bold">{Math.round(progressPercentage)}%</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-blue-400/30 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col">
              <p className="text-slate-600 dark:text-slate-400 text-sm">{t('home.wordsLearned')}</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.wordsLearned}</p>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col">
              <p className="text-slate-600 dark:text-slate-400 text-sm">{t('home.currentStreak')}</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.currentStreak}</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{t('home.days')}</p>
            </div>
          </Card>
        </div>

        {/* Continue Learning Section */}
        {recentActivities.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white px-1">
              {t('home.continueReading')}
            </h2>
            {recentActivities.map((activity) => (
              <Card
                key={activity.id}
                onClick={() => navigate(`learn/practice?mode=${activity.type}&resume=${activity.id}`)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Icons.Book />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{activity.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{activity.progress}% complete</p>
                  </div>
                  <Icons.ChevronRight />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Learning Modes */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white px-1">
            {t('home.startLearning')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {learningModes.map((mode) => (
              <Card
                key={mode.id}
                onClick={() => navigate(mode.route)}
                className={`bg-gradient-to-br ${mode.color} text-white border-none shadow-lg cursor-pointer hover:scale-105 transition-transform`}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    {mode.icon}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{mode.title}</p>
                    <p className="text-xs text-white/80 mt-1">{mode.subtitle}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            onClick={() => navigate('learn/library')}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Library />
            <span>{t('home.library')}</span>
          </button>

          <button
            onClick={() => navigate('learn/review')}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Sparkles />
            <span>{t('home.reviewWords')}</span>
          </button>
        </div>

        {/* Guest Mode Prompt */}
        {!user && (
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-bold text-lg">{t('home.syncYourProgress')}</p>
                <p className="text-purple-100 text-sm mt-1">{t('home.syncProgressDescription')}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('login')}
              className="w-full mt-4 px-6 py-3 bg-white text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-colors"
            >
              {t('home.loginNow')}
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
