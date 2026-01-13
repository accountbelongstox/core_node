/**
 * Dialog Component - React-based dialog for web fallback
 * Supports alert, confirm, and prompt dialogs
 * Multi-language and dark/light mode support
 */

import React, { useEffect, useRef, useState } from 'react';
import { LanguageCenter } from '../../i18n/LanguageCenter';

export interface DialogProps {
  type: 'alert' | 'confirm' | 'prompt';
  title: string;
  message: string;
  okButtonTitle?: string;
  cancelButtonTitle?: string;
  inputPlaceholder?: string;
  inputText?: string;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

export const Dialog: React.FC<DialogProps> = ({
  type,
  title,
  message,
  okButtonTitle,
  cancelButtonTitle,
  inputPlaceholder,
  inputText,
  onConfirm,
  onCancel,
}) => {
  const t = (key: string) => LanguageCenter.t(key);
  const [inputValue, setInputValue] = useState(inputText || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input for prompt dialogs
    if (type === 'prompt' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [type]);

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type === 'prompt') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full animate-slide-up border border-slate-200 dark:border-slate-700"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Input for prompt */}
        {type === 'prompt' && (
          <div className="px-6 pb-4">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 pt-4 flex gap-3">
          {type === 'confirm' || type === 'prompt' ? (
            <>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-lg font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {cancelButtonTitle || t('common.cancel')}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-3 rounded-lg font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {okButtonTitle || t('common.confirm')}
              </button>
            </>
          ) : (
            <button
              onClick={handleConfirm}
              className="w-full px-4 py-3 rounded-lg font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {okButtonTitle || t('common.ok')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

