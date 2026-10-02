import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string | number> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  hint?: string;
  /** `field`: full-width themed select with chevron; `compact`: small inline select for sheets and rows. */
  variant?: 'field' | 'compact';
  /** Theme input classes (activeTheme.inputClass) for the `field` variant. */
  inputClassName?: string;
  disabled?: boolean;
  className?: string;
}

const FIELD_CLASS = 'w-full cursor-pointer appearance-none rounded-xl py-3 pl-4 pr-10 font-mono text-xs outline-none transition-all disabled:opacity-50';
const COMPACT_CLASS = 'max-w-[11rem] cursor-pointer truncate rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none disabled:opacity-50';
const FALLBACK_FIELD_THEME = 'border border-white/10 bg-slate-900 text-zinc-200';

/** The one <select>: optional label + hint, themed `field` or inline `compact` look. */
export function SelectField<T extends string | number>({
  value, options, onChange, label, hint, variant = 'field', inputClassName = FALLBACK_FIELD_THEME, disabled = false, className = '',
}: SelectFieldProps<T>): React.ReactElement {
  const compact = variant === 'compact';
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const picked = options.find((option) => String(option.value) === event.target.value);
    if (picked) onChange(picked.value);
  };
  const select = (
    <select
      value={String(value)}
      onChange={handleChange}
      disabled={disabled}
      className={compact ? COMPACT_CLASS : `${FIELD_CLASS} ${inputClassName}`}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)} className="bg-slate-900 text-zinc-100">{option.label}</option>
      ))}
    </select>
  );
  if (compact && !label) return <div className={className}>{select}</div>;
  return (
    <div className={compact ? `flex items-center justify-between gap-3 py-2 ${className}` : `space-y-2 ${className}`}>
      {label && (
        <span className={compact ? 'shrink-0 text-xs text-zinc-400' : 'block font-mono text-[11px] font-extrabold uppercase tracking-wider text-zinc-500'}>{label}</span>
      )}
      {compact ? select : (
        <div className="relative">
          {select}
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
      )}
      {hint && <p className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">{hint}</p>}
    </div>
  );
}
