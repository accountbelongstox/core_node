import React from 'react';
import { TONE_BAR, type StatusTone } from './statusTone';

interface ProgressBarProps {
  done: number;
  total: number;
  tone?: StatusTone;
  label?: string;
  className?: string;
}

/** Thin determinate bar; renders empty when the total is unknown. */
export const ProgressBar: React.FC<ProgressBarProps> = ({ done, total, tone = 'indigo', label, className = 'h-1.5' }) => {
  const share = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <span className={`block flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <span className={`block h-full ${TONE_BAR[tone]} transition-[width] duration-300`} style={{ width: `${share}%` }} />
    </span>
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
