/**
 * PcStatusPill — the ONE pill / dot / chip vocabulary of the AI surface.
 * Every status, presence, runtime and capability badge maps onto a tone here.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

export type PcTone = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'idle';

type PcIcon = React.FC<{ className?: string }>;

export const PC_TONE_PILL: Record<PcTone, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500',
  warn: 'bg-amber-500/15 text-amber-500',
  bad: 'bg-rose-500/15 text-rose-500',
  info: 'bg-sky-500/15 text-sky-500',
  accent: 'bg-violet-500/15 text-violet-500',
  idle: 'bg-slate-500/15 text-slate-400',
};

export const PC_TONE_CHIP: Record<PcTone, string> = {
  ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  warn: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  bad: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
  info: 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400',
  accent: 'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400',
  idle: 'bg-slate-500/5 border-slate-400/20 text-slate-500 dark:text-slate-400',
};

export const PC_TONE_DOT: Record<PcTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  info: 'bg-sky-500',
  accent: 'bg-violet-500',
  idle: 'bg-slate-400/50',
};

export const PC_TONE_BAR: Record<PcTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  info: 'bg-sky-500',
  accent: 'bg-violet-500',
  idle: 'bg-slate-400',
};

/** Tone of a utilization percentage (green < 60 <= amber < 85 <= red). */
export function pcLoadTone(percent: number): PcTone {
  if (percent >= 85) return 'bad';
  if (percent >= 60) return 'warn';
  return 'ok';
}

export const PcDot: React.FC<{ tone: PcTone; pulse?: boolean }> = ({ tone, pulse }) => (
  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PC_TONE_DOT[tone]} ${pulse ? 'animate-pulse' : ''}`} />
);

export interface PcStatusPillProps {
  tone: PcTone;
  label: React.ReactNode;
  Icon?: PcIcon;
  busy?: boolean;
  title?: string;
  className?: string;
}

/** Filled pill: one status word, optional icon or spinner. */
export const PcStatusPill: React.FC<PcStatusPillProps> = ({ tone, label, Icon, busy, title, className = '' }) => (
  <span
    title={title}
    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${PC_TONE_PILL[tone]} ${className}`}>
    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : Icon ? <Icon className="w-3 h-3" /> : null}
    {label}
  </span>
);

export interface PcChipProps {
  tone: PcTone;
  children: React.ReactNode;
  dot?: boolean;
  title?: string;
  className?: string;
}

/** Outlined chip: a named thing (engine, provider, source) with an optional status dot. */
export const PcChip: React.FC<PcChipProps> = ({ tone, children, dot = true, title, className = '' }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${PC_TONE_CHIP[tone]} ${className}`}>
    {dot && <PcDot tone={tone} />}
    {children}
  </span>
);
