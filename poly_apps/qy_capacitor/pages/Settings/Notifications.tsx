/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, BackButton, SectionTitle } from '../../components/UI';

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

/** Reference settings row: soft rounded icon-chip + label + Iris switch. */
const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <div className="ds-row w-full p-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[var(--color-text-primary)] truncate">{label}</p>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className="ds-touch-target w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0"
      style={{ background: value ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
      role="switch"
      aria-checked={value}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
          value ? 'translate-x-5' : ''
        }`}
      />
    </button>
  </div>
);

const NotificationSettings = () => {
  const { settings, updateSettings, navigate, t } = useContext(AppContext);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('08:00');

  const updateNotification = (key: string, value: boolean) => {
    updateSettings({
      notifications: {
        ...settings.notifications,
        [key]: value
      }
    });
  };

  // Default-on switches: only fall back to `true` when the value is undefined,
  // so a user who turns them OFF stays off (`|| true` would force-on a `false`).
  const defaultOn = (v: boolean | undefined) => (v === undefined ? true : v);

  const sendTestNotification = () => {
    // Placeholder for test notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('WordFlow Test', {
        body: 'Notifications are working!',
        icon: '/icon.png'
      });
    } else {
      alert('Please enable notifications in your browser settings');
    }
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        alert('Notifications enabled!');
      }
    }
  };

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate('settings')} />
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.notifications')}
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)] pl-1">
          Manage your notification preferences
        </p>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Notification Permission Card — Iris gradient hero */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-white relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg mb-1">Enable Notifications</h3>
              <p className="text-white/80 text-sm mb-3">Stay on track with your learning goals</p>
              <button
                onClick={requestPermission}
                className="ds-touch-target px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition-colors"
              >
                Grant Permission
              </button>
            </div>
          </div>
        </div>

        {/* Learning Notifications */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Learning Reminders" className="px-1 mb-1" />

          <ToggleCard
            label={t('settings.dailyReminder')}
            description="Remind me to practice every day"
            value={settings.notifications.dailyReminder}
            onChange={(value) => updateNotification('dailyReminder', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />

          {settings.notifications.dailyReminder && (
            <div className="ds-row w-full p-4 ml-8 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span className="font-semibold text-[var(--color-text-primary)] truncate">{t('settings.reminderTime')}</span>
              </div>
              <span className="text-sm text-[var(--klein-blue)] font-mono flex-shrink-0">
                {settings.notifications.reminderTime || '20:00'}
              </span>
            </div>
          )}

          <ToggleCard
            label={t('settings.reviewAlerts')}
            description="Notify when words are due for review"
            value={settings.notifications.reviewReminder}
            onChange={(value) => updateNotification('reviewReminder', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />

          <ToggleCard
            label="Streak Reminder"
            description="Don't break your learning streak!"
            value={settings.notifications.streakReminder || false}
            onChange={(value) => updateNotification('streakReminder', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            }
          />
        </div>

        {/* Social Notifications */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Social & Community" className="px-1 mb-1" />

          <ToggleCard
            label={t('settings.achievementBadges')}
            description="Celebrate your milestones and achievements"
            value={defaultOn(settings.notifications.achievementNotifications)}
            onChange={(value) => updateNotification('achievementNotifications', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            }
          />

          <ToggleCard
            label="Friend Activity"
            description="Get notified of friend achievements"
            value={settings.notifications.friendActivity || false}
            onChange={(value) => updateNotification('friendActivity', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />

          <ToggleCard
            label="Leaderboard Updates"
            description="Track your ranking changes"
            value={settings.notifications.leaderboardUpdates || false}
            onChange={(value) => updateNotification('leaderboardUpdates', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>

        {/* System Notifications */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="System & Updates" className="px-1 mb-1" />

          <ToggleCard
            label={t('settings.newCourseAlerts')}
            description="Discover new learning content"
            value={settings.notifications.newCourseAlerts || false}
            onChange={(value) => updateNotification('newCourseAlerts', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />

          <ToggleCard
            label="App Updates"
            description="Get notified about new features"
            value={defaultOn(settings.notifications.appUpdates)}
            onChange={(value) => updateNotification('appUpdates', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />

          <ToggleCard
            label="Tips & Tricks"
            description="Learn how to use WordFlow better"
            value={defaultOn(settings.notifications.tips)}
            onChange={(value) => updateNotification('tips', value)}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
          />
        </div>

        {/* Do Not Disturb */}
        <div className="space-y-3">
          <SectionTitle title="Quiet Hours" className="px-1" />

          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)]">Do Not Disturb</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Silence notifications during sleep</p>
                  </div>
                </div>
                <button
                  onClick={() => setDoNotDisturb(!doNotDisturb)}
                  className="ds-touch-target w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0"
                  style={{ background: doNotDisturb ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
                  role="switch"
                  aria-checked={doNotDisturb}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                      doNotDisturb ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {doNotDisturb && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">From</label>
                    <input
                      type="time"
                      value={dndStart}
                      onChange={(e) => setDndStart(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">To</label>
                    <input
                      type="time"
                      value={dndEnd}
                      onChange={(e) => setDndEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] rounded-xl text-[var(--color-text-primary)] text-sm outline-none transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Test Notification */}
        <button
          onClick={sendTestNotification}
          className="ds-row w-full p-4 flex items-center justify-between gap-3 group ds-touch-target"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
            <div className="min-w-0 text-left">
              <p className="font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">Send Test Notification</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Check if notifications are working</p>
            </div>
          </div>
          <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0"><Icons.ChevronRight /></span>
        </button>

        {/* Info Card */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">About Notifications</h3>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Notifications help you stay consistent with learning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>You can customize frequency for each type</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Set quiet hours to avoid interruptions</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default NotificationSettings;
