import React from 'react';

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Leading icon drawn inside the input. */
  icon?: React.ReactNode;
  type?: 'text' | 'password' | 'url';
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  /** Rows > 0 renders a textarea. */
  rows?: number;
  /** Theme input classes replacing the default dark field look. */
  inputClassName?: string;
  className?: string;
}

const DEFAULT_INPUT = 'border border-white/10 bg-slate-900/60 text-slate-100 placeholder-zinc-500 focus:border-indigo-500';

/** The one labelled text input (optional leading icon, optional textarea). */
export const TextField: React.FC<TextFieldProps> = ({
  value, onChange, label, icon, type = 'text', placeholder, required, autoComplete, rows = 0, inputClassName = DEFAULT_INPUT, className = '',
}) => {
  const common = `w-full rounded-xl py-2.5 text-xs outline-none ${icon ? 'pl-10 pr-4' : 'px-3.5'} ${inputClassName}`;
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</label>}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        {rows > 0 ? (
          <textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${common} resize-none`} />
        ) : (
          <input type={type} value={value} placeholder={placeholder} required={required} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} className={common} />
        )}
      </div>
    </div>
  );
};
