import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';
import { api } from '../../services/api';
import { ApiCenter } from '../../services/ApiCenter';
import { SupportedLanguage } from '../../types';
import { IconMappingService } from '../../services/IconMappingService';

const LanguageSettings = () => {
  // [i18n] Added `t` function for multi-language support
  const { settings, updateSettings, user, setUser, t } = useContext(AppContext);
  const [langs, setLangs] = useState<SupportedLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response: any = await api.getSupportedLanguages();
        
        // Handle different response formats
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
          // [i18n] Replaced hardcoded "No languages available" with t()
          setError(t('settings.noLanguagesAvailable'));
        }
      } catch (error) {
        console.error('[LanguageSettings] Failed to load languages:', error);
        // [i18n] Replaced hardcoded error message with t()
        setError(t('settings.failedToLoadLanguages'));
        // Don't set empty array, this ensures we don't show mock data accidentally
      } finally {
        setLoading(false);
      }
    };
    
    fetchLanguages();
  }, []);

  const toggleLearningLang = async (code: string) => {
      if (!user) return;
      let newLangs = [...(user.learningLanguages || [])];
      if (newLangs.includes(code)) {
          newLangs = newLangs.filter(l => l !== code);
      } else {
          newLangs.push(code);
      }

      setUser({ ...user, learningLanguages: newLangs });

      try {
          const response = await ApiCenter.user.updateProfile({ learning_languages: newLangs });
          if (response.success && response.data?.user) {
              setUser(response.data.user);
              console.log('[LanguageSettings] Learning languages updated successfully:', newLangs);
          }
      } catch (error) {
          console.error('[LanguageSettings] Failed to update learning languages:', error);
          setUser({ ...user, learningLanguages: user.learningLanguages || [] });
      }
  };

  // Helper function to get icon display
  const getLanguageIcon = (lang: SupportedLanguage): string => {
    // Priority 1: Use icon field from backend (generic name)
    if (lang.icon) {
      return IconMappingService.getEmoji(lang.icon);
    }
    // Priority 2: Use flag field (backward compatibility)
    if (lang.flag) {
      return lang.flag;
    }
    // Priority 3: Auto-generate from language code
    const autoIconName = IconMappingService.getFlagIconName(lang.code);
    return IconMappingService.getEmoji(autoIconName, '🌐');
  };

  if (loading) {
    return (
      // [i18n] Replaced hardcoded title with t()
      <SettingsLayout title={t('settings.languageAudio')}>
        <div className="flex items-center justify-center py-20">
          {/* [i18n] Replaced hardcoded "Loading languages..." with t() */}
          <div className="text-slate-400 dark:text-slate-500">{t('settings.loadingLanguages')}</div>
        </div>
      </SettingsLayout>
    );
  }

  if (error || langs.length === 0) {
    return (
      // [i18n] Replaced hardcoded title with t()
      <SettingsLayout title={t('settings.languageAudio')}>
        <div className="flex flex-col items-center justify-center py-20 px-5">
          <div className="text-red-500 dark:text-red-400 mb-4 text-center">
            {/* [i18n] Error message now uses t() from state */}
            {error || t('settings.noLanguagesAvailable')}
          </div>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              api.getSupportedLanguages().then((response: any) => {
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
                  // [i18n] Replaced hardcoded error with t()
                  setError(t('settings.noLanguagesAvailable'));
                }
              }).catch((err) => {
                // [i18n] Replaced hardcoded error with t()
                setError(t('settings.failedToLoadLanguages'));
              }).finally(() => {
                setLoading(false);
              });
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {/* [i18n] Replaced hardcoded "Retry" with t() */}
            {t('settings.retry')}
          </button>
        </div>
      </SettingsLayout>
    );
  }

  return (
    // [i18n] Replaced hardcoded title with t()
    <SettingsLayout title={t('settings.languageAudio')}>
      <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-2 mb-4 pl-2">
        {/* [i18n] Replaced hardcoded "Languages to Learn (Multi-select)" with t() */}
        {t('settings.languagesToLearn')}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-8">
        {langs.map(l => {
          const isActive = user?.learningLanguages?.includes(l.code);
          return (
            <div
              key={`learn-${l.code}`}
              onClick={() => toggleLearningLang(l.code)}
              className={`
                relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300
                flex flex-col items-center justify-center gap-2 min-h-[100px]
                ${isActive
                  ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30 scale-105'
                  : 'bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-700/60 hover:scale-105'
                }
              `}
            >
              <span className="text-3xl">{getLanguageIcon(l)}</span>
              <span className={`font-bold text-xs text-center leading-tight ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                {l.native_name || l.name}
              </span>
              {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* [i18n] Replaced hardcoded "Audio Engine" with t() */}
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">{t('settings.audioEngine')}</div>
      {/* [i18n] Replaced hardcoded labels with t() */}
      <SettingItem label={t('settings.voice')} value={settings.audio?.voice || 'default'} />
      <SettingItem label={t('settings.speed')} value={`${settings.audio?.playbackSpeed || 1.0}x`} />
      <SettingItem label={t('settings.volume')} value={`${Math.round((settings.audio?.volume || 0.8) * 100)}%`} />
      <SettingItem label={t('settings.autoPlay')} type="toggle" active={settings.audio?.autoPlay || false} onClick={() => updateSettings({ audio: { ...settings.audio, autoPlay: !settings.audio?.autoPlay } })} />
    </SettingsLayout>
  );
};

export default LanguageSettings;
