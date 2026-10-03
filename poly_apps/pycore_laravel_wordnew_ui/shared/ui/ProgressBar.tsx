import React from 'react';
import { TONE_BAR, type StatusTone } from './statusTone';

interface ProgressBarProps {
  done: number;
  total: number;
  tone?: StatusTone;
  label?: string;
  className?: string;
  /** Replaces the tone's solid colour (gradients). */
  barClassName?: string;
}

/** Thin determinate bar; renders empty when the total is unknown. */
export const ProgressBar: React.FC<ProgressBarProps> = ({ done, total, tone = 'indigo', label, className = 'h-1.5', barClassName }) => {
  const share = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <span className={`block flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <span className={`block h-full ${barClassName ?? TONE_BAR[tone]} transition-[width] duration-300`} style={{ width: `${share}%` }} />
    </span>
  );
};

interface TickBarProps {
  done: number;
  total: number;
  ticks?: number;
  label?: string;
  className?: string;
  /** Filled tick colour (solid or gradient). */
  fillClassName?: string;
}

/** Pill of evenly spaced ticks; filled ticks show the done share. */
export const TickBar: React.FC<TickBarProps> = ({ done, total, ticks = 24, label, className = 'h-4', fillClassName = 'bg-gradient-to-b from-sky-400 to-blue-600' }) => {
  const filled = total > 0 ? Math.round(Math.min(1, done / total) * ticks) : 0;
  return (
    <div className={`flex flex-1 items-stretch gap-[2px] rounded-full bg-white p-[3px] dark:bg-white/[0.06] ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className={`flex-1 rounded-full transition-colors duration-300 ${i < filled ? fillClassName : 'bg-slate-200 dark:bg-white/10'}`} />
      ))}
    </div>
  );
};

interface SegmentedBarProps {
  segments: ReadonlyArray<{ key: string; value: number; tone: StatusTone }>;
  total: number;
  label?: string;
  className?: string;
}

/** Stacked bar: one coloured segment per state, all measured against the same total. */
export const SegmentedBar: React.FC<SegmentedBarProps> = ({ segments, total, label, className = 'h-1.5' }) => (
  <div className={`flex overflow-hidden rounded-full bg-slate-100 dark:bg-white/5 ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={segments[0]?.value ?? 0}>
    {segments.map((segment) => (
      <div key={segment.key} className={`${TONE_BAR[segment.tone]} transition-[width] duration-300`} style={{ width: `${total > 0 ? (segment.value / total) * 100 : 0}%` }} />
    ))}
  </div>
);
