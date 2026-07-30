import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { commonClasses } from '../../styles/theme';

export type StatCardTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'processing';

const TONE_ACCENT: Record<StatCardTone, string> = {
  neutral: 'border-slate-300 dark:border-slate-600',
  info: 'border-blue-400',
  success: 'border-emerald-400',
  warning: 'border-amber-400',
  error: 'border-red-400',
  processing: 'border-indigo-400',
};
const TONE_VALUE: Record<StatCardTone, string> = {
  neutral: 'text-slate-800 dark:text-slate-100',
  info: 'text-blue-600 dark:text-blue-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  processing: 'text-indigo-600 dark:text-indigo-400',
};

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatCardTone;
  sub?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
  iconPosition?: 'left' | 'right';
}

/**
 * StatCard — one dark-mode-aware metric card to replace the ~dozens of hand-rolled
 * stat cards across views (border-l accent + big tabular value + label + optional
 * icon/sub). Pass onClick to turn it into a clickable drill card.
 */
export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, tone = 'neutral', sub, onClick, className = '', valueClassName, iconClassName = 'text-slate-400', iconPosition = 'right' }) => {
  const interactive = !!onClick;
  const Tag: any = interactive ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`${commonClasses.card} p-3 border-l-4 ${TONE_ACCENT[tone]} ${interactive ? 'text-left w-full cursor-pointer transition-all hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-700' : ''} ${className}`}
    >
      <div className={`flex items-center gap-2 mb-1 ${iconPosition === 'right' ? 'justify-between' : ''}`}>
        {Icon && iconPosition === 'left' && <Icon className={`w-4 h-4 ${iconClassName}`} />}
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && iconPosition === 'right' && <Icon className={`w-4 h-4 ${iconClassName}`} />}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueClassName ?? TONE_VALUE[tone]}`}>{value}</div>
      {sub != null && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</div>}
    </Tag>
  );
};

export interface StatGridProps {
  columns?: 2 | 3 | 4 | 5;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}
const STAT_COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 5: 'grid-cols-2 sm:grid-cols-5' };
const STAT_GAP: Record<string, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };
export const StatGrid: React.FC<StatGridProps> = ({ columns = 4, gap = 'md', className = '', children }) => (
  <div className={`grid ${STAT_COLS[columns]} ${STAT_GAP[gap]} ${className}`}>{children}</div>
);

export default StatCard;
