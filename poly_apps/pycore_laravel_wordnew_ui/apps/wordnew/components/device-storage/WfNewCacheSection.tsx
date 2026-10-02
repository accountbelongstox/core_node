import React from 'react';
import { RefreshCw, type LucideIcon } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';

interface Props {
  theme: ElementTheme;
  title: string;
  icon?: LucideIcon;
  /** Line under the title. */
  summary?: React.ReactNode;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  refreshing?: boolean;
  refreshLabel?: string;
  spacing?: string;
  children: React.ReactNode;
}

/** Card of the cache page: title (+ icon, refresh button) and the section content. */
export const WfNewCacheSection: React.FC<Props> = ({ theme, title, icon: Icon, summary, onRefresh, refreshDisabled, refreshing = false, refreshLabel, spacing = 'space-y-4', children }) => (
  <section className={`min-w-0 p-4 sm:p-6 rounded-3xl ${theme.cardClass} shadow-sm ${spacing}`}>
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          {Icon && <Icon className="w-4 h-4 text-indigo-500" />} {title}
        </h3>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled}
            title={refreshLabel}
            aria-label={refreshLabel}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      {summary}
    </div>
    {children}
  </section>
);
