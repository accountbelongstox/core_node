/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React from 'react';

interface AuthInputProps {
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  label?: string;
  required?: boolean;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  autoComplete,
  onKeyPress,
  label,
  required = false,
}) => {
  const inputElement = (
    <input
      type={type}
      value={value}
      onChange={onChange}
      onKeyPress={onKeyPress}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className="w-full p-4 rounded-[var(--radius-button)] ds-glass ds-glass-edge border border-[var(--border-highlight)] outline-none text-[var(--color-text-primary)] transition-all disabled:opacity-50"
      style={{ boxShadow: '0 0 0 0 transparent' }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px var(--klein-ring)'; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = '0 0 0 0 transparent'; }}
      autoComplete={autoComplete}
    />
  );

  if (label) {
    return (
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {label}
        </label>
        {inputElement}
      </div>
    );
  }

  return inputElement;
};

