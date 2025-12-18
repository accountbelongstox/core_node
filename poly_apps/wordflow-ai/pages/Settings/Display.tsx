import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { LanguageCenter, SupportedLanguage } from '../../i18n/LanguageCenter';
import { api } from '../../services/api';

interface ThemeOption {
  id: 'light' | 'dark' | 'auto';
  name: string;
  icon: React.ReactNode;
  gradient: string;
}

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

const DisplaySettings = () => {
  const { settings, updateSettings, navigate, t } = useContext(AppContext);
  const [fontSize, setFontSize] = useState(parseInt(settings.display.fontSize) || 16);

  const themeOptions: ThemeOption[] = [
    {
      id: 'light',
      name: t('settings.light'),
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      gradient: 'from-yellow-400 to-orange-500',
    },
    {
      id: 'dark',
      name: t('settings.dark'),
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
      gradient: 'from-indigo-500 to-purple-600',
    },
    {
      id: 'auto',
      name: 'Auto',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      gradient: 'from-cyan-500 to-blue-600',
    },
  ];

  const toggleTheme = () => {
    const next = settings.display.theme === 'light' ? 'dark' : 'light';
    updateSettings({ display: { ...settings.display, theme: next } });
  };

  const setTheme = (theme: 'light' | 'dark' | 'auto') => {
    updateSettings({ display: { ...settings.display, theme } });
  };

  const handleInterfaceLanguageChange = (lang: SupportedLanguage) => {
    updateSettings({ language: { ...settings.language, appInterface: lang } });
    LanguageCenter.setLanguage(lang);
    api.setLanguage(lang);
    window.location.reload();
  };

  const handleFontSizeChange = (newSize: number) => {
    setFontSize(newSize);
    updateSettings({ display: { ...settings.display, fontSize: `${newSize}px` } });
  };

  const currentInterfaceLang = Array.isArray(settings.language.appInterface)
    ? settings.language.appInterface[0] || 'en'
    : (settings.language.appInterface || 'en');

  const supportedLanguages = LanguageCenter.getSupportedLanguages();
  const currentTheme = settings.display.theme || 'light';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('settings')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Back />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('settings.displayTheme')}
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Customize your visual experience
        </p>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Theme Selector */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Theme Mode
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setTheme(option.id)}
                className={`relative p-4 rounded-2xl border-2 transition-all ${
                  currentTheme === option.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-105 shadow-lg'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:scale-105 hover:border-blue-400'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 bg-gradient-to-br ${option.gradient} rounded-xl flex items-center justify-center text-white`}>
                    {option.icon}
                  </div>
                  <span className={`font-bold text-sm ${
                    currentTheme === option.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {option.name}
                  </span>
                  {currentTheme === option.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Theme Preview Card */}
          <Card className={`border-2 ${
            currentTheme === 'dark'
              ? 'bg-slate-900 border-slate-700'
              : 'bg-white border-slate-200'
          } overflow-hidden`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${currentTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Preview
                </span>
                <span className={`text-xs ${currentTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {currentTheme === 'auto' ? 'Follows system' : `${currentTheme} mode`}
                </span>
              </div>
              <div className={`h-20 rounded-lg ${
                currentTheme === 'dark'
                  ? 'bg-slate-800 border border-slate-700'
                  : 'bg-slate-50 border border-slate-200'
              } flex items-center justify-center`}>
                <span className={`text-sm ${currentTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  Sample content display
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Font Size */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Font Size
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-semibold text-slate-900 dark:text-white">Text Size</span>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">{fontSize}px</span>
              </div>

              {/* Font Size Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Small</span>
                  <span>Medium</span>
                  <span>Large</span>
                </div>
              </div>

              {/* Font Preview */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <p style={{ fontSize: `${fontSize}px` }} className="text-slate-900 dark:text-white">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Interface Language */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.appInterfaceLanguage')}
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4">
            <div className="grid grid-cols-3 gap-3">
              {supportedLanguages.map((lang) => {
                const isActive = currentInterfaceLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleInterfaceLanguageChange(lang.code)}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">{lang.flag}</span>
                      <span className={`font-bold text-xs text-center leading-tight ${
                        isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {lang.nativeName}
                      </span>
                      {isActive && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Reading Card Settings */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.readingCard')}
          </h2>

          <ToggleCard
            label={t('settings.showPhonetic')}
            description="Display pronunciation guide for words"
            value={settings.display.showPhonetic}
            onChange={(value) =>
              updateSettings({ display: { ...settings.display, showPhonetic: value } })
            }
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            }
          />

          <ToggleCard
            label={t('settings.showTranslation')}
            description="Show translations immediately in cards"
            value={settings.display.showTranslation}
            onChange={(value) =>
              updateSettings({ display: { ...settings.display, showTranslation: value } })
            }
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            }
          />

          <ToggleCard
            label={t('settings.animations')}
            description="Enable smooth transitions and animations"
            value={settings.display.enableAnimations}
            onChange={(value) =>
              updateSettings({ display: { ...settings.display, enableAnimations: value } })
            }
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border border-amber-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">Display Tips</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
                  <span>Auto theme follows your system preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
                  <span>Larger font sizes improve readability</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
                  <span>Disable animations to reduce motion</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DisplaySettings;
