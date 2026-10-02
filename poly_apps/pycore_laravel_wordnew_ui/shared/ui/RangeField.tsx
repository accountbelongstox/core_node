import React from 'react';

interface RangeFieldProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

/** The one range slider with optional leading / trailing labels or icons. */
export const RangeField: React.FC<RangeFieldProps> = ({ value, min, max, step, onChange, leading, trailing, className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    {leading}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1 flex-1 cursor-pointer rounded-lg bg-zinc-200 accent-indigo-500 dark:bg-white/10"
    />
    {trailing}
  </div>
);
