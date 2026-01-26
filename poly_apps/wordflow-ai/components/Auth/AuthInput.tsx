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
      className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all disabled:opacity-50"
      autoComplete={autoComplete}
    />
  );

  if (label) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {label}
        </label>
        {inputElement}
      </div>
    );
  }

  return inputElement;
};

