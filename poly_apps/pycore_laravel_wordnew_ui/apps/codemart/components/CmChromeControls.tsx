import React from 'react';
import { Languages, Moon, Smartphone, Sun } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { SHELL_LANGUAGES } from '../../../shell/shellTypes';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CM_LANGUAGES } from '../cm-locales';
import { cmDefaultUiMode, setCmUiMode, useCmUiMode } from '../shared/cmUiMode';

/**
 * CodeMart top-right chrome: shared-shell language switcher and dark/light
 * toggle, exposed directly on the CodeMart surfaces (public header, workspace
 * top bar, admin top bar) in addition to the floating shell dock.
 */
export const CmChromeControls: React.FC<{ inverse?: boolean }> = ({ inverse = false }) => {
  const { dark, toggleDark, lang, setLang } = useShell();
  const { t } = useTranslation('cm');
  const uiMode = useCmUiMode();
  const leftTheApp = uiMode === 'web' && cmDefaultUiMode() === 'mobile';

  return (
    <div className={`cm-chrome-controls ${inverse ? 'is-inverse' : ''}`}>
      {leftTheApp && (
        <button type="button" className="cm-chrome-controls__button cm-chrome-controls__app" onClick={() => setCmUiMode(null)}>
          <Smartphone aria-hidden="true" />
          <span>{t('mobile.shell.backToApp')}</span>
        </button>
      )}
      <button
        type="button"
        className="cm-chrome-controls__button"
        onClick={toggleDark}
        aria-label={dark ? t('chrome.lightMode') : t('chrome.darkMode')}
        title={dark ? t('chrome.lightMode') : t('chrome.darkMode')}
      >
        {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </button>
      <label className="cm-chrome-controls__language">
        <Languages aria-hidden="true" />
        <select
          value={lang}
          onChange={(event) => setLang(event.target.value)}
          aria-label={t('chrome.language')}
        >
          {SHELL_LANGUAGES.filter((language) => CM_LANGUAGES.includes(language.code)).map((language) => (
            <option key={language.code} value={language.code}>{language.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default CmChromeControls;
