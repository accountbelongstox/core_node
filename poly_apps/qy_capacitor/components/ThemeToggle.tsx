/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Icons, IconButton } from './UI';
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

  // Reference top bar uses a quiet frosted circular icon button. `bar` keeps a
  // glass shell (floating header); `minimal`/scrolled stays transparent-quiet.
  const isMinimal = variant === 'minimal';
  const useGlass = !isMinimal && !scrolled;
  const isDark = settings.display.theme === 'dark';
  const label = isDark ? t('header.switchToLight') : t('header.switchToDark');

  return (
    <IconButton
      icon={isDark ? <Icons.Sun /> : <Icons.Moon />}
      onClick={toggleTheme}
      label={label}
      className={`${useGlass ? 'ds-glass ds-glass-edge border border-[var(--border-highlight)] shadow-sm' : ''} ${className}`}
    />
  );
};

export default ThemeToggle;
