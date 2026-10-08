import React, { useEffect, useMemo, useState } from 'react';
import { Copy, CornerDownLeft, Pencil, ScrollText, Search, Send, Timer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { TerminalLogEntry, TerminalLogSource, TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';

export const LOG_SOURCES: TerminalLogSource[] = ['input', 'enter', 'schedule'];
const DEFAULT_LOG_SOURCE: TerminalLogSource = 'input';

const SOURCE_STYLES: Record<TerminalLogSource, string> = {
  input: 'bg-indigo-500/10 text-indigo-500',
  enter: 'bg-slate-500/15 text-slate-500 dark:text-slate-300',
  schedule: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const STATUS_STYLES: Record<TerminalLogEntry['status'], string> = {
  sent: 'text-emerald-500',
  failed: 'text-rose-500',
  pending: 'text-amber-500',
};

export function terminalLogSource(entry: TerminalLogEntry): TerminalLogSource {
  return entry.source && LOG_SOURCES.includes(entry.source) ? entry.source : DEFAULT_LOG_SOURCE;
}

export function terminalLogNamespace(terminalNumber: number): string {
  return `terminal.${String(terminalNumber).padStart(6, '0')}.log`;
}

export const PcTerminalLogSourceBadge: React.FC<{ entry: TerminalLogEntry }> = ({ entry }) => {
  const { t } = useTranslation('pc');
  const source = terminalLogSource(entry);
  const Icon = source === 'schedule' ? Timer : source === 'enter' ? CornerDownLeft : Send;
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${SOURCE_STYLES[source]}`}>
      <Icon className="h-2.5 w-2.5" />
      {t(`terminal.logSource.${source}`)}
    </span>
  );
};

interface PcTerminalLogDialogProps {
  windowInfo: TerminalWindowInfo;
  formatDate: (value: string) => string;
  errorTranslationKey: (errorCode?: string | null) => string;
  onReuse: (text: string) => void;
  /** Place the text in the composer and send it with the regular send. */
  onResend: (text: string) => void;
  onClose: () => void;
}

const PcTerminalLogDialog: React.FC<PcTerminalLogDialogProps> = ({
  windowInfo,
  formatDate,
  errorTranslationKey,
  onReuse,
  onResend,
  onClose,
}) => {
  const { t } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<TerminalLogSource | ''>('');
  const [selectedId, setSelectedId] = useState('');
  const [content, setContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [copyState, setCopyState] = useState<'' | 'copied' | 'failed'>('');
  const terminalNumber = windowInfo.terminal_number;

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return windowInfo.logs.filter((entry) => (
      (!sourceFilter || terminalLogSource(entry) === sourceFilter)
      && (!needle || String(entry.preview || '').toLowerCase().includes(needle))
    ));
  }, [query, sourceFilter, windowInfo.logs]);
  const selectedLog = filteredLogs.find((entry) => entry.id === selectedId) || null;

  useEffect(() => {
    if (!filteredLogs.some((entry) => entry.id === selectedId)) {
      setSelectedId(filteredLogs[0]?.id || '');
    }
  }, [filteredLogs, selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setCopyState('');
    if (!selectedId) {
      setContent('');
      return undefined;
    }
    setContentLoading(true);
    void terminalApi.getTerminalContent(terminalNumber, 'log', selectedId)
      .then((text) => { if (!cancelled) setContent(text); })
      .catch(() => { if (!cancelled) setContent(''); })
      .finally(() => { if (!cancelled) setContentLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [selectedId, terminalNumber]);

  const copyContent = async () => {
    setCopyState(await copyTextToSystemClipboard(content) ? 'copied' : 'failed');
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-sm md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('terminal.logs.title', { number: terminalNumber })}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 md:h-[86vh] md:rounded-2xl md:border md:border-slate-500/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-500/15 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <ScrollText className="h-4 w-4 text-indigo-500" />
              {t('terminal.logs.title', { number: terminalNumber })}
            </h2>
            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
              {t('terminal.logs.namespace', { namespace: terminalLogNamespace(terminalNumber) })}
              {' · '}
              {t('terminal.logs.shownCount', { shown: filteredLogs.length, total: windowInfo.log_count })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-500/10"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-500/10 px-4 py-2.5">
          <label className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('terminal.logs.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-500/20 bg-white/60 py-1.5 pl-8 pr-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
            />
          </label>
          {(['', ...LOG_SOURCES] as Array<TerminalLogSource | ''>).map((source) => (
            <button
              key={source || 'all'}
              type="button"
              onClick={() => setSourceFilter(source)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${
                sourceFilter === source
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 dark:text-slate-300'
              }`}
            >
              {source ? t(`terminal.logSource.${source}`) : t('terminal.logs.filterAll')}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-1">
          <div className="min-h-0 space-y-1.5 overflow-y-auto border-b border-slate-500/10 p-3 md:border-b-0 md:border-r">
            {!filteredLogs.length ? (
              <p className="rounded-xl border border-dashed border-slate-500/20 p-4 text-center text-[11px] text-slate-500">
                {t('terminal.logs.empty')}
              </p>
            ) : filteredLogs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                  selectedId === entry.id
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-slate-500/15 hover:border-indigo-400/40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <PcTerminalLogSourceBadge entry={entry} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-700 dark:text-slate-200">
                    {entry.preview || (terminalLogSource(entry) === 'enter' ? '↵' : '')}
                  </span>
                  <span className={`shrink-0 text-[9px] ${STATUS_STYLES[entry.status] || STATUS_STYLES.pending}`}>
                    {t(`terminal.logStatus.${entry.status}`)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[9px] text-slate-500">
                  {formatDate(entry.date)} · {entry.title || t('terminal.untitled')}
                </p>
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-col p-3">
            {!selectedLog ? (
              <p className="m-auto text-center text-[11px] text-slate-500">{t('terminal.logs.selectPrompt')}</p>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <PcTerminalLogSourceBadge entry={selectedLog} />
                  <span className="min-w-0 flex-1 truncate">{formatDate(selectedLog.date)}</span>
                  <button
                    type="button"
                    onClick={() => void copyContent()}
                    disabled={contentLoading || !content}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-500/20 disabled:opacity-50 dark:text-slate-300"
                  >
                    <Copy className="h-3 w-3" />
                    {t('terminal.logs.copy')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReuse(content)}
                    disabled={contentLoading || terminalLogSource(selectedLog) === 'enter'}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2 py-1 font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
                  >
                    <Pencil className="h-3 w-3" />
                    {t('terminal.logs.reuse')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResend(content)}
                    disabled={contentLoading || !content || !windowInfo.online || terminalLogSource(selectedLog) === 'enter'}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    {t('terminal.logs.reuseAndSend')}
                  </button>
                </div>
                {copyState && (
                  <p className={`mb-2 text-[10px] ${copyState === 'copied' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t(copyState === 'copied' ? 'terminal.logs.copied' : 'terminal.logs.copyFailed')}
                  </p>
                )}
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-500/15 bg-slate-950/[0.03] p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                  {contentLoading
                    ? t('common.loading')
                    : content || t('terminal.logs.emptyContent')}
                </pre>
                {selectedLog.error_code && (
                  <p className="mt-2 text-[10px] text-rose-500">
                    {t(errorTranslationKey(selectedLog.error_code))}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PcTerminalLogDialog;
