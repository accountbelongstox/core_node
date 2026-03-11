import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Icons } from './UI';
import { StateManager, GlobalState } from '../services/StateManager';

export const ThemeToggle: React.FC<{
  className?: string;
  variant?: 'bar' | 'minimal';
  scrolled?: boolean;
}> = ({ className = '', variant = 'bar', scrolled = false }) => {
  const { t, settings, updateSettings } = useContext(AppContext);

  const toggleTheme = () => {
    const currentTheme = settings.display.theme;
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    updateSettings({ display: { ...settings.display, theme: nextTheme } });
    StateManager.set(GlobalState.THEME, nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const isMinimal = variant === 'minimal';
  const useGlass = !isMinimal && !scrolled;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={settings.display.theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
      title={settings.display.theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
      className={`
        ds-touch-target flex items-center justify-center rounded-full transition-all duration-300
        ${useGlass ? 'ds-glass ds-glass-edge border border-white/40 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300' : ''}
        ${scrolled && !isMinimal ? 'bg-transparent text-slate-500' : ''}
        ${isMinimal ? 'ds-glass ds-glass-edge text-slate-600 dark:text-slate-300' : ''}
        hover:opacity-90 active:scale-95
        ${className}
      `}
    >
      {settings.display.theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
    </button>
  );
};

export default ThemeToggle;
