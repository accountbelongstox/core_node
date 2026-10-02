import React from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  title?: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string | number> {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** `sm`: toolbar toggles; `xs`: dense inline pickers (speeds). */
  size?: 'sm' | 'xs';
  /** Classes of the selected segment (theme accent); defaults to the indigo highlight. */
  activeClassName?: string;
  ariaLabel?: string;
  className?: string;
}

const SIZE: Record<NonNullable<SegmentedControlProps<string>['size']>, string> = {
  sm: 'px-2.5 py-1 rounded-md text-[10px]',
  xs: 'px-1.5 py-0.5 rounded text-[9px]',
};

const DEFAULT_ACTIVE = 'bg-indigo-500/20 text-indigo-200';

/** Joined single-choice toggle (two to six short options). */
export function SegmentedControl<T extends string | number>({
  value, options, onChange, size = 'sm', activeClassName = DEFAULT_ACTIVE, ariaLabel, className = '',
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex w-fit rounded-lg border border-white/5 bg-white/5 p-0.5 ${className}`}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={`cursor-pointer font-mono font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${SIZE[size]} ${option.value === value ? activeClassName : 'text-zinc-400'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
