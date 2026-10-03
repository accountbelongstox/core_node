/** Before/after file-size bars with the saved (or added) percentage. */
import React from 'react';
import { TONE, useMediaT, type Tone } from './MediaKit';
import { formatBytes, savingsPercent } from './mediaFormat';

export const SizeBars: React.FC<{ before: number; after: number | null; tone?: Tone; busy?: boolean }> = ({ before, after, tone = 'amber', busy = false }) => {
  const m = useMediaT();
  const saved = after === null ? 0 : savingsPercent(before, after);
  const max = Math.max(before, after ?? 0, 1);
  const bar = (bytes: number, className: string) => (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
      <div className={`h-full rounded-full transition-all duration-300 ${className}`} style={{ width: `${Math.max(2, (bytes / max) * 100)}%` }} />
    </div>
  );
  return (
    <div className={`flex flex-col gap-2 ${busy ? 'opacity-60' : ''}`}>
      <div>
        <div className="mb-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400"><span>{m('common.original')}</span><span className="font-mono font-bold">{formatBytes(before)}</span></div>
        {bar(before, 'bg-slate-400 dark:bg-slate-500')}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400"><span>{m('common.result')}</span><span className="font-mono font-bold">{after === null ? '...' : formatBytes(after)}</span></div>
        {after !== null && bar(after, saved >= 0 ? TONE[tone].bar : 'bg-red-500')}
      </div>
      {after !== null && (
        <div className={`text-right font-mono text-lg font-black ${saved >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {saved >= 0 ? m('common.saved', { percent: saved }) : m('common.larger', { percent: Math.abs(saved) })}
        </div>
      )}
    </div>
  );
};
