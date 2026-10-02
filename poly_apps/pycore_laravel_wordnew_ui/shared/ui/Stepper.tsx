import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

const PRECISION = 100;
const BUTTON_CLASS = 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10';

/** The one compact number stepper (- value +), clamped to min..max. */
export const Stepper: React.FC<StepperProps> = ({ value, min, max, step, suffix = '', onChange, disabled = false, className = '' }) => {
  const clamp = (next: number): number => Math.min(max, Math.max(min, Math.round(next * PRECISION) / PRECISION));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - step))} className={BUTTON_CLASS}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[48px] text-center font-mono text-xs font-black text-zinc-800 dark:text-slate-100">{value}{suffix}</span>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + step))} className={BUTTON_CLASS}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
