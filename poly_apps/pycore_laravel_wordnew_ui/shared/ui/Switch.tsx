import React from 'react';

export type SwitchTone = 'indigo' | 'fuchsia' | 'emerald' | 'amber' | 'sky' | 'rose';

const TONE_ON: Record<SwitchTone, string> = {
  indigo: 'bg-indigo-600',
  fuchsia: 'bg-fuchsia-600',
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-500',
  sky: 'bg-sky-600',
  rose: 'bg-rose-600',
};

interface SwitchProps {
  on: boolean;
  onChange: (next: boolean) => void;
  tone?: SwitchTone;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** The one on/off switch; every settings row and sheet uses it. */
export const Switch: React.FC<SwitchProps> = ({ on, onChange, tone = 'indigo', disabled = false, label, className = '' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40 ${on ? TONE_ON[tone] : 'bg-zinc-300 dark:bg-zinc-700'} ${className}`}
  >
    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);
