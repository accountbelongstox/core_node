import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {icon && <div className="text-slate-600 dark:text-slate-400">{icon}</div>}
        <div className="flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{label}</p>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full p-1 transition-colors ${
          value ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
            value ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  </Card>
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

  const sendTestNotification = () => {
    // Placeholder for test notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('WordFlow Test', {
        body: 'Notifications are working! 🎉',
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
        alert('Notifications enabled! 🎉');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('settings')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Back />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('settings.notifications')}
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your notification preferences
        </p>
      </div>

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-6 space-y-6">
        {/* Notification Permission Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Enable Notifications</h3>
              <p className="text-blue-100 text-sm mb-3">Stay on track with your learning goals</p>
              <button
                onClick={requestPermission}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
              >
                Grant Permission
              </button>
            </div>
          </div>
        </Card>

        {/* Learning Notifications */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Learning Reminders
          </h2>

          <ToggleCard
            label={t('settings.dailyReminder')}
            description="Remind me to practice every day"
            value={settings.notifications.dailyReminder}
            onChange={(value) => updateNotification('dailyReminder', value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />

          {settings.notifications.dailyReminder && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 ml-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-slate-900 dark:text-white">{t('settings.reminderTime')}</span>
                </div>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-mono">
                  {settings.notifications.reminderTime || '20:00'}
                </span>
              </div>
            </Card>
          )}

          <ToggleCard
            label={t('settings.reviewAlerts')}
            description="Notify when words are due for review"
            value={settings.notifications.reviewReminder}
            onChange={(value) => updateNotification('reviewReminder', value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            }
          />
        </div>

        {/* Social Notifications */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Social & Community
          </h2>

          <ToggleCard
            label={t('settings.achievementBadges')}
            description="Celebrate your milestones and achievements"
            value={settings.notifications.achievementNotifications || true}
            onChange={(value) => updateNotification('achievementNotifications', value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>

        {/* System Notifications */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            System & Updates
          </h2>

          <ToggleCard
            label={t('settings.newCourseAlerts')}
            description="Discover new learning content"
            value={settings.notifications.newCourseAlerts || false}
            onChange={(value) => updateNotification('newCourseAlerts', value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />

          <ToggleCard
            label="App Updates"
            description="Get notified about new features"
            value={settings.notifications.appUpdates || true}
            onChange={(value) => updateNotification('appUpdates', value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />

          <ToggleCard
            label="Tips & Tricks"
            description="Learn how to use WordFlow better"
            value={settings.notifications.tips || true}
            onChange={(value) => updateNotification('tips', value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
          />
        </div>

        {/* Do Not Disturb */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Quiet Hours
          </h2>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-slate-700">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">Do Not Disturb</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Silence notifications during sleep</p>
                  </div>
                </div>
                <button
                  onClick={() => setDoNotDisturb(!doNotDisturb)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors ${
                    doNotDisturb ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
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
                    <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">From</label>
                    <input
                      type="time"
                      value={dndStart}
                      onChange={(e) => setDndStart(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">To</label>
                    <input
                      type="time"
                      value={dndEnd}
                      onChange={(e) => setDndEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Test Notification */}
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={sendTestNotification}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-slate-900 dark:text-white">Send Test Notification</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Check if notifications are working</p>
              </div>
            </div>
            <Icons.ChevronRight />
          </button>
        </Card>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border border-amber-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">About Notifications</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
                  <span>Notifications help you stay consistent with learning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
                  <span>You can customize frequency for each type</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
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
