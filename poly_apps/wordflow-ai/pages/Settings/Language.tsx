import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { api } from '../../services/api';
import { ApiCenter } from '../../services/ApiCenter';
import { SupportedLanguage } from '../../types';
import { IconMappingService } from '../../services/IconMappingService';

interface ToggleSettingProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({ label, description, value, onChange }) => (
  <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="font-semibold text-slate-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        )}
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

const LanguageSettings = () => {
  const { navigate, settings, updateSettings, user, t } = useContext(AppContext);
  const [langs, setLangs] = useState<SupportedLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response: any = await api.getSupportedLanguages();

        let languages: SupportedLanguage[] = [];
        if (Array.isArray(response)) {
          languages = response;
        } else if (response && typeof response === 'object' && Array.isArray(response.data)) {
          languages = response.data;
        } else if (response && typeof response === 'object' && response.success && Array.isArray(response.data)) {
          languages = response.data;
        }

        if (languages.length > 0) {
          setLangs(languages);
          setError(null);
        } else {
          console.warn('[LanguageSettings] No languages received from API');
          setError(t('settings.noLanguagesAvailable'));
        }
      } catch (error) {
        console.error('[LanguageSettings] Failed to load languages:', error);
        setError(t('settings.failedToLoadLanguages'));
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

  const toggleLearningLang = async (code: string) => {
    let newLangs = [...(settings.language.learningLanguages || [])];
    if (newLangs.includes(code)) {
      newLangs = newLangs.filter(l => l !== code);
    } else {
      newLangs.push(code);
    }

    // Update global settings
    console.log('[LanguageSettings] Updating global settings with:', newLangs);
    updateSettings({ language: { ...settings.language, learningLanguages: newLangs } });

    // Sync to backend if user is logged in
    if (user) {
      try {
        console.log('[LanguageSettings] Syncing to backend...');
        const response = await ApiCenter.user.updateProfile({ learning_languages: newLangs });
        if (response.success) {
          console.log('[LanguageSettings] Backend sync successful');
        } else {
          console.error('[LanguageSettings] Backend sync failed:', response.error);
        }
      } catch (error) {
        console.error('[LanguageSettings] Failed to sync to backend:', error);
      }
    }
  };

  const getLanguageIcon = (lang: SupportedLanguage): string => {
    if (lang.icon) {
      return IconMappingService.getEmoji(lang.icon);
    }
    if (lang.flag) {
      return lang.flag;
    }
    const autoIconName = IconMappingService.getFlagIconName(lang.code);
    return IconMappingService.getEmoji(autoIconName, '🌐');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || langs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
        <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('settings')}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Icons.Back />
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {t('settings.languageAudio')}
            </h1>
          </div>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="font-semibold text-slate-900 dark:text-white mb-4">
              {error || t('settings.noLanguagesAvailable')}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              {t('settings.retry')}
            </button>
          </Card>
        </div>
      </div>
    );
  }

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
            {t('settings.languageAudio')}
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Choose languages to learn and configure audio settings
        </p>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Learning Languages Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.languagesToLearn')} ({settings.language.learningLanguages?.length || 0})
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4">
            <div className="grid grid-cols-3 gap-3">
              {langs.map(lang => {
                const isActive = settings.language.learningLanguages?.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    onClick={() => toggleLearningLang(lang.code)}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">{getLanguageIcon(lang)}</span>
                      <span className={`font-bold text-xs text-center leading-tight ${
                        isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {lang.native_name || lang.name}
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

        {/* Audio Settings Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.audioEngine')}
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0M13.5 9.5v5" />
                </svg>
                <span className="font-semibold text-slate-900 dark:text-white">{t('settings.voice')}</span>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {settings.audio?.voice || 'Default'}
              </span>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-semibold text-slate-900 dark:text-white">{t('settings.speed')}</span>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {settings.audio?.playbackSpeed || 1.0}x
              </span>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
                </svg>
                <span className="font-semibold text-slate-900 dark:text-white">{t('settings.volume')}</span>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {Math.round((settings.audio?.volume || 0.8) * 100)}%
              </span>
            </div>
          </Card>

          <ToggleSetting
            label={t('settings.autoPlay')}
            description="Automatically play pronunciation when viewing words"
            value={settings.audio?.autoPlay || false}
            onChange={(value) =>
              updateSettings({ audio: { ...settings.audio, autoPlay: value } })
            }
          />
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 border border-blue-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">Language Tips</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select multiple languages to learn simultaneously. Audio settings apply to all pronunciation features.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LanguageSettings;
