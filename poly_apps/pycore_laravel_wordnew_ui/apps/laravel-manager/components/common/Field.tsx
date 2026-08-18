import React from 'react';

/**
 * Field — labeled form field (label + optional hint/error) wrapping any control as
 * children. Consolidates the ~93 inline `<div><label className='...'>{label}</label>
 * {input}</div>` idioms into one dark-mode + a11y-consistent component.
 */
export const Field: React.FC<{
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, hint, error, required, htmlFor, className = '', children }) => (
  <div className={`space-y-1.5 ${className}`}>
    {label ? (
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}{required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>
    ) : null}
    {children}
    {hint && !error ? <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    {error ? <p className="text-xs text-red-500">{error}</p> : null}
  </div>
);

export default Field;
