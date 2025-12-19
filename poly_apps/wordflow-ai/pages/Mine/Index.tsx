import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';

export default function MineIndex() {
  const { user, navigate, t } = useContext(AppContext);
  const [stats, setStats] = useState({
    totalWords: 0,
    masteredWords: 0,
    currentStreak: 0,
    totalStudyTime: 0
  });

  useEffect(() => {
    if (user) {
      loadUserStats();
    }
  }, [user]);

  const loadUserStats = async () => {
    try {
      const result = await ApiCenter.user.getStatistics();
      if (result.success && result.data) {
        setStats({
          totalWords: result.data.total_words_learned || 0,
          masteredWords: result.data.mastered_words || 0,
          currentStreak: result.data.current_streak || 0,
          totalStudyTime: result.data.total_study_time || 0
        });
      }
    } catch (error: any) {
      if (error?.message?.includes('not found') || error?.code === 'HTTP_404') {
        console.log('[Mine] User statistics endpoint not implemented yet');
      } else {
        console.error('[Mine] Failed to load user stats:', error);
      }
    }
  };

  const menuItems = [
    {
      id: 'profile',
      title: t('profile.profile'),
      subtitle: 'Personal information and settings',
      icon: <Icons.User />,
      route: 'profile',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'progress',
      title: t('reading.progress'),
      subtitle: 'View your learning analytics',
      icon: <Icons.Chart />,
      route: 'mine/progress',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'social',
      title: t('social.friends'),
      subtitle: 'Friends and leaderboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      route: 'social/friends',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'settings',
      title: t('nav.settings'),
      subtitle: 'App preferences and account',
      icon: <Icons.Settings />,
      route: 'settings',
      color: 'from-slate-500 to-slate-600'
    },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
        {/* Header */}
        <div className="pt-20 px-6 pb-8 max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {t('home.welcomeGuest')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('home.guestMode')}
          </p>
        </div>

        <div className="max-w-md mx-auto px-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl">
            <div className="text-center py-4">
              <svg className="w-16 h-16 mx-auto mb-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h2 className="text-2xl font-bold mb-2">{t('home.loginRequired')}</h2>
              <p className="text-blue-100 mb-6">{t('home.syncProgressDescription')}</p>
              <button
                onClick={() => navigate('login')}
                className="w-full px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors"
              >
                {t('auth.login')}
              </button>
              <button
                onClick={() => navigate('register')}
                className="w-full mt-3 px-6 py-3 bg-blue-400 text-white rounded-xl font-bold hover:bg-blue-500 transition-colors"
              >
                {t('auth.register')}
              </button>
            </div>
          </Card>

          {/* Guest Access */}
          <div className="mt-6 space-y-4">
            <Card
              onClick={() => navigate('settings')}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                    <Icons.Settings />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{t('nav.settings')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">App preferences</p>
                  </div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header with User Info */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-none shadow-xl">
          <div className="flex items-center gap-4">
            <img
              src={user.avatar_url || user.avatar}
              alt={user.username}
              className="w-20 h-20 rounded-full border-4 border-white/30"
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{user.username}</h2>
              {user.email && (
                <p className="text-white/80 text-sm mt-1">{user.email}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">
                  {t('profile.freePlan')}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-3">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalWords}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Words</p>
          </Card>
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-3">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.masteredWords}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Mastered</p>
          </Card>
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-3">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.currentStreak}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Streak</p>
          </Card>
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-3">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{Math.floor(stats.totalStudyTime / 60)}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Hours</p>
          </Card>
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <Card
              key={item.id}
              onClick={() => navigate(item.route)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center text-white`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-bold text-lg text-slate-900 dark:text-white">{item.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{item.subtitle}</p>
                  </div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
