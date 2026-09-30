/**
 * Small presentational parts shared by the live model panels.
 */
import React from 'react';
import { PcProgressBar } from '../PcMeter';
import type { PcTone } from '../PcStatusPill';

export const PcLiveSection: React.FC<{ title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }> = ({
  title, aside, children,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
      {aside}
    </div>
    {children}
  </div>
);

export const PcLiveStat: React.FC<{ label: string; value: React.ReactNode; tone?: PcTone }> = ({ label, value, tone }) => (
  <div className="rounded-xl border border-slate-200/70 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03] min-w-0">
    <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
    <div className={`mt-0.5 font-mono text-sm font-bold truncate ${
      tone === 'bad' ? 'text-rose-500' : tone === 'warn' ? 'text-amber-500' : 'text-slate-800 dark:text-slate-100'
    }`}>
      {value}
    </div>
  </div>
);

export const PcLiveProgressRow: React.FC<{
  percent: number;
  tone?: PcTone;
  left: React.ReactNode;
  right?: React.ReactNode;
  detail?: React.ReactNode;
}> = ({ percent, tone, left, right, detail }) => (
  <div className="rounded-xl border border-slate-200/70 dark:border-white/10 p-2.5 space-y-1.5 min-w-0">
    <div className="flex items-center justify-between gap-2 text-[11px] min-w-0">
      <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{left}</span>
      {right && <span className="shrink-0 font-mono text-slate-500">{right}</span>}
    </div>
    <PcProgressBar percent={percent} tone={tone ?? 'info'} />
    {detail && <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-mono text-slate-400">{detail}</div>}
  </div>
);

export function progressPercent(done?: number | null, total?: number | null): number {
  const denominator = Number(total) || 0;
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, ((Number(done) || 0) / denominator) * 100));
}
