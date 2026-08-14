import React from 'react';
import { Copy } from 'lucide-react';
import { useClipboard } from '@/apps/laravel-manager/hooks/useClipboard';

interface CodeDisplayProps {
  value: string;
  label?: string;
  showCopy?: boolean;
  className?: string;
}

export function CodeDisplay({ value, label, showCopy = true, className = '' }: CodeDisplayProps) {
  const { copy } = useClipboard();

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <div className={`bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 pr-12 font-mono text-sm break-all ${className}`}>
          {value}
        </div>
        {showCopy && (
          <button
            onClick={() => copy(value)}
            className="absolute top-3 right-3 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}
