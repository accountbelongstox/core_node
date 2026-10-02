import React from 'react';
import { ArrowRight } from 'lucide-react';

interface SectionAction {
  label: string;
  onClick: () => void;
}

interface WfNewSectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** `bar`: accent bar + small caps; `bento`: plain bold title above a bento tray; `title`: caps title with subtitle; `section`: icon chip + title + count; `page`: large page title. */
  variant?: 'bar' | 'bento' | 'title' | 'section' | 'page';
  action?: SectionAction;
  /** `section` variant: icon chip node and the count shown in brackets. */
  icon?: React.ReactNode;
  count?: number;
  className?: string;
}

const ACTION_CLS = 'ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-mono font-bold text-indigo-400 hover:text-indigo-300 transition';

const ActionLink: React.FC<{ action: SectionAction }> = ({ action }) => (
  <button type="button" onClick={action.onClick} className={ACTION_CLS}>
    {action.label} <ArrowRight className="w-3.5 h-3.5" />
  </button>
);

/** The one heading block of a page section (home hub, shelf, practice). */
export const WfNewSectionHeader: React.FC<WfNewSectionHeaderProps> = ({ title, subtitle, variant = 'title', action, icon, count, className = '' }) => {
  if (variant === 'bar') {
    return (
      <h3 className={`flex items-center gap-2 px-1 text-xs font-black font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 ${className}`}>
        <span aria-hidden className="h-3.5 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-fuchsia-500" />
        {title}
      </h3>
    );
  }
  if (variant === 'bento') {
    return (
      <h3 className={`px-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white ${className}`}>{title}</h3>
    );
  }
  if (variant === 'section') {
    return (
      <div className={`flex items-center gap-2 px-1 ${className}`}>
        {icon}
        <h4 className="text-xs font-black font-mono uppercase tracking-wider text-slate-200 dark:text-slate-300">{title}</h4>
        {count !== undefined && <span className="text-[10px] font-mono text-zinc-500">({count})</span>}
        {action && <ActionLink action={action} />}
      </div>
    );
  }
  if (variant === 'page') {
    return (
      <div className={className}>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-between px-1 ${className}`}>
      <div>
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-400">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[10px] font-mono text-zinc-500">{subtitle}</p>}
      </div>
      {action && <ActionLink action={action} />}
    </div>
  );
};
