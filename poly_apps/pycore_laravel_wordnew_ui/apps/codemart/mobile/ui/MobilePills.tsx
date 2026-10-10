import React, { useEffect, useRef } from 'react';

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
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active || !listRef.current) return;
    const list = listRef.current;
    list.scrollTo({ left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
  }, [value]);

  return (
    <div ref={listRef} className="cmm-pills" role="tablist" aria-label={ariaLabel}>
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
