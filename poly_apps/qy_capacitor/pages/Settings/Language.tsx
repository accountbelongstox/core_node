/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Button, BackButton, LoadingState, SectionTitle } from '../../components/UI';
import { Globe, AlertTriangle, Lock } from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { IconMappingService } from '../../services/IconMappingService';
import { LanguagesCenter } from '../../services/LanguagesCenter';
import { StudyGroupsCenter } from '../../services/StudyGroupsCenter';
import { ApiCenter } from '../../services/ApiCenter';
import { ToastService } from '../../services/ToastService';

interface ToggleSettingProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({ label, description, value, onChange, icon }) => (
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

const AudioRow: React.FC<{ label: string; value: React.ReactNode; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="ds-row w-full p-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] [&_svg]:w-5 [&_svg]:h-5">
        {icon}
      </span>
      <span className="font-semibold text-[var(--color-text-primary)] truncate">{label}</span>
    </div>
    <span className="text-sm text-[var(--color-text-tertiary)] flex-shrink-0">{value}</span>
  </div>
);

const LanguageSettings = () => {
  const { navigate, settings, updateSettings, user, t } = useContext(AppContext);
  const [langs, setLangs] = useState<SupportedLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to LanguagesCenter for automatic updates
  useEffect(() => {
    const unsubscribe = LanguagesCenter.subscribe((languages) => {
      if (languages.length > 0) {
        setLangs(languages);
        setError(null);
      } else {
        console.warn('[LanguageSettings] No languages available');
        setError(t('settings.noLanguagesAvailable'));

        // Show toast with action button to login
        if (!user) {
          ToastService.showWithAction(
            t('settings.noLanguagesAvailable'),
            t('common.confirm'),
            () => {
              navigate('login');
            },
            'long'
          );
        }
      }
      setLoading(false);
    });

    // Initialize (fetch from cache or API)
    LanguagesCenter.initialize().catch(err => {
      console.error('[LanguageSettings] Failed to load languages:', err);
      setError(t('settings.failedToLoadLanguages'));
      setLoading(false);
    });

    return unsubscribe;
  }, [t, user, navigate]);

  const toggleLearningLang = async (code: string) => {
    // Check if user is logged in - learning languages require authentication
    if (!user) {
      if (window.confirm(t('settings.loginRequired') || 'Please login to manage your learning languages. Go to login page?')) {
        navigate('login');
      }
      return;
    }

    const oldLangs = Array.isArray(settings.language.learningLanguages)
      ? [...settings.language.learningLanguages]
      : [];
    let newLangs = [...oldLangs];
    const isAdding = !newLangs.includes(code);

    if (isAdding) {
      newLangs.push(code);
    } else {
      newLangs = newLangs.filter(l => l !== code);
    }

    // Update global settings
    console.log('[LanguageSettings] Updating global settings with:', newLangs);
    updateSettings({ language: { ...settings.language, learningLanguages: newLangs } });

    // [Added] If adding a new language, immediately create the recitation group for that language
    if (isAdding && user) {
      try {
        console.log('[LanguageSettings] Creating study group for language:', code);

        // 1. Create on the frontend first (optimistic update)
        const newGroup = await StudyGroupsCenter.createLanguageGroup(code);

        if (newGroup) {
          console.log('[LanguageSettings] Study group created successfully:', newGroup.id);
        } else {
          console.warn('[LanguageSettings] Failed to create study group for:', code);
        }
      } catch (error) {
        console.error('[LanguageSettings] Error creating study group:', error);
      }
    }

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

  // Render the language's flag glyph. Genuine API-provided flag/icon content
  // (lang.flag / lang.icon) is real locale data and may stay as-is; when no
  // flag is supplied we fall back to a lucide Globe icon — never an emoji
  // affordance (per v4.1 §3.10).
  const renderLanguageIcon = (lang: SupportedLanguage, active: boolean): React.ReactNode => {
    const flag = lang.icon ? IconMappingService.getEmoji(lang.icon, '') : lang.flag;
    if (flag) {
      return <span className="text-3xl leading-none">{flag}</span>;
    }
    return (
      <Globe
        className={`w-7 h-7 ${active ? 'text-white' : 'text-[var(--klein-blue)]'}`}
        aria-hidden
      />
    );
  };

  const learningLanguages = Array.isArray(settings.language.learningLanguages)
    ? settings.language.learningLanguages
    : [];
  const safeLangs = Array.isArray(langs) ? langs : [];

  if (loading) {
    return (
      <div className="ds-aura-bg min-h-screen pb-28 flex items-center justify-center">
        <div className="ds-aura-overlay" />
        <div className="relative">
          <LoadingState label="Loading languages..." />
        </div>
      </div>
    );
  }

  if (error || safeLangs.length === 0) {
    return (
      <div className="ds-aura-bg min-h-screen pb-28">
        <div className="ds-aura-overlay" />
        <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
          <div className="flex items-center gap-3 mb-6">
            <BackButton onClick={() => navigate('settings')} />
            <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
              {t('settings.languageAudio')}
            </h1>
          </div>

          <Card className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] shadow-sm">
              <AlertTriangle className="w-8 h-8" aria-hidden />
            </div>
            <p className="font-semibold text-[var(--color-text-primary)] mb-4">
              {error || t('settings.noLanguagesAvailable')}
            </p>
            <Button variant="grad" onClick={() => window.location.reload()}>
              {t('settings.retry')}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate('settings')} />
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.languageAudio')}
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)] pl-1">
          Choose languages to learn and configure audio settings
        </p>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Learning Languages Section - Only show if user is logged in */}
        {user ? (
          <div className="space-y-3">
            <SectionTitle
              title={`${t('settings.languagesToLearn')} (${learningLanguages.length})`}
              className="px-1"
            />

            <Card className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {safeLangs.map(lang => {
                  const isActive = learningLanguages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => toggleLearningLang(lang.code)}
                      className={`ds-touch-target relative p-4 rounded-2xl border transition-all min-w-0 ${
                        isActive
                          ? 'border-transparent text-white shadow-[var(--klein-grad-glow)]'
                          : 'bg-[var(--color-surface)] border-[var(--border-highlight)] hover:scale-105'
                      }`}
                      style={isActive ? { background: 'var(--klein-gradient)' } : undefined}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="flex items-center justify-center h-9">{renderLanguageIcon(lang, isActive)}</span>
                        <span className={`font-bold text-xs text-center leading-tight ${
                          isActive ? 'text-white' : 'text-[var(--color-text-secondary)]'
                        }`}>
                          {lang.native_name || lang.name}
                        </span>
                        {isActive && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-white/25 rounded-full flex items-center justify-center">
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
        ) : (
          <div className="space-y-3">
            <SectionTitle title={t('settings.languagesToLearn')} className="px-1" />

            <Card className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] shadow-sm">
                <Lock className="w-7 h-7" aria-hidden />
              </div>
              <p className="font-semibold text-[var(--color-text-primary)] mb-2">
                {t('settings.loginRequired') || 'Login Required'}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {t('settings.loginToManageLanguages') || 'Please login to manage your learning languages'}
              </p>
              <Button variant="grad" onClick={() => navigate('login')}>
                {t('auth.login') || 'Login'}
              </Button>
            </Card>
          </div>
        )}

        {/* Audio Settings Section */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.audioEngine')} className="px-1 mb-1" />

          <AudioRow
            label={t('settings.voice')}
            value={settings.audio?.voice || 'Default'}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0M13.5 9.5v5" />
              </svg>
            }
          />

          <AudioRow
            label={t('settings.speed')}
            value={`${settings.audio?.playbackSpeed || 1.0}x`}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />

          <AudioRow
            label={t('settings.volume')}
            value={`${Math.round((settings.audio?.volume || 0.8) * 100)}%`}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
              </svg>
            }
          />

          <ToggleSetting
            label={t('settings.autoPlay')}
            description="Automatically play pronunciation when viewing words"
            value={settings.audio?.autoPlay || false}
            onChange={(value) =>
              updateSettings({ audio: { ...settings.audio, autoPlay: value } })
            }
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Info Card */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">Language Tips</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
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
