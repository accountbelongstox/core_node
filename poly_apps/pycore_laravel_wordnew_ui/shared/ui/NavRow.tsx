import React from 'react';
import { ArrowRight } from 'lucide-react';

interface NavRowProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  hint?: string;
  badge?: React.ReactNode;
  /** `field`: bordered button inside a form card; `row`: full-width list row for card-sized entries. */
  variant?: 'field' | 'row';
  className?: string;
}

const FIELD_CLASS = 'flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs font-bold text-zinc-300 transition-all hover:bg-white/10';
const ROW_CLASS = 'flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/5';

/** The one "open a sub-page" row. */
export const NavRow: React.FC<NavRowProps> = ({ label, onClick, icon, hint, badge, variant = 'field', className = '' }) => (
  variant === 'field' ? (
    <button type="button" onClick={onClick} className={`${FIELD_CLASS} ${className}`}>
      <span className="flex items-center gap-2">{icon}{label}</span>
      <ArrowRight className="h-4 w-4" />
    </button>
  ) : (
    <button type="button" onClick={onClick} className={`${ROW_CLASS} ${className}`}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold tracking-tight text-indigo-950 dark:text-white">{label}</span>
        {hint && <span className="block truncate font-mono text-[10px] text-zinc-500">{hint}</span>}
      </span>
      {badge}
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
    </button>
  )
);
