import React from 'react';
import { Clock, Trash2, Copy, CheckCircle, XCircle } from 'lucide-react';
import { ToolHistoryItem } from '../../core/types';
import { commonClasses } from '../../styles/theme';
import { AiBentoCard } from '../ai-tools/ui';

interface HistoryListProps {
  items: ToolHistoryItem[];
  onDelete?: (index: number) => void;
  onCopy?: (item: ToolHistoryItem) => void;
  maxItems?: number;
  showInput?: boolean;
  showOutput?: boolean;
}

/**
 * HistoryList - Display tool execution history
 */
const HistoryList: React.FC<HistoryListProps> = ({
  items,
  onDelete,
  onCopy,
  maxItems = 20,
  showInput = true,
  showOutput = true
}) => {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No history yet</p>
      </div>
    );
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const handleCopy = (item: ToolHistoryItem) => {
    const textToCopy = item.output ? JSON.stringify(item.output, null, 2) : JSON.stringify(item.input, null, 2);
    navigator.clipboard.writeText(textToCopy);

    if (onCopy) {
      onCopy(item);
    }
  };

  const renderValue = (value: any): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      // For objects, try to extract a meaningful display value
      if (value.translated_text) return value.translated_text;
      if (value.text) return value.text;
      if (value.audio_url) return 'Audio generated';
      if (value.image_url) return 'Image generated';
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {displayItems.map((item, index) => (
        <AiBentoCard
          key={`history-${item.timestamp}-${index}`}
          className="!shadow-none ring-1 ring-slate-200/50 dark:ring-white/5"
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.success ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(item.timestamp)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Copy button */}
                <button
                  onClick={() => handleCopy(item)}
                  className={`${commonClasses.button} ${commonClasses.buttonSecondary} p-1`}
                  title="Copy to clipboard"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {/* Delete button */}
                {onDelete && (
                  <button
                    onClick={() => onDelete(index)}
                    className={`${commonClasses.button} ${commonClasses.buttonSecondary} p-1 hover:bg-red-500 hover:text-white`}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Input */}
            {showInput && item.input && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Input:
                </p>
                <div className="bg-slate-100/80 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {renderValue(item.input)}
                  </p>
                </div>
              </div>
            )}

            {/* Output */}
            {showOutput && item.output && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Output:
                </p>
                <div className="bg-slate-100/80 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {renderValue(item.output)}
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {!item.success && (
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
                  Error:
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Execution failed
                  </p>
                </div>
              </div>
            )}
          </div>
        </AiBentoCard>
      ))}

      {items.length > maxItems && (
        <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-2">
          Showing {maxItems} of {items.length} items
        </p>
      )}
    </div>
  );
};

export default HistoryList;
