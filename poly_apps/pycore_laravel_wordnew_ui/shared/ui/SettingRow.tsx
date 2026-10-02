import React from 'react';

interface SettingRowProps {
  label: string;
  hint?: string;
  /** Stack the control under the label (wide controls such as chip groups and sliders). */
  stacked?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Labelled settings row: label + hint on the left, the control on the right (or below when stacked). */
export const SettingRow: React.FC<SettingRowProps> = ({ label, hint, stacked = false, children, className = '' }) => (
  <div className={`${stacked ? 'space-y-2' : 'flex items-center justify-between gap-4'} py-2.5 ${className}`}>
    <div className="min-w-0">
      <span className="block text-xs font-bold text-zinc-800 dark:text-slate-200">{label}</span>
      {hint && <span className="block font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{hint}</span>}
    </div>
    {children}
  </div>
);
