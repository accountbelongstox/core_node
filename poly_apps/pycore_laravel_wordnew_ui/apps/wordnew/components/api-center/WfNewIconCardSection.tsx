import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  theme: ElementTheme;
  /** Mono uppercase heading (connection settings) instead of the plain one. */
  mono?: boolean;
  label?: string;
  children: React.ReactNode;
}

/** Settings-page card: icon box, title + description, then the section content. */
export const WfNewIconCardSection: React.FC<Props> = ({ icon: Icon, title, description, theme, mono = false, label, children }) => (
  <section className={`p-6 rounded-3xl ${theme.cardClass} shadow-sm space-y-3`} aria-label={label}>
    <div className="flex items-center gap-3">
      <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h3 className={mono ? 'text-sm font-extrabold font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400' : 'text-sm font-extrabold'}>{title}</h3>
        <p className={mono ? 'text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-1' : 'text-[11px] text-zinc-500 dark:text-zinc-400'}>{description}</p>
      </div>
    </div>
    {children}
  </section>
);
