import React, { ReactNode, useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { History, Star, X, ChevronDown, ChevronUp } from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import BentoCard from '../BentoCard';

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
}

/**
 * ToolWrapper - 通用工具包装器
 * 提供统一的UI框架，包括标题、图标、历史记录、收藏等
 */
const ToolWrapper: React.FC<ToolWrapperProps> = ({
  title,
  icon: Icon,
  gradient,
  description,
  children,
  history,
  favorites = false,
  isFavorite = false,
  onToggleFavorite,
  showHistory = false,
  onToggleHistory,
  className = ''
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const gradientClasses: Record<string, string> = {
    'blue-purple': 'from-blue-500 to-purple-600',
    'green-teal': 'from-green-500 to-teal-600',
    'orange-red': 'from-orange-500 to-red-600',
    'purple-pink': 'from-purple-500 to-pink-600',
    'indigo-blue': 'from-indigo-500 to-blue-600'
  };

  return (
    <div className={`space-y-4 sm:space-y-6 p-4 sm:p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br ${gradientClasses[gradient] || gradient} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold truncate">{title}</h2>
            {description && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Collapse/Expand */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} p-2`}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {/* Favorite */}
          {favorites && onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </button>
          )}

          {/* History Toggle */}
          {history && onToggleHistory && (
            <button
              onClick={onToggleHistory}
              className={`${commonClasses.button} ${
                showHistory ? commonClasses.buttonPrimary : commonClasses.buttonSecondary
              } flex items-center gap-2`}
            >
              <History className="w-4 h-4" />
              History
            </button>
          )}
        </div>
      </div>

      {/* History Panel */}
      {showHistory && history && (
        <BentoCard title="History">
          {history}
        </BentoCard>
      )}

      {/* Main Content */}
      {!collapsed && children}
    </div>
  );
};

export default ToolWrapper;
