/* [v4.1-Iris] Display Settings — ported from qy_capacitor/pages/Settings/Display.tsx.
 * Shell-driven: theme (light/dark/auto) drives useShell().setDark, and the app
 * UI language drives useShell().setLang (the shell owns these globally). The
 * display section (theme / fontSize / showAnimations) persists via
 * wfSettingsCenter; reading-card toggles remain local UI prefs. Self-contained;
 * Iris reference parity (design-reference-{light,dark}.webp). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, BackButton, SectionTitle } from '../WfUI';
import { useShell } from '../../../shell/ShellContext';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { getSupportedLanguages } from '../WfLanguageCenter';
import { wfSettingsCenter } from '../services/WfSettingsCenter';

type ThemeMode = 'light' | 'dark' | 'auto';
type FontBucket = 'small' | 'medium' | 'large';

const FONT_BUCKET_PX: Record<FontBucket, number> = { small: 14, medium: 16, large: 20 };
const pxToFontBucket = (px: number): FontBucket => (px <= 14 ? 'small' : px >= 19 ? 'large' : 'medium');

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

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const WfSettingsDisplayPage: React.FC = () => {
  const navigate = useNavigate();
  const { setDark, lang, setLang } = useShell();
  const { t } = useWfApp();

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => wfSettingsCenter.getSnapshot().display.theme);
  const [fontSize, setFontSize] = useState(16);
  const [showPhonetic, setShowPhonetic] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [enableAnimations, setEnableAnimations] = useState(true);

  // Hydrate the display section from the settings center on mount.
  useEffect(() => {
    let alive = true;
    wfSettingsCenter.load().then((s) => {
      if (!alive) return;
      setThemeMode(s.display.theme);
      setFontSize(FONT_BUCKET_PX[s.display.fontSize] ?? 16);
      setEnableAnimations(s.display.showAnimations);
    });
    return () => { alive = false; };
  }, []);

  // Apply the chosen theme to the global shell dark flag and persist it.
  const applyTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    wfSettingsCenter.update({ display: { theme: mode } });
    if (mode === 'auto') setDark(prefersDark());
    else setDark(mode === 'dark');
  };

  const changeFontSize = (px: number) => {
    setFontSize(px);
    wfSettingsCenter.update({ display: { fontSize: pxToFontBucket(px) } });
  };

  const changeAnimations = (value: boolean) => {
    setEnableAnimations(value);
    wfSettingsCenter.update({ display: { showAnimations: value } });
  };

  // When in auto mode, follow live OS theme changes.
  useEffect(() => {
    if (themeMode !== 'auto' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [themeMode, setDark]);

  const themeItems: { id: ThemeMode; label: string }[] = [
    { id: 'light', label: t('settings.light') },
    { id: 'dark', label: t('settings.dark') },
    { id: 'auto', label: t('settings.auto') },
  ];

  const supportedLanguages = getSupportedLanguages();

  return (
    <div className="min-h-screen pb-28">

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate(wfPath('settings'))} />
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.displayTheme')}
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)] pl-1">
          Customize your visual experience
        </p>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Theme Mode — segmented pill row */}
        <div className="space-y-3">
          <SectionTitle title={t('settings.themeMode')} className="px-1" />
          <div className="ds-pill-nav flex gap-1 p-1" role="tablist" aria-label={t('settings.themeMode')}>
            {themeItems.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={themeMode === item.id}
                onClick={() => applyTheme(item.id)}
                className={`ds-pill-chip flex-1 py-2.5 text-sm font-bold rounded-full transition-all ${
                  themeMode === item.id ? 'is-active text-white' : 'text-[var(--color-text-secondary)]'
                }`}
                style={themeMode === item.id ? { background: 'var(--klein-gradient)' } : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Theme Preview Card */}
          <div className="ds-card p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--color-text-primary)]">Preview</span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {themeMode === 'auto' ? 'Follows system' : `${themeMode} mode`}
                </span>
              </div>
              <div className="h-20 rounded-2xl bg-[var(--color-surface-variant)] border border-[var(--border-highlight)] flex items-center justify-center">
                <span className="text-sm text-[var(--color-text-secondary)]">Sample content display</span>
              </div>
            </div>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-3">
          <SectionTitle title={t('settings.fontSize')} className="px-1" />
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">Text Size</span>
                </div>
                <span className="text-sm text-[var(--klein-blue)] font-bold">{fontSize}px</span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  value={fontSize}
                  onChange={(e) => changeFontSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-[var(--color-glass-border)] rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: 'var(--klein-blue)' }}
                />
                <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
                  <span>Small</span>
                  <span>Medium</span>
                  <span>Large</span>
                </div>
              </div>

              <div className="p-4 bg-[var(--color-surface-variant)] rounded-2xl border border-[var(--border-highlight)]">
                <p style={{ fontSize: `${fontSize}px` }} className="text-[var(--color-text-primary)]">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Interface Language — drives the global shell language */}
        <div className="space-y-3">
          <SectionTitle title={t('settings.appInterfaceLanguage')} className="px-1" />
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {supportedLanguages.map((l) => {
                const isActive = lang === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`ds-touch-target relative p-4 rounded-2xl border transition-all min-w-0 ${
                      isActive
                        ? 'border-transparent text-white shadow-[var(--klein-grad-glow)]'
                        : 'bg-[var(--color-surface)] border-[var(--border-highlight)] hover:scale-105'
                    }`}
                    style={isActive ? { background: 'var(--klein-gradient)' } : undefined}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">{l.flag}</span>
                      <span className={`font-bold text-xs text-center leading-tight ${
                        isActive ? 'text-white' : 'text-[var(--color-text-secondary)]'
                      }`}>
                        {l.nativeName}
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

        {/* Reading Card Settings */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.readingCard')} className="px-1 mb-1" />

          <ToggleCard
            label={t('settings.showPhonetic')}
            description="Display pronunciation guide for words"
            value={showPhonetic}
            onChange={setShowPhonetic}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            }
          />

          <ToggleCard
            label={t('settings.showTranslation')}
            description="Show translations immediately in cards"
            value={showTranslation}
            onChange={setShowTranslation}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            }
          />

          <ToggleCard
            label={t('settings.animations')}
            description="Enable smooth transitions and animations"
            value={enableAnimations}
            onChange={changeAnimations}
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
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">Display Tips</h3>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Auto theme follows your system preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Larger font sizes improve readability</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
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

export default WfSettingsDisplayPage;
