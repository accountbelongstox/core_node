import React from 'react';

interface SettingRowProps {
  label: string;
  hint?: string;
  /** Stack the control under the label (wide controls such as chip groups and sliders). */
  stacked?: boolean;
  /** Card chrome around the row (switch lists inside a larger card). */
  boxed?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Labelled settings row: label + hint on the left, the control on the right (or below when stacked). */
export const SettingRow: React.FC<SettingRowProps> = ({ label, hint, stacked = false, boxed = false, children, className = '' }) => (
  <div className={`${stacked ? 'space-y-2' : 'flex items-center justify-between gap-4'} ${boxed ? 'rounded-2xl border border-zinc-100 bg-zinc-50 p-3.5 dark:border-white/5 dark:bg-white/5' : 'py-2.5'} ${className}`}>
    <div className="min-w-0">
      <span className="block text-xs font-bold text-zinc-800 dark:text-slate-200">{label}</span>
      {hint && <span className="block font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{hint}</span>}
    </div>
    {children}
  </div>
);
