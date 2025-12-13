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
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradientClasses[gradient] || gradient} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
