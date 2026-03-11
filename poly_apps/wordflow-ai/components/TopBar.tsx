import React, { useState, useEffect, useContext } from 'react';
import { useWindowScroll } from 'react-use';
import { Icons } from './UI';
import { AppContext } from '../contexts/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { LanguageDropdown } from './LanguageDropdown';

export interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  variant?: 'full' | 'minimal';
  onSearchClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  showBack = false,
  onBack,
  variant = 'full',
  onSearchClick,
}) => {
  const { user, navigate, t } = useContext(AppContext);
  const { y: scrollY } = useWindowScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setIsScrolled(scrollY > 20);
  }, [scrollY]);

  const isMinimal = variant === 'minimal';
  const useGlass = !isMinimal && !isScrolled;

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-40
        px-[max(var(--page-padding-h),env(safe-area-inset-left,0px))]
        pr-[max(var(--page-padding-h),env(safe-area-inset-right,0px))]
        pt-[env(safe-area-inset-top,0px)]
        pb-2
      `}
    >
      <div
        className={`
          w-full rounded-full flex items-center gap-2 sm:gap-3 px-2 py-2 transition-all duration-500
          ${useGlass ? 'ds-glass ds-glass-edge' : 'bg-transparent border border-transparent'}
          ${isScrolled && !isMinimal ? 'ds-glass ds-glass-edge' : ''}
        `}
      >
        <div className="flex-shrink-0">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={t('common.back') || 'Back'}
              className="ds-touch-target flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Icons.ChevronLeft />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(user ? 'profile' : 'login')}
              className="cursor-pointer shrink-0 group relative block"
              aria-label={user ? t('header.profile') : t('header.login')}
            >
              {user ? (
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
          )}
        </div>

        {!isMinimal && (
          <button
            type="button"
            onClick={onSearchClick}
            className={`
              flex-1 min-w-0 h-10 rounded-full flex items-center px-4 gap-2 cursor-pointer transition-all duration-300 group text-left
              ${isScrolled ? 'bg-slate-100/80 dark:bg-slate-800/50' : 'bg-white/70 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm'}
            `}
          >
            <span className="text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0">
              <Icons.Search />
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
              {title || t('header.searchPlaceholder')}
            </span>
          </button>
        )}

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <ThemeToggle variant={isMinimal ? 'minimal' : 'bar'} scrolled={isScrolled} />
          <LanguageDropdown variant={isMinimal ? 'minimal' : 'bar'} scrolled={isScrolled} />
          {!isMinimal && (
            <button
              type="button"
              onClick={() => navigate('settings')}
              aria-label={t('header.settings')}
              className={`
                ds-touch-target flex items-center justify-center rounded-full transition-all duration-300
                ${useGlass || (isScrolled && !isMinimal) ? 'ds-glass ds-glass-edge border border-white/40 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300' : ''}
                hover:opacity-90 active:scale-95
              `}
            >
              <Icons.Settings />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
