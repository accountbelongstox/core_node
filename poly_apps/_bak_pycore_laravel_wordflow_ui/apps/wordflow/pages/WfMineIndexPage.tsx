/* [v4.1-Iris] Mine Center — ported from poly_apps/qy_capacitor/pages/Mine/Index.tsx.
 * Self-contained: reads the profile from wordflowApi + useWfApp(), react-router
 * useNavigate + wfPath() for nav. Guest + signed-in variants. Every call is
 * try/caught and degrades to zeroed stats. Faithful Iris look (asymmetric
 * header, quick-stat grid, ds-row menu group). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Icons, Card, Button, Badge, SectionTitle, Sheet, ProgressBar } from '../WfUI';
import { useWfApp, useWfT } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfUserCenter } from '../services/WfUserCenter';
import { notify } from '../../../core/notify/notify';

const WfMineIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useWfApp();
  const { t } = useWfT();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    notify.success(t('auth.logoutSuccess') || 'Logged out');
    navigate(wfPath('auth/login'));
  };

  const [stats, setStats] = useState({
    totalWords: 0,
    masteredWords: 0,
    currentStreak: 0,
    studyDays: 0,
    todayProgress: 0,
    dailyGoal: 0,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      // Primary source — GET /user/statistics (the original Mine/Index data
      // source: total_words_learned / mastered_words / current_streak /
      // study_days / today_progress / daily_goal). total_study_time is NOT
      // surfaced: the backend has no time tracking yet and always reports 0.
      // Falls back to the cached profile when unavailable.
      try {
        const result = await wordflowApi.request<any>('/user/statistics');
        if (!cancelled && result && typeof result === 'object') {
          setStats({
            totalWords: result.total_words_learned ?? result.total_words ?? 0,
            masteredWords: result.mastered_words ?? 0,
            currentStreak: result.current_streak ?? 0,
            studyDays: result.study_days ?? 0,
            todayProgress: result.today_progress ?? 0,
            dailyGoal: result.daily_goal ?? 0,
          });
          return;
        }
      } catch (e: any) {
        if (e?.status === 404) {
          console.log('[WfMine] /user/statistics not implemented yet');
        } else {
          console.error('[WfMine] failed to load user statistics:', e);
        }
      }
      try {
        const profile = await wordflowApi.getUserProfile();
        if (!cancelled && profile) {
          setStats({
            totalWords: profile.total_words ?? profile.totalLearned ?? 0,
            masteredWords: profile.mastered_words ?? 0,
            currentStreak: profile.streak ?? 0,
            studyDays: 0,
            todayProgress: 0,
            dailyGoal: 0,
          });
        }
      } catch (e) {
        console.error('[WfMine] failed to load profile stats:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const menuItems = [
    { id: 'profile', title: t('profile.profile') || 'Profile', subtitle: t('nav.profileSubtitle') || 'Account details', icon: <Icons.User />, route: 'profile' },
    { id: 'progress', title: t('reading.progress') || 'Progress', subtitle: t('nav.progressSubtitle') || 'Your learning journey', icon: <Icons.Chart />, route: 'mine/progress' },
    {
      id: 'social',
      title: t('social.friends') || 'Friends',
      subtitle: t('nav.socialSubtitle') || 'Connect & compete',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      route: 'mine/social',
    },
    { id: 'settings', title: t('nav.settings') || 'Settings', subtitle: t('nav.settingsSubtitle') || 'App preferences', icon: <Icons.Settings />, route: 'settings' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen pb-28">
        <div className="relative pt-16 px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">{t('home.welcomeGuest') || 'Welcome'}</h1>
          <p className="text-[var(--color-text-secondary)]">{t('home.guestMode') || 'Guest mode'}</p>
        </div>

        <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
          <Card className="text-center">
            <div className="py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
                <Icons.User />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-[var(--color-text-primary)]">{t('home.loginRequired') || 'Login Required'}</h2>
              <p className="text-[var(--color-text-secondary)] mb-6">{t('home.syncProgressDescription') || 'Sync your progress across devices.'}</p>
              <Button variant="klein" onClick={() => navigate(wfPath('auth/login'))}>
                {t('auth.login') || 'Log in'}
              </Button>
              <Button variant="secondary" className="mt-3" onClick={() => navigate(wfPath('auth/login'))}>
                {t('auth.register') || 'Register'}
              </Button>
            </div>
          </Card>

          <div
            className="ds-row p-5 cursor-pointer ds-touch-target flex items-center justify-between"
            onClick={() => navigate(wfPath('settings'))}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                <Icons.Settings />
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{t('nav.settings') || 'Settings'}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.appPreferences') || 'App preferences'}</p>
              </div>
            </div>
            <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
          </div>
        </div>
      </div>
    );
  }

  const avatarLetter = (user.name || user.nickname || user.username || user.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen pb-28">
      <div className="relative pt-16 px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <div className="flex items-center gap-4">
          {user.avatar_url || user.avatar ? (
            <img
              src={user.avatar_url || user.avatar}
              alt={user.username}
              className="w-16 h-16 rounded-full border border-[var(--border-highlight)] flex-shrink-0 object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border border-[var(--border-highlight)] flex-shrink-0 flex items-center justify-center text-xl font-bold bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
              {avatarLetter}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">
              {user.username || user.nickname || user.name}
            </h1>
            {user.email && (
              <p className="text-[var(--color-text-secondary)] text-sm mt-0.5 truncate">{user.email}</p>
            )}
            <Badge tone="klein" className="mt-2">
              {wfUserCenter.isPro(user)
                ? wfUserCenter.getPlanLabel(user)
                : (t('profile.freePlan') || 'Free plan')}
            </Badge>
          </div>
        </div>
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Quick stats */}
        <div className="ds-grid-breathing grid-cols-2 sm:grid-cols-4">
          {[
            { v: stats.totalWords, l: t('stats.words') || 'Words' },
            { v: stats.masteredWords, l: t('stats.mastered') || 'Mastered' },
            { v: stats.currentStreak, l: t('stats.streak') || 'Streak' },
            { v: stats.studyDays, l: t('stats.days') || 'Days' },
          ].map((s, i) => (
            <div key={i} className="ds-card text-center p-5">
              <p className="text-3xl font-bold text-[var(--klein-blue)]">{s.v}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Today's goal — real today_progress / per-user daily_goal from
            /user/statistics; hidden until the endpoint reports a goal. */}
        {stats.dailyGoal > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[var(--color-text-primary)]">{t('home.todayGoal') || "Today's Goal"}</h3>
              <span className="text-sm font-semibold text-[var(--klein-blue)]">
                {Math.min(stats.todayProgress, stats.dailyGoal)} / {stats.dailyGoal}
              </span>
            </div>
            <ProgressBar value={stats.todayProgress} max={stats.dailyGoal} />
          </Card>
        )}

        {/* Menu */}
        <SectionTitle title={t('nav.account') || 'Account'} className="px-1" />
        <div className="ds-stack-tight flex flex-col">
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(wfPath(item.route))}
              className="ds-row p-5 cursor-pointer ds-touch-target flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                  {item.icon}
                </div>
                <div>
                  <p className="font-bold text-lg text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{item.subtitle}</p>
                </div>
              </div>
              <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
            </div>
          ))}
        </div>

        {/* Logout */}
        <div className="pt-2">
          <div
            onClick={() => setShowLogoutConfirm(true)}
            className="ds-row p-5 cursor-pointer ds-touch-target flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-500/10 text-red-500">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-lg text-red-500">{t('auth.logout') || 'Log out'}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('profile.logoutConfirmMessage') || 'Sign out of your account'}</p>
              </div>
            </div>
            <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
          </div>
        </div>
      </div>

      {/* Logout confirmation */}
      <Sheet open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} position="center" panelClassName="animate-slide-up">
        <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{t('profile.logoutConfirmTitle') || 'Log out?'}</h3>
        <p className="text-[var(--color-text-secondary)] mb-6">{t('profile.logoutConfirmMessage') || 'You will need to sign in again to access your account.'}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)} className="flex-1">
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="danger" onClick={confirmLogout} className="flex-1">
            {t('auth.logout') || 'Log out'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

export default WfMineIndexPage;
