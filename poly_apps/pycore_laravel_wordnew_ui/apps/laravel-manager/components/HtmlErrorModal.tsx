import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Code, Eye, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { CopyButton } from './common/CopyButton';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
import { formatBytes } from '@/core/utils/formatBytes';

export interface HtmlErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  url: string;
  statusCode?: number;
}

export function HtmlErrorModal({
  isOpen,
  onClose,
  htmlContent,
  url,
  statusCode
}: HtmlErrorModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'preview' | 'source'>('preview');

  // Reset tab when reopened
  useEffect(() => {
    if (isOpen) setTab('preview');
  }, [isOpen]);

  // ESC to close (kept local so this modal doesn't depend on other modal infra)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const hasContent = (htmlContent || '').trim().length > 0;
  const contentSize = useMemo(() => formatBytes((htmlContent || '').length), [htmlContent]);
  const statusLabel = statusCode ? `HTTP ${statusCode}` : t('uiCommon.html_error.status_unknown');

  if (!isOpen) return null;

  return (
    <Portal>
    <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.error}`}>
      <div
        className={`absolute inset-0 ${OVERLAY_BACKDROP}`}
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-75" />

        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-black/5 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold tracking-tight">
              <AlertTriangle className="text-rose-500" size={18} />
              <span className="truncate">{t('uiCommon.html_error.title')}</span>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                {statusLabel}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                {contentSize}
              </span>
            </div>

            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <LinkIcon size={14} className="flex-shrink-0" />
                <span className="truncate" title={url}>
                  {url || t('uiCommon.html_error.no_url')}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <CopyButton
                  text={url || ''}
                  label={t('uiCommon.html_error.copy_url')}
                  size="sm"
                  variant="outline"
                  className="!border-slate-300 dark:!border-white/20 !text-slate-600 dark:!text-slate-300 hover:!bg-black/5 dark:hover:!bg-white/10"
                />
                <CopyButton
                  text={htmlContent || ''}
                  label={t('uiCommon.html_error.copy_html')}
                  size="sm"
                  variant="outline"
                  className="!border-slate-300 dark:!border-white/20 !text-slate-600 dark:!text-slate-300 hover:!bg-black/5 dark:hover:!bg-white/10"
                />
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
            title={t('common.close')}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 sm:px-6 py-3 border-b border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5
                ${tab === 'preview'
                  ? 'bg-indigo-600 text-white border-transparent shadow shadow-indigo-500/20'
                  : 'bg-white/50 dark:bg-black/20 text-slate-600 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'}
              `}
            >
              <Eye size={14} />
              {t('uiCommon.html_error.preview')}
            </button>

            <button
              type="button"
              onClick={() => setTab('source')}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5
                ${tab === 'source'
                  ? 'bg-indigo-600 text-white border-transparent shadow shadow-indigo-500/20'
                  : 'bg-white/50 dark:bg-black/20 text-slate-600 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'}
              `}
            >
              <Code size={14} />
              {t('uiCommon.html_error.source')}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('uiCommon.html_error.sandbox_note')}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 sm:p-6">
          {!hasContent ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="text-5xl font-black opacity-10 mb-4">{t('uiCommon.html_error.empty_badge')}</div>
              <p className="text-sm">{t('uiCommon.html_error.no_content')}</p>
            </div>
          ) : tab === 'preview' ? (
            <div className="h-full rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-black/20">
              <iframe
                title={t('uiCommon.html_error.preview_title')}
                className="w-full h-full"
                sandbox=""
                srcDoc={htmlContent}
              />
            </div>
          ) : (
            <pre className="h-full w-full overflow-auto rounded-xl border border-black/10 dark:border-white/10 bg-slate-950/95 text-slate-100 p-4 text-xs leading-relaxed font-mono">
              {htmlContent}
            </pre>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}

