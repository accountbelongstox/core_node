import React from 'react';
import { Languages, Moon, Sun } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { SHELL_LANGUAGES } from '../../../shell/shellTypes';
import { useTranslation } from '../../../core/i18n/UiI18n';

/**
 * CodeMart top-right chrome: shared-shell language switcher and dark/light
 * toggle, exposed directly on the CodeMart surfaces (public header, workspace
 * top bar, admin top bar) in addition to the floating shell dock.
 */
export const CmChromeControls: React.FC<{ inverse?: boolean }> = ({ inverse = false }) => {
  const { dark, toggleDark, lang, setLang } = useShell();
  const { t } = useTranslation('cm');

  return (
    <div className={`cm-chrome-controls ${inverse ? 'is-inverse' : ''}`}>
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
          {SHELL_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>{language.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default CmChromeControls;
