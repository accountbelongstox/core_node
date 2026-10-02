import React from 'react';

export type ChipVariant = 'default' | 'active' | 'danger' | 'success' | 'warning' | 'info';

const BASE = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition disabled:opacity-40';

const VARIANT: Record<ChipVariant, string> = {
  default: 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300',
  active: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300',
  danger: 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300',
  success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  info: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
};

/** Class string of a chip (for non-button elements such as stat labels). */
export const chipClass = (variant: ChipVariant = 'default', extra = ''): string => `${BASE} ${VARIANT[variant]} ${extra}`.trim();

interface ChipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant;
}

/** The one compact action chip used by toolbars, pagers and row actions. */
export const ChipButton: React.FC<ChipButtonProps> = ({ variant = 'default', className = '', type = 'button', children, ...rest }) => (
  <button type={type} className={chipClass(variant, className)} {...rest}>{children}</button>
);
