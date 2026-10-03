/** Packet-inspector building blocks shared by the network workbenches: field rows and bit cells. */
import React from 'react';
import { CopyButton, MUTED_TEXT } from './calcKit';

interface KvRowProps {
  label: string;
  value: string;
  hint?: string;
  copyLabel: string;
  tone?: 'normal' | 'accent' | 'muted';
}

const TONE: Record<NonNullable<KvRowProps['tone']>, string> = {
  normal: 'text-slate-900 dark:text-slate-100',
  accent: 'text-rose-600 dark:text-rose-300',
  muted: 'text-slate-500 dark:text-slate-400',
};

/** One decoded field line: label, monospace value, copy. */
export const KvRow: React.FC<KvRowProps> = ({ label, value, hint, copyLabel, tone = 'normal' }) => (
  <div className="flex items-center gap-2 border-b border-slate-100 py-1.5 last:border-b-0 dark:border-slate-800">
    <div className="w-28 shrink-0 sm:w-36">
      <p className={`truncate text-[11px] font-bold uppercase tracking-wider ${MUTED_TEXT}`}>{label}</p>
      {hint && <p className={`truncate text-[10px] ${MUTED_TEXT}`}>{hint}</p>}
    </div>
    <p className={`min-w-0 flex-1 break-all font-mono text-sm font-semibold ${TONE[tone]}`}>{value}</p>
    <CopyButton text={value} label={copyLabel} />
  </div>
);

interface BitCellsProps {
  bits: string;
  /** Number of leading bits drawn as network bits. */
  networkBits?: number;
  offset?: number;
  onToggle?: (index: number) => void;
  dim?: boolean;
  label?: string;
}

/** A run of bit cells; leading network bits are tinted, host bits stay neutral. */
export const BitCells: React.FC<BitCellsProps> = ({ bits, networkBits = 0, offset = 0, onToggle, dim = false, label }) => (
  <div className="flex gap-[3px]" role={onToggle ? 'group' : undefined} aria-label={label}>
    {bits.split('').map((bit, i) => {
      const index = offset + i;
      const network = index < networkBits;
      const base = `flex h-7 min-w-0 flex-1 items-center justify-center rounded font-mono text-xs font-bold transition ${dim ? 'h-5 text-[10px]' : ''}`;
      const tone = network
        ? (bit === '1' ? 'bg-rose-500 text-white' : 'bg-rose-500/25 text-rose-700 dark:text-rose-200')
        : (bit === '1' ? 'bg-slate-600 text-white dark:bg-slate-300 dark:text-slate-900' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400');
      return onToggle ? (
        <button key={index} type="button" onClick={() => onToggle(index)} aria-label={`bit ${index}`} aria-pressed={bit === '1'} className={`${base} ${tone} cursor-pointer hover:brightness-110`}>{bit}</button>
      ) : (
        <span key={index} className={`${base} ${tone}`}>{bit}</span>
      );
    })}
  </div>
);
