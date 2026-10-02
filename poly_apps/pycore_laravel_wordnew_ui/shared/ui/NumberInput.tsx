import React from 'react';

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
}

const INTEGER_BLOCKED_KEYS = ['e', 'E', '+', '-', '.'];
const DECIMAL_BLOCKED_KEYS = ['e', 'E', '+', '-'];
const INTEGER_PASTE = /^\d+$/;
const DECIMAL_PASTE = /^\d*\.?\d*$/;

/** The one typed number input: clamps to min..max, blocks signs / exponents (and the dot for integer steps). */
export const NumberInput: React.FC<NumberInputProps> = ({ value, min, max, step, onChange, label, className = 'w-20 text-right' }) => {
  const decimal = step < 1;
  const blocked = decimal ? DECIMAL_BLOCKED_KEYS : INTEGER_BLOCKED_KEYS;
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      inputMode={decimal ? 'decimal' : 'numeric'}
      pattern={decimal ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
      onKeyDown={(event) => { if (blocked.includes(event.key)) event.preventDefault(); }}
      onPaste={(event) => { if (!(decimal ? DECIMAL_PASTE : INTEGER_PASTE).test(event.clipboardData.getData('text'))) event.preventDefault(); }}
      onChange={(event) => {
        const parsed = Number(event.target.value);
        if (event.target.value === '' || !Number.isFinite(parsed)) return;
        onChange(Math.min(max, Math.max(min, parsed)));
      }}
      className={`${className} rounded-lg border border-slate-900/10 bg-slate-900/5 px-2 py-1 font-mono text-xs text-slate-800 focus:border-indigo-500/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200`}
    />
  );
};
