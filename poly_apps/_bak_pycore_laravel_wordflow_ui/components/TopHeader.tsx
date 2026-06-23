import React from 'react';
import { Power, Sun, Moon, Languages, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiEndpointSwitcher } from './ApiEndpointSwitcher';
import { useAppState } from '../contexts/AppStateContext';
import { APP_NAME, APP_VERSION } from '../constants';

interface TopHeaderProps {
  pageTitle: string;
  isLoggedIn: boolean;
  onAuthClick: () => void;
}

/**
 * Right-side top bar. Sticks to the top when the main content scrolls.
 * Rendered inside the main content column (next to the fixed Sidebar).
 */
const TopHeader: React.FC<TopHeaderProps> = ({ pageTitle, isLoggedIn, onAuthClick }) => {
  const { lang, theme, toggleLang, toggleTheme } = useAppState();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 min-h-16 flex flex-wrap items-center justify-between px-4 sm:px-6 py-2 gap-3 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md transition-colors duration-300 flex-shrink-0">
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 dark:text-white truncate">
          {pageTitle}
        </h1>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono whitespace-nowrap flex-shrink-0">
          {APP_NAME} {APP_VERSION}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] ${isLoggedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className={`${isLoggedIn ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-500'} whitespace-nowrap`}>
            {isLoggedIn ? t('header.system_online') : t('header.system_offline')}
          </span>
        </div>

        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 hidden sm:block" />

        <div className="flex items-center gap-2">
          <ApiEndpointSwitcher />
          <button
            onClick={() => toggleLang(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            title="Switch Language"
          >
            <Languages size={18} />
          </button>
          <button
            onClick={() => toggleTheme(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-amber-500 dark:hover:text-yellow-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 hidden sm:block" />

        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoggedIn && (
            <div className="hidden lg:flex items-center gap-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <span className="text-xs">{t('header.logged_in_as')}</span>
              <span className="text-slate-800 dark:text-white font-bold text-xs">adminroot</span>
            </div>
          )}
          <button
            onClick={onAuthClick}
            className={`
              px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all flex items-center gap-1.5 border font-semibold text-xs sm:text-sm flex-shrink-0
              ${isLoggedIn
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-500 border-red-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-lg shadow-indigo-500/20'}
            `}
          >
            {isLoggedIn ? (
              <>
                <Power size={14} /> <span className="hidden sm:inline whitespace-nowrap">{t('header.logout')}</span>
              </>
            ) : (
              <>
                <LogIn size={14} /> <span className="whitespace-nowrap">{t('header.login')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
