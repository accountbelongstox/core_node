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
  /** `radio`: single-choice radiogroup (default); `tab`: tablist. */
  role?: 'radio' | 'tab';
  label?: string;
  gapClassName?: string;
  /** Shape, padding and type of every chip (the default is the round mono pill). */
  chipClassName?: string;
  selectedClassName?: string;
  idleClassName?: string;
}

const DEFAULT_CHIP = 'rounded-full px-3 py-1.5 font-mono text-[11px]';
const DEFAULT_SELECTED = 'border-indigo-500 bg-indigo-500/15 text-indigo-300';
const DEFAULT_IDLE = 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10';

/** Single-choice pill group (speeds, languages, modes) or tab strip. */
export function ChipGroup<T extends string | number>({
  value, options, onChange, className = '', role = 'radio', label, gapClassName = 'gap-2',
  chipClassName = DEFAULT_CHIP, selectedClassName = DEFAULT_SELECTED, idleClassName = DEFAULT_IDLE,
}: ChipGroupProps<T>): React.ReactElement {
  const tabs = role === 'tab';
  return (
    <div role={tabs ? 'tablist' : 'radiogroup'} aria-label={label} className={`flex flex-wrap ${gapClassName} ${className}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role={role}
            aria-checked={tabs ? undefined : selected}
            aria-selected={tabs ? selected : undefined}
            title={option.title}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer border font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${chipClassName} ${selected ? selectedClassName : idleClassName}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
