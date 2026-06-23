/* [v4.1-Iris] Reference-parity verified; modal z-index normalized to ds-z-modal (centralized stacking; was ad-hoc z-[10000]). Propagate the Iris layer to un-beautified siblings. */
/**
 * Dialog Component - React-based dialog for web fallback
 * Supports alert, confirm, and prompt dialogs
 * Multi-language and dark/light mode support
 */
import React, { useEffect, useRef, useState } from 'react';
import { LanguageCenter } from '../../i18n/LanguageCenter';
import { Portal } from '../UI';

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
    <Portal>
    <div className="ds-modal-backdrop fixed inset-0 ds-z-modal flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="ds-modal-panel max-w-sm w-full animate-slide-up"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-4 ds-section-gap">
          <h2 className="ds-section-title !text-xl mb-2">
            {title}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {message}
          </p>
        </div>

        {/* Input for prompt */}
        {type === 'prompt' && (
          <div className="px-7 pb-4">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full px-4 py-3 rounded-[var(--radius-button)] ds-glass ds-glass-edge border border-[var(--border-highlight)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-all"
              style={{ boxShadow: '0 0 0 0 transparent' }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px var(--klein-ring)'; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = '0 0 0 0 transparent'; }}
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-7 pb-7 pt-5 flex gap-3">
          {type === 'confirm' || type === 'prompt' ? (
            <>
              <button
                onClick={onCancel}
                className="flex-1 ds-touch-target px-4 py-3 rounded-[var(--radius-button)] font-semibold text-sm ds-glass ds-glass-edge border border-[var(--border-highlight)] text-[var(--color-text-primary)] hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {cancelButtonTitle || t('common.cancel')}
              </button>
              <button
                onClick={handleConfirm}
                className="ds-btn-klein flex-1 ds-touch-target px-4 py-3 text-sm"
              >
                {okButtonTitle || t('common.confirm')}
              </button>
            </>
          ) : (
            <button
              onClick={handleConfirm}
              className="ds-btn-klein w-full ds-touch-target px-4 py-3 text-sm"
            >
              {okButtonTitle || t('common.ok')}
            </button>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
};

