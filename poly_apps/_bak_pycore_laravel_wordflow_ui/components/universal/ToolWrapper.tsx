import React, { ReactNode, useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { History, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import { AiBentoCard } from '../ai-tools/ui';

interface ToolWrapperProps {
  title: string;
  icon: LucideIcon;
  gradient: string;
  description?: string;
  children: ReactNode;
  history?: ReactNode;
  favorites?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  showHistory?: boolean;
  onToggleHistory?: () => void;
  className?: string;
  /** Optional left-side actions in the utility bar (e.g. Refresh). */
  actions?: ReactNode;
}

const utilityBtn = `${commonClasses.button} ${commonClasses.buttonSecondary} !px-3 !py-2 text-xs`;

/**
 * ToolWrapper - generic tool wrapper
 * Provides a unified UI framework including title, icon, history, favorites, etc.
 */
const ToolWrapper: React.FC<ToolWrapperProps> = ({
  title,
  children,
  history,
  favorites = false,
  isFavorite = false,
  onToggleFavorite,
  showHistory = false,
  onToggleHistory,
  className = '',
  actions,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`space-y-4 sm:space-y-5 p-4 sm:p-6 ${className}`}>
      <h2 className="sr-only">{title}</h2>

      {/* Utility bar */}
      <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2
        bg-slate-900/[0.03] dark:bg-white/[0.03] ring-1 ring-slate-200/60 dark:ring-white/5">
        <div className="flex items-center gap-2 min-w-0">{actions}</div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`${utilityBtn} p-2`}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {favorites && onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className={`${utilityBtn} p-2`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </button>
          )}

          {history && onToggleHistory && (
            <button
              onClick={onToggleHistory}
              className={`${utilityBtn} ${
                showHistory ? commonClasses.buttonPrimary : ''
              } flex items-center gap-2`}
            >
              <History className="w-4 h-4" />
              History
            </button>
          )}
        </div>
      </div>

      {showHistory && history && (
        <AiBentoCard title="History">
          {history}
        </AiBentoCard>
      )}

      {!collapsed && children}
    </div>
  );
};

export default ToolWrapper;
