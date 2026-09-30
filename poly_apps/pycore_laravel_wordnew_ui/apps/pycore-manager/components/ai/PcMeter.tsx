/**
 * PcMeter / PcProgressBar — utilization meter card and a plain progress bar.
 */
import React from 'react';
import { PC_TONE_BAR, pcLoadTone, type PcTone } from './PcStatusPill';

const PERCENT_MAX = 100;

type PcIcon = React.FC<{ className?: string }>;

export const PcProgressBar: React.FC<{ percent: number; tone?: PcTone; thin?: boolean }> = ({ percent, tone, thin }) => {
  const clamped = Math.max(0, Math.min(PERCENT_MAX, percent || 0));
  return (
    <div className={`${thin ? 'h-1' : 'h-1.5'} rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden`}>
      <div
        className={`h-full ${PC_TONE_BAR[tone ?? pcLoadTone(clamped)]} transition-all`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export const PcMeter: React.FC<{ label: string; percent: number; sub?: string; Icon: PcIcon }> = ({ label, percent, sub, Icon }) => {
  const clamped = Math.max(0, Math.min(PERCENT_MAX, percent || 0));
  return (
    <div className="rounded-2xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-indigo-400" /> {label}
        </span>
        <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200">{Math.round(clamped)}%</span>
      </div>
      <PcProgressBar percent={clamped} />
      {sub && <p className="mt-1.5 text-[10px] font-mono text-slate-400">{sub}</p>}
    </div>
  );
};
