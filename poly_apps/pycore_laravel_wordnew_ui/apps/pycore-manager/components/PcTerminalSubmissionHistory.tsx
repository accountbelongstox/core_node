import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clock3, Copy, Loader2, Pencil, ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { pycoreApi } from '@/apps/pycore-manager/api';
import type { TerminalLogEntry, TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { PcTerminalLogSourceBadge } from '@/apps/pycore-manager/components/PcTerminalLogDialog';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';

/** Collapsed rows show at most this many characters of the sent content. */
const SNIPPET_MAX_CHARS = 200;
const WHITESPACE_PATTERN = /\s+/g;

const STATUS_STYLES: Record<TerminalLogEntry['status'], string> = {
  sent: 'text-emerald-500',
  failed: 'text-rose-500',
  pending: 'text-amber-500',
};

type LogContentState = { loading: boolean; text: string };

function snippetOf(text: string): string {
  const compact = text.replace(WHITESPACE_PATTERN, ' ').trim();
  return compact.length > SNIPPET_MAX_CHARS ? `${compact.slice(0, SNIPPET_MAX_CHARS)}…` : compact;
}

interface PcTerminalSubmissionHistoryProps {
  windowInfo: TerminalWindowInfo | null;
  overlay: boolean;
  formatDate: (value: string) => string;
  errorTranslationKey: (errorCode?: string | null) => string;
  onOpenLogs: () => void;
  onReuse: (text: string) => void;
}

/** Submission history: every row shows a short content snippet and expands on its own. */
export const PcTerminalSubmissionHistory: React.FC<PcTerminalSubmissionHistoryProps> = ({
  windowInfo, overlay, formatDate, errorTranslationKey, onOpenLogs, onReuse,
}) => {
  const { t } = useTranslation('pc');
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [contents, setContents] = useState<Record<string, LogContentState>>({});
  const [copiedId, setCopiedId] = useState('');
  const requestedRef = useRef<Set<string>>(new Set());
  const terminalNumber = windowInfo?.terminal_number ?? 0;
  const logs = windowInfo?.logs ?? [];

  useEffect(() => {
    requestedRef.current = new Set();
    setContents({});
    setExpandedIds(new Set());
  }, [terminalNumber]);

  // Full content is fetched once per entry: when it is expanded, or when an
  // older entry has no stored preview to show as its snippet.
  useEffect(() => {
    if (!terminalNumber) return;
    for (const entry of logs) {
      const needed = expandedIds.has(entry.id) || !entry.preview;
      if (!needed || requestedRef.current.has(entry.id)) continue;
      requestedRef.current.add(entry.id);
      setContents((current) => ({ ...current, [entry.id]: { loading: true, text: '' } }));
      void pycoreApi.getTerminalContent(terminalNumber, 'log', entry.id)
        .then((text) => setContents((current) => ({ ...current, [entry.id]: { loading: false, text } })))
        .catch(() => setContents((current) => ({ ...current, [entry.id]: { loading: false, text: '' } })));
    }
  }, [expandedIds, logs, terminalNumber]);

  const toggle = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copy = async (id: string, text: string) => {
    if (await copyTextToSystemClipboard(text)) setCopiedId(id);
  };

  return (
    <div className="space-y-3 border-t border-slate-500/10 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Clock3 className="h-3.5 w-3.5 text-indigo-500" />
          {t('terminal.historyTitle')}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">
            {t('terminal.historyCount', { count: windowInfo?.log_count || 0 })}
          </span>
          <button
            type="button"
            onClick={onOpenLogs}
            disabled={!logs.length}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <ScrollText className="h-3 w-3" />
            {t('terminal.logs.open')}
          </button>
        </div>
      </div>
      {!logs.length ? (
        <p className="rounded-xl border border-dashed border-slate-500/20 p-4 text-center text-[11px] text-slate-500">
          {t('terminal.historyEmpty')}
        </p>
      ) : (
        <ul className={`${overlay ? 'max-h-80' : 'max-h-[28rem]'} space-y-2 overflow-y-auto pr-1`}>
          {logs.map((entry) => {
            const expanded = expandedIds.has(entry.id);
            const content = contents[entry.id];
            const snippet = snippetOf(entry.preview || content?.text || '');
            const fullText = content?.text ?? '';
            return (
              <li
                key={entry.id}
                className={`rounded-xl border transition-colors ${
                  expanded
                    ? 'border-indigo-500/40 bg-indigo-500/5'
                    : 'border-slate-500/15 bg-white/30 dark:bg-slate-950/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(entry.id)}
                  aria-expanded={expanded}
                  className="w-full p-2.5 text-left"
                >
                  <div className="flex items-center gap-2 text-[9px] text-slate-500">
                    {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <PcTerminalLogSourceBadge entry={entry} />
                    <span className="min-w-0 flex-1 truncate">{formatDate(entry.date)}</span>
                    <span className={`shrink-0 font-semibold ${STATUS_STYLES[entry.status]}`}>
                      {t(`terminal.logStatus.${entry.status}`)}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-3 max-h-[3.75rem] overflow-hidden break-all font-mono text-[11px] leading-5 text-slate-700 dark:text-slate-200">
                    {snippet || (content?.loading
                      ? t('common.loading')
                      : <span className="text-slate-400">{t('terminal.logs.emptyContent')}</span>)}
                  </p>
                </button>
                {expanded && (
                  <div className="border-t border-slate-500/10 px-2.5 pb-2.5 pt-2">
                    <pre className={`${overlay ? 'max-h-48' : 'max-h-64'} overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/[0.04] p-2 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-950/40 dark:text-slate-200`}>
                      {content?.loading || !content
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : fullText || t('terminal.logs.emptyContent')}
                    </pre>
                    {entry.error_code && (
                      <p className="mt-1.5 text-[10px] text-rose-500">{t(errorTranslationKey(entry.error_code))}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 [&_button]:whitespace-nowrap">
                      <span className="min-w-0 flex-1 truncate text-[9px] text-slate-500">
                        #{entry.terminal_number} · {entry.title || t('terminal.untitled')}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copy(entry.id, fullText)}
                        disabled={!fullText}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-500/20 disabled:opacity-50 dark:text-slate-300"
                      >
                        {copiedId === entry.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {t('terminal.logs.copy')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onReuse(fullText)}
                        disabled={!fullText}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('terminal.logs.reuse')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
