/* [v4.1-Iris] Language & Audio Settings — ported from
 * qy_capacitor/pages/Settings/Language.tsx. Learning languages are a true
 * multi-select (like the original) persisted to the backend via
 * GET/POST /learning/languages; the shell's active learningLanguage is kept in
 * sync. The native language persists to the wfSettingsCenter `language` section
 * and audio prefs read/write the wfSettingsCenter `audio` section. The
 * supported-language list is fetched from wordflowApi.getSupportedLanguages()
 * with a graceful fallback to the local Wf_LANGUAGE_CONFIGS. Self-contained;
 * Iris reference parity. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, BackButton, LoadingState, SectionTitle } from '../WfUI';
import { Globe, Lock } from 'lucide-react';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { getSupportedLanguages, WfLanguageConfig } from '../WfLanguageCenter';
import { wfSettingsCenter, WfAppSettings } from '../services/WfSettingsCenter';

interface LangOption {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

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
        {description && <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{description}</p>}
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className="ds-touch-target w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0"
      style={{ background: value ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
      role="switch"
      aria-checked={value}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${value ? 'translate-x-5' : ''}`} />
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

/** Normalize whatever shape the backend returns into LangOption[]. */
function normalizeLanguages(raw: any): LangOption[] {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.languages) ? raw.languages : [];
  return list
    .map((l: any) => ({
      code: l.code || l.language_code || l.lang_code || '',
      name: l.name || l.english_name || l.code || '',
      nativeName: l.native_name || l.nativeName || l.name || l.code || '',
      flag: l.flag || l.icon,
    }))
    .filter((l: LangOption) => !!l.code);
}

const FALLBACK: LangOption[] = getSupportedLanguages().map((c: WfLanguageConfig) => ({
  code: c.code,
  name: c.name,
  nativeName: c.nativeName,
  flag: c.flag,
}));

const WfSettingsLanguagePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, learningLanguage, setLearningLanguage, t } = useWfApp();
  const [langs, setLangs] = useState<LangOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings store (audio prefs + native language) — load + live subscription.
  const [settings, setSettings] = useState<WfAppSettings>(wfSettingsCenter.getSnapshot());

  // Learning languages multi-select (backend-persisted, original behavior).
  const [learningLanguages, setLearningLanguages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    wfSettingsCenter.load().then((s) => { if (!cancelled) setSettings(s); }).catch(() => {});
    const unsubscribe = wfSettingsCenter.subscribe((s) => setSettings(s));
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await wordflowApi.getSupportedLanguages();
        const normalized = normalizeLanguages(raw);
        if (!cancelled) setLangs(normalized.length ? normalized : FALLBACK);
      } catch (e) {
        console.error('[WfSettingsLanguage] Failed to load languages:', e);
        if (!cancelled) setLangs(FALLBACK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load the user's learning languages from GET /learning/languages, falling
  // back to the profile copy / the shell's single active language.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fallback = Array.isArray(user.learning_languages) && user.learning_languages.length > 0
      ? user.learning_languages
      : Array.isArray(user.learningLanguages) && user.learningLanguages.length > 0
        ? user.learningLanguages
        : learningLanguage ? [learningLanguage] : [];
    (async () => {
      try {
        const res = await wordflowApi.request<any>('/learning/languages');
        // Live-verified shape: data.{ learning_languages: [...], native_language }.
        const list = Array.isArray(res?.learning_languages)
          ? res.learning_languages
          : Array.isArray(res?.languages) ? res.languages : Array.isArray(res) ? res : [];
        if (!cancelled) setLearningLanguages(list.length ? list : fallback);
      } catch (e) {
        console.warn('[WfSettingsLanguage] GET /learning/languages failed, using profile fallback:', e);
        if (!cancelled) setLearningLanguages(fallback);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** Toggle a learning language (multi-select) and sync to the backend. */
  const toggleLearningLang = async (code: string) => {
    if (!user) return;
    const isAdding = !learningLanguages.includes(code);
    const next = isAdding ? [...learningLanguages, code] : learningLanguages.filter((l) => l !== code);
    setLearningLanguages(next);

    // Keep the shell's single active learning language pointing at a selection.
    if (isAdding) {
      setLearningLanguage(code);
    } else if (learningLanguage === code && next.length > 0) {
      setLearningLanguage(next[0]);
    }

    try {
      // Live-verified param: the backend validates `learning_languages`
      // (422 "The learning languages field is required." for `languages`).
      await wordflowApi.request('/learning/languages', {
        method: 'POST',
        body: JSON.stringify({ learning_languages: next }),
      });
    } catch (e) {
      console.error('[WfSettingsLanguage] Failed to sync learning languages:', e);
    }
  };

  /** Persist the native language to the wfSettingsCenter language section. */
  const handleNativeLanguageChange = (code: string) => {
    wfSettingsCenter.update({ language: { nativeLanguage: code } }).catch((e) => {
      console.error('[WfSettingsLanguage] Failed to persist native language:', e);
    });
  };

  /** Persist autoplay to the wfSettingsCenter audio section. */
  const handleAutoPlayChange = (value: boolean) => {
    wfSettingsCenter.update({ audio: { autoPlay: value } }).catch((e) => {
      console.error('[WfSettingsLanguage] Failed to persist autoPlay:', e);
    });
  };

  const renderLanguageIcon = (lang: LangOption, active: boolean): React.ReactNode => {
    if (lang.flag) return <span className="text-3xl leading-none">{lang.flag}</span>;
    return <Globe className={`w-7 h-7 ${active ? 'text-white' : 'text-[var(--klein-blue)]'}`} aria-hidden />;
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-28 flex items-center justify-center">
        <div className="relative">
          <LoadingState label="Loading languages..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate(wfPath('settings'))} />
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.languageAudio')}
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)] pl-1">
          Choose languages to learn and configure audio settings
        </p>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Learning Language Section - requires login */}
        {user ? (
          <div className="space-y-3">
            <SectionTitle title={`${t('settings.languagesToLearn')} (${learningLanguages.length})`} className="px-1" />
            <Card className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {langs.map((lang) => {
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
                          {lang.nativeName || lang.name}
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
                {t('settings.loginRequired')}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {t('settings.loginToManageLanguages')}
              </p>
              <Button variant="grad" onClick={() => navigate(wfPath('auth/login'))}>
                {t('auth.login')}
              </Button>
            </Card>
          </div>
        )}

        {/* Native Language Section — persisted to wfSettingsCenter.language */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('profile.nativeLanguage') || 'Native Language'} className="px-1 mb-1" />
          <div className="ds-row w-full p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                <Globe className="w-5 h-5" aria-hidden />
              </span>
              <span className="font-semibold text-[var(--color-text-primary)] truncate">
                {t('settings.nativeLanguageHint') || 'Translations target this language'}
              </span>
            </div>
            <select
              value={settings.language.nativeLanguage}
              onChange={(e) => handleNativeLanguageChange(e.target.value)}
              className="p-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] focus:border-[var(--klein-blue)] focus:ring-2 focus:ring-[var(--klein-ring)] outline-none text-sm text-[var(--color-text-primary)] transition-all flex-shrink-0 max-w-[10rem]"
              aria-label={t('profile.nativeLanguage') || 'Native Language'}
            >
              {!langs.some((l) => l.code === settings.language.nativeLanguage) && (
                <option value={settings.language.nativeLanguage}>{settings.language.nativeLanguage}</option>
              )}
              {langs.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName || lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audio Settings Section */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.audioEngine')} className="px-1 mb-1" />

          <AudioRow
            label={t('settings.voice')}
            value={settings.audio.voice || 'Default'}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0M13.5 9.5v5" />
              </svg>
            }
          />
          <AudioRow
            label={t('settings.speed')}
            value={`${settings.audio.playbackSpeed || 1.0}x`}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <AudioRow
            label={t('settings.volume')}
            value={`${Math.round((settings.audio.volume ?? 0.8) * 100)}%`}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
              </svg>
            }
          />

          <ToggleSetting
            label={t('settings.autoPlay')}
            description="Automatically play pronunciation when viewing words"
            value={settings.audio.autoPlay}
            onChange={handleAutoPlayChange}
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

export default WfSettingsLanguagePage;
