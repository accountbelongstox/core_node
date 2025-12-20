/**
 * Settings Modal Component
 * Allows users to manage app settings (language, theme, etc.)
 */
import React, { useState } from 'react';
import { X, Globe, Moon, Sun, Bell, RefreshCw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPORTED_LANGUAGES } from '../services/i18nService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, theme, setTheme, settings, updateSettings, t } = useApp();

  const [localSettings, setLocalSettings] = useState(settings);

  if (!isOpen) return null;

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage as any);
    const newSettings = { ...localSettings, language: newLanguage };
    setLocalSettings(newSettings);
    updateSettings({ language: newLanguage });
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    const newSettings = { ...localSettings, theme: newTheme };
    setLocalSettings(newSettings);
    updateSettings({ theme: newTheme });
  };

  const handleToggleChange = (key: 'notifications' | 'autoRefresh', value: boolean) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    updateSettings({ [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* General Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
              {t('settings.general')}
            </h3>

            {/* Language Selection */}
            <div className="mb-6">
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Globe className="w-4 h-4 mr-2" />
                {t('settings.language')}
              </label>
              <div className="flex gap-3">
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => handleLanguageChange(code)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      language === code
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selection */}
            <div className="mb-6">
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 mr-2" />
                ) : (
                  <Sun className="w-4 h-4 mr-2" />
                )}
                {t('settings.theme')}
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                    theme === 'light'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  {t('settings.light')}
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                    theme === 'dark'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  {t('settings.dark')}
                </button>
              </div>
            </div>

            {/* Notifications Toggle */}
            <div className="mb-6">
              <label className="flex items-center justify-between">
                <span className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
                  <Bell className="w-4 h-4 mr-2" />
                  {t('settings.notifications')}
                </span>
                <button
                  onClick={() => handleToggleChange('notifications', !localSettings.notifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    localSettings.notifications ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localSettings.notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Auto Refresh Toggle */}
            <div className="mb-6">
              <label className="flex items-center justify-between">
                <span className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('settings.autoRefresh')}
                </span>
                <button
                  onClick={() => handleToggleChange('autoRefresh', !localSettings.autoRefresh)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    localSettings.autoRefresh ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localSettings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('settings.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
};
