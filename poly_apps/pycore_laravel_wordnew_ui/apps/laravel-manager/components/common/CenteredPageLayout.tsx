import React, { useEffect, useRef } from 'react';

/** Single-row horizontal scroller with its scrollbar hidden (mobile tab bars, chip rows). */
export const SCROLL_X_HIDDEN_CLASS = 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const TONE_CLASS = {
  green: 'bg-green-600 hover:bg-green-700 text-white',
  blue: 'bg-blue-600 hover:bg-blue-700 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  ghost: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
} as const;

export interface CenteredTabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface CenteredTabBarProps {
  items: CenteredTabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

interface CenteredPageProps {
  children: React.ReactNode;
  className?: string;
}

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

interface PageActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: keyof typeof TONE_CLASS;
  disabled?: boolean;
  /** Icon only at every width (refresh-style buttons); the label stays as title / aria-label. */
  iconOnly?: boolean;
}

export function CenteredPage({ children, className = '' }: CenteredPageProps) {
  return (
    <div className={`w-full min-w-0 max-w-[1920px] mx-auto ${className}`}>
      {children}
    </div>
  );
}

/**
 * Page title row. One-line title and no subtitle below md so the content gets
 * the screen; the actions never wrap (see PageActionButton).
 */
export function PageHeader({ title, subtitle, icon, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-2 min-w-0 mb-3 md:mb-6 ${className}`}>
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white truncate">{title}</h1>
          {subtitle && (
            <p className="hidden md:block text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1.5 md:gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Header action: icon + label from sm, icon only below it (title / aria-label always carry the label). */
export function PageActionButton({ icon, label, onClick, tone = 'ghost', disabled, iconOnly }: PageActionButtonProps) {
  const sizing = iconOnly ? 'p-2' : 'p-2 sm:px-4 sm:py-2';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`${sizing} ${TONE_CLASS[tone]} rounded-lg text-sm font-medium flex items-center gap-2 shrink-0 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {icon}
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

/** Segmented tab bar: one scrollable row below md (active tab kept in view), wrapped and centered from md. */
export function CenteredTabBar({ items, activeId, onChange }: CenteredTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    const target = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-nowrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 p-1 md:flex-wrap md:justify-center md:overflow-visible ${SCROLL_X_HIDDEN_CLASS}`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          ref={activeId === item.id ? activeRef : undefined}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-1.5 md:gap-2 transition-colors ${
            activeId === item.id
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
