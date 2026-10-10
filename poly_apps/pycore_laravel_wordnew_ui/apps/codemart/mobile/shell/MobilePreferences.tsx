import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useShell } from '../../../../shell/ShellContext';
import { SHELL_LANGUAGES } from '../../../../shell/shellTypes';
import { CM_LANGUAGES } from '../../cm-locales';
import { MobileSegmented } from '../ui/MobileSegmented';

type MobileAppearance = 'light' | 'dark';

/** Language and light/dark switches on the shared shell state, for the drawer and the signed-out sheet. */
export const MobilePreferences: React.FC = () => {
  const { t } = useTranslation('cm');
  const { dark, setDark, lang, setLang } = useShell();
  const languages = SHELL_LANGUAGES.filter((language) => CM_LANGUAGES.includes(language.code));

  return (
    <div className="cmm-prefs">
      <MobileSegmented
        ariaLabel={t('chrome.language')}
        value={lang}
        onChange={setLang}
        options={languages.map((language) => ({ value: language.code, label: language.label }))}
      />
      <MobileSegmented<MobileAppearance>
        ariaLabel={t('settings.appearanceTitle')}
        value={dark ? 'dark' : 'light'}
        onChange={(value) => setDark(value === 'dark')}
        options={[
          { value: 'light', label: <><Sun aria-hidden="true" /> {t('chrome.lightMode')}</> },
          { value: 'dark', label: <><Moon aria-hidden="true" /> {t('chrome.darkMode')}</> },
        ]}
      />
    </div>
  );
};
