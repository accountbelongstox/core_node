import React from 'react';

export interface ChipOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  title?: string;
  disabled?: boolean;
}

interface ChipGroupProps<T extends string | number> {
  value: T;
  options: readonly ChipOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** Single-choice pill group (speeds, languages, modes). */
export function ChipGroup<T extends string | number>({ value, options, onChange, className = '' }: ChipGroupProps<T>): React.ReactElement {
  return (
    <div role="radiogroup" className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300' : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
