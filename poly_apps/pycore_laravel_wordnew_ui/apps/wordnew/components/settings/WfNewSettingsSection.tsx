import React from 'react';
import type { ElementTheme } from '../../WfNewThemes';

interface WfNewSettingsSectionProps {
  activeTheme: ElementTheme;
  icon: React.ReactNode;
  title: string;
  /** Right-aligned header controls (refresh, status). */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** The one Settings card: themed surface, icon + title header with divider, optional header actions. */
export const WfNewSettingsSection: React.FC<WfNewSettingsSectionProps> = ({ activeTheme, icon, title, actions, className = '', children }) => (
  <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} space-y-5 shadow-md ${className}`}>
    <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-3">
      {icon}
      <h3 className="text-base font-extrabold tracking-tight text-indigo-950 dark:text-white">{title}</h3>
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
    {children}
  </div>
);
