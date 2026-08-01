import React from 'react';

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

export function CenteredPage({ children, className = '' }: CenteredPageProps) {
  return (
    <div className={`w-full min-w-0 max-w-[1920px] mx-auto ${className}`}>
      {children}
    </div>
  );
}

export function CenteredTabBar({ items, activeId, onChange }: CenteredTabBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
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
