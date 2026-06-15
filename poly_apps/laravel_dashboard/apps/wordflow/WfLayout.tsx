/* [v4.1-Iris] WfLayout — wordflow app shell (top bar + content + bottom island).
 * Ported from poly_apps/qy_capacitor/components/AppLayout.tsx + TopBar.tsx,
 * self-contained. The minimal asymmetric app bar (avatar-left, glass search
 * pill + gradient filter orb, theme/lang/settings controls right) is matched to
 * design-reference-{light,dark}.webp. Theme/dark/language come from the shell;
 * user/auth from useWfApp(). All nav targets /wordflow/... via wfPath(). The
 * aura background lives in WfApp; this renders <Outlet/> for the matched route. */
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Globe } from 'lucide-react';
import { useShell } from '../../shell/ShellContext';
import { Icons } from './WfUI';
import { useWfApp, useWfT } from './WfAppContext';
import { wfPath } from './WfBottomTabNav';
import { WfBottomTabNav } from './WfBottomTabNav';
import { getSupportedLanguages } from './WfLanguageCenter';

const TOP_BAR_HEIGHT = 72;

const WfTopBar: React.FC<{ onSearchClick?: () => void }> = ({ onSearchClick }) => {
  const navigate = useNavigate();
  const { dark, toggleDark, lang, setLang } = useShell();
  const { user } = useWfApp();
  const { t } = useWfT();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 px-[max(var(--page-padding-h),env(safe-area-inset-left,0px))] pr-[max(var(--page-padding-h),env(safe-area-inset-right,0px))] pt-[env(safe-area-inset-top,0px)] pb-2"
    >
      <div className="w-full rounded-full flex items-center gap-2 sm:gap-3 px-2 py-2 ds-glass ds-glass-edge">
        {/* Avatar / login */}
        <button
          type="button"
          onClick={() => navigate(wfPath(user ? 'profile' : 'auth/login'))}
          className="cursor-pointer shrink-0 group relative block flex-shrink-0"
          aria-label={user ? t('header.profile') : t('header.login')}
        >
          {user && (user.avatar_url || user.avatar) ? (
            <img
              src={user.avatar_url || user.avatar}
              alt=""
              className="w-10 h-10 rounded-full border-2 border-white/40 dark:border-slate-600 shadow-sm group-hover:scale-105 transition-transform object-cover"
            />
          ) : (
            <span className="ds-touch-target flex items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-700/80 border border-white/30 text-slate-500 dark:text-slate-400">
              <Icons.User />
            </span>
          )}
          {user && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" aria-hidden />
          )}
        </button>

        {/* Search pill + gradient filter orb */}
        <button
          type="button"
          onClick={onSearchClick}
          className="flex-1 min-w-0 h-11 rounded-full flex items-center pl-4 pr-1.5 gap-2 cursor-pointer transition-all duration-300 group text-left bg-white/75 dark:bg-white/[0.06] backdrop-blur-md border border-white/50 dark:border-white/10 shadow-sm"
        >
          <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
            <Icons.Search />
          </span>
          <span className="flex-1 text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
            {t('header.searchPlaceholder')}
          </span>
          <span className="ds-fab-grad flex-shrink-0 w-8 h-8 [&_svg]:w-4 [&_svg]:h-4" aria-hidden>
            <Icons.Filter />
          </span>
        </button>

        {/* Controls: theme, language, settings */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? t('header.switchToLight') : t('header.switchToDark')}
            className="ds-touch-target flex items-center justify-center rounded-full ds-glass ds-glass-edge border border-white/40 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300 transition-all duration-300 hover:opacity-90 active:scale-95"
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              aria-label={t('header.changeLanguage')}
              className="ds-touch-target flex items-center justify-center rounded-full ds-glass ds-glass-edge border border-white/40 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300 transition-all duration-300 hover:opacity-90 active:scale-95"
            >
              <Globe className="w-5 h-5" />
            </button>
            {langOpen && (
              <div className="ds-pop-panel absolute right-0 top-12 w-44 p-1">
                {getSupportedLanguages().map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      lang === l.code
                        ? 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] font-semibold'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--klein-blue-soft)]'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span className="flex-1 truncate">{l.nativeName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate(wfPath('settings'))}
            aria-label={t('header.settings')}
            className="ds-touch-target flex items-center justify-center rounded-full ds-glass ds-glass-edge border border-white/40 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300 transition-all duration-300 hover:opacity-90 active:scale-95"
          >
            <Icons.Settings />
          </button>
        </div>
      </div>
    </header>
  );
};

export const WfLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const onSearchClick = () => {
    // Search routes through the dictionary tool until a dedicated overlay ports.
    if (location.pathname !== wfPath('tools/dictionary')) navigate(wfPath('tools/dictionary'));
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      <WfTopBar onSearchClick={onSearchClick} />

      <main
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0"
        style={{ paddingTop: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px) + 0.5rem)` }}
      >
        <div className="ds-page flex-1">
          <Outlet />
        </div>
      </main>

      <WfBottomTabNav />
    </div>
  );
};

export default WfLayout;
