import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ScanText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { TerminalCaptureResult } from '@/apps/pycore-manager/api';
import { PycoreManagerStorageKeys as StorageKeys } from '@/apps/pycore-manager/persistence/PycoreManagerStorageKeys';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';
import { offerTextFile } from '../../../core/browser/FileDownload';
import { StorageManager } from '../../../core/persistence';
import { formatBytes } from '../../../core/utils/formatters';

const OPEN_EDITOR_STORAGE_KEY = StorageKeys.PYCORE_TERMINAL_CAPTURE_OPEN_EDITOR;

export interface PcTerminalCaptureRecord {
  name: string;
  path: string;
  bytes: number;
  lineCount: number;
  opened: boolean;
  editorRequested: boolean;
  capturedAt: number;
}

interface PcTerminalCapturePanelProps {
  terminalNumber: number;
  actionable: boolean;
  busy: boolean;
  record: PcTerminalCaptureRecord | null;
  onCapture: (openEditor: boolean) => Promise<TerminalCaptureResult | null>;
  onClipboardResult: (copied: boolean) => void;
}

export function captureRecordFromResult(result: TerminalCaptureResult): PcTerminalCaptureRecord | null {
  if (!result.success || !result.name) return null;
  return {
    name: result.name,
    path: result.path ?? '',
    bytes: result.bytes ?? 0,
    lineCount: result.line_count ?? 0,
    opened: Boolean(result.opened),
    editorRequested: Boolean(result.editor_requested),
    capturedAt: Date.now(),
  };
}

/** Full-scrollback capture: select all + copy on the host, saved as .txt and optionally opened there. */
export const PcTerminalCapturePanel: React.FC<PcTerminalCapturePanelProps> = ({
  terminalNumber, actionable, busy, record, onCapture, onClipboardResult,
}) => {
  const { t } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const [openEditor, setOpenEditor] = useState<boolean>(
    () => StorageManager.get<boolean>(OPEN_EDITOR_STORAGE_KEY, true) !== false,
  );
  const [capturing, setCapturing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [content, setContent] = useState<{ name: string; text: string } | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    setPreviewOpen(false);
  }, [record?.name]);

  const toggleOpenEditor = useCallback((value: boolean) => {
    setOpenEditor(value);
    StorageManager.set(OPEN_EDITOR_STORAGE_KEY, value);
  }, []);

  const capture = useCallback(async () => {
    setCapturing(true);
    try {
      await onCapture(openEditor);
    } finally {
      setCapturing(false);
    }
  }, [onCapture, openEditor]);

  const loadContent = useCallback(async (): Promise<string | null> => {
    if (!record) return null;
    if (content?.name === record.name) return content.text;
    setLoadingContent(true);
    try {
      const text = await terminalApi.getTerminalContent(terminalNumber, 'capture', '', record.name);
      const normalized = typeof text === 'string' ? text : '';
      setContent({ name: record.name, text: normalized });
      return normalized;
    } catch {
      return null;
    } finally {
      setLoadingContent(false);
    }
  }, [content, record, terminalNumber]);

  const copyText = useCallback(async () => {
    const text = await loadContent();
    onClipboardResult(text !== null && await copyTextToSystemClipboard(text));
  }, [loadContent, onClipboardResult]);

  const download = useCallback(async () => {
    if (!record) return;
    const text = await loadContent();
    if (text !== null) offerTextFile(record.name, text);
  }, [loadContent, record]);

  const togglePreview = useCallback(() => {
    const next = !previewOpen;
    setPreviewOpen(next);
    if (next) void loadContent();
  }, [loadContent, previewOpen]);

  const working = capturing || busy;
  const previewText = record && content?.name === record.name ? content.text : '';
  const iconButton = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-40 dark:hover:text-emerald-400';

  // Compact row inside the send panel: capture button + "open in editor" toggle; the last capture below.
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void capture()}
          disabled={!actionable || working}
          title={t('terminal.capture.hint')}
          className="inline-flex h-6 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600/90 px-2 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:flex-none sm:px-3"
        >
          {capturing ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <ScanText className="h-3 w-3 shrink-0" />}
          <span className="truncate">{t(capturing ? 'terminal.capture.running' : 'terminal.capture.action')}</span>
        </button>
        <label title={t('terminal.capture.openEditor')} className="shrink-0 cursor-pointer">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={openEditor}
            onChange={(event) => toggleOpenEditor(event.target.checked)}
          />
          <span className="inline-flex h-6 items-center gap-0.5 rounded-md border border-slate-500/20 px-1 text-[10px] font-semibold text-slate-500 peer-checked:border-emerald-500/40 peer-checked:bg-emerald-500/15 peer-checked:text-emerald-600 dark:peer-checked:text-emerald-400">
            <ExternalLink className="h-3 w-3" />
            <FileText className="h-3 w-3" />
          </span>
        </label>
      </div>
      {record && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
          <span className="min-w-0 flex-1 truncate" title={record.path || record.name}>
            {t('terminal.capture.stats', { lines: record.lineCount, size: formatBytes(record.bytes) })}
            {record.editorRequested && (
              <span className={record.opened ? 'text-emerald-500' : 'text-amber-500'}>
                {' · '}{t(record.opened ? 'terminal.capture.opened' : 'terminal.capture.notOpened')}
              </span>
            )}
          </span>
          <button type="button" onClick={() => void copyText()} disabled={loadingContent} title={t('terminal.capture.copy')} aria-label={t('terminal.capture.copy')} className={iconButton}>
            <ClipboardCopy className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => void download()} disabled={loadingContent} title={t('terminal.capture.download')} aria-label={t('terminal.capture.download')} className={iconButton}>
            <Download className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={togglePreview} title={t('terminal.capture.preview')} aria-label={t('terminal.capture.preview')} aria-expanded={previewOpen} className={iconButton}>
            {previewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      {record && previewOpen && (
        loadingContent && !previewText
          ? (
            <div className="flex items-center justify-center py-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )
          : (
            <pre className="max-h-60 overflow-auto whitespace-pre rounded-md bg-slate-950 p-2 font-mono text-[10px] leading-relaxed text-slate-200">
              {previewText || t('terminal.capture.previewEmpty')}
            </pre>
          )
      )}
    </div>
  );
};
