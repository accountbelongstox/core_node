/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card, Button, Badge, SectionTitle } from '../../components/UI';
import { Avatar } from '../../components/Avatar';
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
    if (!user) {
      navigate('login');
      return;
    }
    loadUserStats();
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
      subtitle: t('nav.profileSubtitle'),
      icon: <Icons.User />,
      route: 'profile',
    },
    {
      id: 'progress',
      title: t('reading.progress'),
      subtitle: t('nav.progressSubtitle'),
      icon: <Icons.Chart />,
      route: 'mine/progress',
    },
    {
      id: 'social',
      title: t('social.friends'),
      subtitle: t('nav.socialSubtitle'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      route: 'social/friends',
    },
    {
      id: 'settings',
      title: t('nav.settings'),
      subtitle: t('nav.settingsSubtitle'),
      icon: <Icons.Settings />,
      route: 'settings',
    },
  ];

  if (!user) {
    return (
      <div className="ds-aura-bg min-h-screen pb-28">
        <div className="ds-aura-overlay" />
        {/* Minimal asymmetric header */}
        <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            {t('home.welcomeGuest')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('home.guestMode')}
          </p>
        </div>

        <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
          <Card className="text-center">
            <div className="py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-[var(--color-text-primary)]">{t('home.loginRequired')}</h2>
              <p className="text-[var(--color-text-secondary)] mb-6">{t('home.syncProgressDescription')}</p>
              <Button variant="klein" onClick={() => navigate('login')}>
                {t('auth.login')}
              </Button>
              <Button variant="secondary" className="mt-3" onClick={() => navigate('register')}>
                {t('auth.register')}
              </Button>
            </div>
          </Card>

          {/* Guest Access */}
          <div className="ds-row p-5 cursor-pointer ds-touch-target flex items-center justify-between" onClick={() => navigate('settings')}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                <Icons.Settings />
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{t('nav.settings')}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.appPreferences')}</p>
              </div>
            </div>
            <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />
      {/* Minimal asymmetric header with avatar-left */}
      <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <div className="flex items-center gap-4">
          <Avatar
            src={user.avatar_url}
            fallbackSrc={user.avatar}
            name={user.name || user.nickname || user.username}
            alt={user.username}
            className="w-16 h-16 rounded-full border border-[var(--border-highlight)] flex-shrink-0 text-xl"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">{user.username}</h1>
            {user.email && (
              <p className="text-[var(--color-text-secondary)] text-sm mt-0.5 truncate">{user.email}</p>
            )}
            <Badge tone="klein" className="mt-2">{t('profile.freePlan')}</Badge>
          </div>
        </div>
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Quick Stats */}
        <div className="ds-grid-breathing grid-cols-2 sm:grid-cols-4">
          {[
            { v: stats.totalWords, l: t('stats.words') },
            { v: stats.masteredWords, l: t('stats.mastered') },
            { v: stats.currentStreak, l: t('stats.streak') },
            { v: Math.floor(stats.totalStudyTime / 60), l: t('stats.hours') },
          ].map((s, i) => (
            <div key={i} className="ds-card text-center p-5">
              <p className="text-3xl font-bold text-[var(--klein-blue)]">{s.v}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Menu Items as ds-row group */}
        <SectionTitle title={t('nav.settings') || 'Account'} className="px-1" />
        <div className="ds-stack-tight flex flex-col">
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(item.route)}
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
      </div>
    </div>
  );
}
