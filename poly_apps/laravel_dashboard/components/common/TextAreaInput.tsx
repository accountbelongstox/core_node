import React from 'react';

interface TextAreaInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  showCharCount?: boolean;
  className?: string;
}

export function TextAreaInput({
  value,
  onChange,
  label,
  placeholder,
  rows = 8,
  readOnly = false,
  showCharCount = true,
  className = ''
}: TextAreaInputProps) {
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
          {showCharCount && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {value.length} characters
            </span>
          )}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${readOnly ? 'bg-gray-50 dark:bg-gray-900' : ''} ${className}`}
      />
    </div>
  );
}
