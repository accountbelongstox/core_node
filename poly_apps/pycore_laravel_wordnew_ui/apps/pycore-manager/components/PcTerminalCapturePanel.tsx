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
  const secondaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-500/20 bg-white/60 px-2 py-2 text-[11px] font-semibold text-slate-600 hover:border-emerald-500/40 hover:text-emerald-600 disabled:opacity-50 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:text-emerald-400';

  return (
    <section className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
            <ScanText className="h-3.5 w-3.5 text-emerald-500" />
            {t('terminal.capture.title')}
          </h3>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            {t('terminal.capture.hint')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void capture()}
        disabled={!actionable || working}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-500 disabled:opacity-50"
      >
        {capturing
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <FileText className="h-4 w-4" />}
        {t(capturing ? 'terminal.capture.running' : 'terminal.capture.action')}
      </button>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={openEditor}
          onChange={(event) => toggleOpenEditor(event.target.checked)}
          className="accent-emerald-500"
        />
        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        {t('terminal.capture.openEditor')}
      </label>
      {record && (
        <div className="space-y-2 rounded-lg border border-slate-500/15 bg-white/50 p-2.5 dark:bg-slate-950/30">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="truncate" title={record.name}>{record.name}</span>
            </p>
            <span className="shrink-0 text-[10px] text-slate-500">
              {new Date(record.capturedAt).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {t('terminal.capture.stats', { lines: record.lineCount, size: formatBytes(record.bytes) })}
            {record.editorRequested && (
              <span className={record.opened ? 'text-emerald-500' : 'text-amber-500'}>
                {' · '}{t(record.opened ? 'terminal.capture.opened' : 'terminal.capture.notOpened')}
              </span>
            )}
          </p>
          {record.path && (
            <p
              className="select-all truncate rounded bg-slate-500/10 px-2 py-1 font-mono text-[10px] text-slate-600 dark:text-slate-300"
              title={record.path}
            >
              {record.path}
            </p>
          )}
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" onClick={() => void copyText()} disabled={loadingContent} className={secondaryButton}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              {t('terminal.capture.copy')}
            </button>
            <button type="button" onClick={() => void download()} disabled={loadingContent} className={secondaryButton}>
              <Download className="h-3.5 w-3.5" />
              {t('terminal.capture.download')}
            </button>
            <button type="button" onClick={togglePreview} className={secondaryButton}>
              {previewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {t('terminal.capture.preview')}
            </button>
          </div>
          {previewOpen && (
            loadingContent && !previewText
              ? (
                <div className="flex items-center justify-center py-4 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )
              : (
                <pre className="max-h-72 overflow-auto whitespace-pre rounded-lg bg-slate-950 p-2.5 font-mono text-[10px] leading-relaxed text-slate-200">
                  {previewText || t('terminal.capture.previewEmpty')}
                </pre>
              )
          )}
        </div>
      )}
    </section>
  );
};
