import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Button, Icons } from '../../components/UI';
import { ApiTestingCenter } from '../../components/ApiTestingCenter';

interface SettingItemProps {
  label: string;
  value?: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({ label, value, onClick, icon }) => (
  <Card
    onClick={onClick}
    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {icon && <div className="text-slate-600 dark:text-slate-400">{icon}</div>}
        <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {value && (
          <span className="text-sm text-slate-500 dark:text-slate-400">{value}</span>
        )}
        <Icons.ChevronRight />
      </div>
    </div>
  </Card>
);

const SettingsIndex = () => {
  const { navigate, user, logout, t } = useContext(AppContext);
  const [showApiTesting, setShowApiTesting] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('settings.settings')}
          </h1>
          <button
            onClick={() => navigate('home')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Close />
          </button>
        </div>

        {/* Profile Card */}
        <Card
          onClick={() => navigate('profile')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-white/30 overflow-hidden">
                <img
                  src={user?.avatar_url || user?.avatar}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-blue-600"></div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user?.name}</h2>
              <p className="text-blue-100 text-sm">
                {user?.isPro ? t('profile.proMember') : t('settings.freePlan')}
              </p>
            </div>
            <Icons.ChevronRight />
          </div>
        </Card>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Preferences Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.preferences')}
          </h2>
          <SettingItem
            label={t('settings.languageAudio')}
            value="En"
            onClick={() => navigate('settings_lang')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            }
          />
          <SettingItem
            label={t('settings.learningGoals')}
            value={`20${t('settings.perDay')}`}
            onClick={() => navigate('settings_learning')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <SettingItem
            label={t('settings.displayTheme')}
            value={t('settings.auto')}
            onClick={() => navigate('settings_display')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            }
          />
        </div>

        {/* System Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.system')}
          </h2>
          <SettingItem
            label={t('settings.apiServer')}
            value={t('settings.auto')}
            onClick={() => navigate('settings_api_server')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            }
          />
          <SettingItem
            label={t('settings.apiTesting')}
            value=""
            onClick={() => setShowApiTesting(true)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            }
          />
          <SettingItem
            label={t('settings.notifications')}
            value={t('settings.on')}
            onClick={() => navigate('settings_notifications')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            }
          />
          <SettingItem
            label={t('settings.dataSync')}
            value={t('settings.active')}
            onClick={() => navigate('settings_data')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />
          <SettingItem
            label={t('settings.privacySecurity')}
            value=""
            onClick={() => navigate('settings_privacy')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />
          <SettingItem
            label={t('settings.about')}
            value={`${t('settings.version')} 1.0`}
            onClick={() => navigate('settings_about')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Account Actions */}
        <div className="space-y-3 pt-6">
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                User ID: <span className="font-mono text-slate-900 dark:text-white">{user?.id}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                {t('settings.builtWith')} GEMINI
              </p>
            </div>
          </Card>

          <button
            onClick={logout}
            className="w-full px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
          >
            {t('settings.signOut')}
          </button>
        </div>
      </div>

      {/* API Testing Center Modal */}
      {showApiTesting && (
        <ApiTestingCenter onClose={() => setShowApiTesting(false)} />
      )}
    </div>
  );
};

export default SettingsIndex;
