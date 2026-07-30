import React from 'react';
import { commonClasses } from '../../../styles/theme';
import { TranslationResponse } from '../../../types';

interface TranslationHistoryBarProps {
  history: TranslationResponse[];
  historyCollapsed: boolean;
  setHistoryCollapsed: (v: boolean) => void;
  setHistory: React.Dispatch<React.SetStateAction<TranslationResponse[]>>;
  loadHistoryItem: (item: TranslationResponse) => void;
  t: {
    history: string;
  };
}

const TranslationHistoryBar: React.FC<TranslationHistoryBarProps> = ({
  history,
  historyCollapsed,
  setHistoryCollapsed,
  setHistory,
  loadHistoryItem,
  t,
}) => {
  if (history.length === 0) return null;

  return (
    <div className={`mt-4 ${commonClasses.card} overflow-hidden`}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
        onClick={() => setHistoryCollapsed(!historyCollapsed)}
      >
        <h4 className="font-semibold text-sm">{t.history} ({history.length})</h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setHistory([]);
          }}
          className="text-xs text-slate-500 hover:text-red-500"
        >
          Clear
        </button>
      </div>
      {!historyCollapsed && (
        <div className="max-h-32 overflow-y-auto p-3 space-y-2">
          {history.map((item, idx) => (
            <div
              key={idx}
              onClick={() => loadHistoryItem(item)}
              className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">{item.original_text}</span>
                <span className="text-slate-400">→</span>
                <span className="text-slate-800 dark:text-slate-200">{item.translated_text}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {item.source_language} → {item.target_language}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TranslationHistoryBar;
