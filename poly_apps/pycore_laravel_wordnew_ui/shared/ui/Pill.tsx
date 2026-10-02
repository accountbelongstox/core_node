import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TONE_TEXT, type StatusTone } from './statusTone';

interface PillProps {
  children?: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatusTone;
  title?: string;
  /** Square-ish stat chip (icon + number) instead of the round label pill. */
  stat?: boolean;
  onClick?: () => void;
  className?: string;
}

const LABEL_CLASS = 'rounded-full border border-slate-200 px-2 py-0.5 text-[10px] dark:border-white/10';
const STAT_CLASS = 'rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1 font-mono leading-none dark:border-white/10 dark:bg-white/5';

/** The one pill / stat chip: icon + text in a tone, optionally clickable. */
export const Pill: React.FC<PillProps> = ({ children, icon: Icon, tone = 'neutral', title, stat = false, onClick, className = '' }) => {
  const body = (
    <>
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden />}
      {children}
    </>
  );
  const classes = `inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] ${stat ? STAT_CLASS : LABEL_CLASS} ${TONE_TEXT[tone]} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`${classes} cursor-pointer hover:bg-slate-200/70 dark:hover:bg-white/10`}>{body}</button>
  ) : (
    <span title={title} className={classes}>{body}</span>
  );
};
