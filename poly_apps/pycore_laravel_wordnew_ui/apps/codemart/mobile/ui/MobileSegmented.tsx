import React from 'react';

export interface MobileSegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface MobileSegmentedProps<T extends string> {
  options: ReadonlyArray<MobileSegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function MobileSegmented<T extends string>({ options, value, onChange, ariaLabel }: MobileSegmentedProps<T>): React.ReactElement {
  return (
    <div className="cmm-segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
