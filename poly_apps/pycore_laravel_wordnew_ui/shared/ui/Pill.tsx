import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TONE_TEXT, TONE_TINT, type StatusTone } from './statusTone';

interface PillProps {
  children?: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatusTone;
  title?: string;
  /** Square-ish stat chip (icon + number) instead of the round label pill. */
  stat?: boolean;
  /** Round pill with a tinted background of its tone and no border (state badges). */
  tint?: boolean;
  /** Let the pill shrink and truncate inside a narrow row instead of keeping its width. */
  fluid?: boolean;
  /** Disclosure state of a clickable pill that opens a panel. */
  expanded?: boolean;
  onClick?: () => void;
  className?: string;
}

const LABEL_CLASS = 'rounded-full border border-slate-200 px-2 py-0.5 text-[10px] dark:border-white/10';
const TINT_CLASS = 'rounded-full px-2.5 py-1.5 text-[10px] font-bold';
const STAT_CLASS = 'rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1 font-mono leading-none dark:border-white/10 dark:bg-white/5';

/** The one pill / stat chip: icon + text in a tone, optionally clickable. */
export const Pill: React.FC<PillProps> = ({ children, icon: Icon, tone = 'neutral', title, stat = false, tint = false, fluid = false, expanded, onClick, className = '' }) => {
  const body = (
    <>
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden />}
      {children}
    </>
  );
  const shape = tint ? `${TINT_CLASS} ${TONE_TINT[tone]}` : stat ? STAT_CLASS : LABEL_CLASS;
  const classes = `inline-flex items-center gap-1 text-[10px] ${fluid ? 'min-w-0 max-w-full' : 'shrink-0 whitespace-nowrap'} ${shape} ${TONE_TEXT[tone]} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-expanded={expanded} className={`${classes} cursor-pointer hover:bg-slate-200/70 dark:hover:bg-white/10`}>{body}</button>
  ) : (
    <span title={title} className={classes}>{body}</span>
  );
};
