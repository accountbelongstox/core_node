import React from 'react';
import { Link } from 'react-router-dom';
import { Languages, Moon, Palette, Sun, UserRound } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { SHELL_LANGUAGES, ThemeId } from '../../../shell/shellTypes';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmPageHeader } from '../components/workspace/CmPageHeader';

const THEME_IDS: ThemeId[] = ['nexus', 'pycore', 'iris'];
const AUTO_THEME = 'auto';

/**
 * CodeMart settings: language and appearance preferences routed through the
 * shared shell state (single owner), never a second local copy.
 */
export const CmSettingsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { dark, setDark, lang, setLang, themeOverride, setThemeOverride } = useShell();

  return (
    <main className="cm-workspace-page">
      <CmPageHeader eyebrowKey="settings.eyebrow" titleKey="nav.settings" purposeKey="settings.description" />
      <div className="cm-settings-grid">
        <section className="cm-section-card">
          <h2><Languages aria-hidden="true" /> {t('settings.languageTitle')}</h2>
          <p className="cm-section-card__lead">{t('settings.languageLead')}</p>
          <label className="cm-stacked-field">
            <span>{t('chrome.language')}</span>
            <select value={lang} onChange={(event) => setLang(event.target.value)}>
              {SHELL_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>{language.label}</option>
              ))}
            </select>
          </label>
        </section>
        <section className="cm-section-card">
          <h2>{dark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />} {t('settings.appearanceTitle')}</h2>
          <p className="cm-section-card__lead">{t('settings.appearanceLead')}</p>
          <div className="cm-segmented" role="radiogroup" aria-label={t('settings.appearanceTitle')}>
            <button type="button" role="radio" aria-checked={!dark} className={!dark ? 'is-active' : ''} onClick={() => setDark(false)}>
              <Sun aria-hidden="true" /> {t('chrome.lightMode')}
            </button>
            <button type="button" role="radio" aria-checked={dark} className={dark ? 'is-active' : ''} onClick={() => setDark(true)}>
              <Moon aria-hidden="true" /> {t('chrome.darkMode')}
            </button>
          </div>
        </section>
        <section className="cm-section-card">
          <h2><Palette aria-hidden="true" /> {t('settings.themeTitle')}</h2>
          <p className="cm-section-card__lead">{t('settings.themeLead')}</p>
          <label className="cm-stacked-field">
            <span>{t('settings.themeTitle')}</span>
            <select
              value={themeOverride ?? AUTO_THEME}
              onChange={(event) => setThemeOverride(event.target.value === AUTO_THEME ? null : (event.target.value as ThemeId))}
            >
              <option value={AUTO_THEME}>{t('settings.themeAuto')}</option>
              {THEME_IDS.map((themeId) => (
                <option key={themeId} value={themeId}>{t(`settings.themes.${themeId}`)}</option>
              ))}
            </select>
          </label>
        </section>
        <section className="cm-section-card">
          <h2><UserRound aria-hidden="true" /> {t('settings.accountTitle')}</h2>
          <p className="cm-section-card__lead">{t('settings.accountLead')}</p>
          <div className="cm-table-actions">
            <Link to="/codemart/profile" className="cm-workspace-button">{t('nav.profile')}</Link>
            <Link to="/codemart/verification" className="cm-workspace-button">{t('nav.verification')}</Link>
          </div>
        </section>
      </div>
    </main>
  );
};

export default CmSettingsPage;
