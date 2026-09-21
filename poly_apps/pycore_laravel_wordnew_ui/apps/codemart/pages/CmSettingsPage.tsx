import React from 'react';
import { Languages, Moon, Palette, Sun } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { SHELL_LANGUAGES, ThemeId } from '../../../shell/shellTypes';
import { useTranslation } from '../../../core/i18n/UiI18n';

/**
 * CodeMart settings: language and appearance preferences routed through the
 * shared shell state (single owner), never a second local copy.
 */
export const CmSettingsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { dark, toggleDark, lang, setLang, themeOverride, setThemeOverride } = useShell();

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('settings.eyebrow')}</span>
        <h1>{t('nav.settings')}</h1>
        <p>{t('settings.description')}</p>
      </header>
      <section className="cm-dashboard-section">
        <h2><Languages aria-hidden="true" /> {t('settings.languageTitle')}</h2>
        <div className="cm-settings-row">
          <select value={lang} onChange={(event) => setLang(event.target.value)} aria-label={t('chrome.language')}>
            {SHELL_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>{language.label}</option>
            ))}
          </select>
        </div>
      </section>
      <section className="cm-dashboard-section">
        <h2>{dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />} {t('settings.appearanceTitle')}</h2>
        <div className="cm-settings-row">
          <button type="button" className="cm-workspace-button" onClick={toggleDark}>
            {dark ? t('chrome.lightMode') : t('chrome.darkMode')}
          </button>
        </div>
      </section>
      <section className="cm-dashboard-section">
        <h2><Palette aria-hidden="true" /> {t('settings.themeTitle')}</h2>
        <div className="cm-settings-row">
          <select
            value={themeOverride ?? 'auto'}
            onChange={(event) => setThemeOverride(event.target.value === 'auto' ? null : (event.target.value as ThemeId))}
            aria-label={t('settings.themeTitle')}
          >
            <option value="auto">{t('settings.themeAuto')}</option>
            <option value="nexus">Nexus</option>
            <option value="pycore">Pycore</option>
            <option value="iris">Iris</option>
          </select>
        </div>
      </section>
    </main>
  );
};

export default CmSettingsPage;
