/**
 * PcAppearanceControls — global dark/light toggle + language selector for the
 * pycore-manager top bar. State lives in the shell (useShell), so these stay
 * in sync with the floating ShellControls dock and the Settings page section.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Languages } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { SHELL_LANGUAGES } from '../../../shell/shellTypes';
import { useIsMobile } from '../hooks/useIsMobile';

const chipCls =
  'flex shrink-0 items-center gap-2 py-2 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02] hover:bg-slate-200/50 dark:hover:bg-white/[0.05] transition';

const PcAppearanceControls: React.FC = () => {
  const { t } = useTranslation('pc');
  const { dark, toggleDark, lang, setLang } = useShell();
  const isMobile = useIsMobile();
  const chipPadding = isMobile ? 'px-2' : 'px-3';

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={toggleDark}
        title={dark ? t('appearance.lightMode') : t('appearance.darkMode')}
        aria-label={dark ? t('appearance.lightMode') : t('appearance.darkMode')}
        className={`${chipCls} ${chipPadding}`}
      >
        {dark
          ? <Sun className="w-3.5 h-3.5 text-amber-500" />
          : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
      </button>
      <label className={`${chipCls} ${chipPadding} relative cursor-pointer`} title={t('appearance.language')}>
        <Languages className="w-3.5 h-3.5 text-sky-500 shrink-0" />
        {isMobile && (
          <span className="text-xs font-medium uppercase text-slate-700 dark:text-slate-200">{lang}</span>
        )}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label={t('appearance.language')}
          className={isMobile
            ? 'absolute inset-0 h-full w-full cursor-pointer opacity-0'
            : 'bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer'}
        >
          {SHELL_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="text-slate-700">{l.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default PcAppearanceControls;
