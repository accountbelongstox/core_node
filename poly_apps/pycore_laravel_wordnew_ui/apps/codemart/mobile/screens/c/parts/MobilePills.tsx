import React from 'react';

export interface MobilePillOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface MobilePillsProps<T extends string> {
  options: ReadonlyArray<MobilePillOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Horizontally scrolling pill tabs for sections that do not fit a segmented control. */
export function MobilePills<T extends string>({ options, value, onChange, ariaLabel }: MobilePillsProps<T>): React.ReactElement {
  return (
    <div className="cmmc-pills" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
