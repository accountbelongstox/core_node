/**
 * PromptDerivedPanel — the "Prompts" tab embedded in the global cloud
 * clipboard panel (ShellCloudClipboard). Paginated newest-first feed of
 * AI-derived English prompts produced by the pycore Linux prompt-derive
 * watcher; while page 1 is open, items pushed live via the
 * agent_history.prompt.derived bus topic trigger an instant refetch.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
import {
  pycoreEventBus,
  PYCORE_EVENT_TOPICS,
  PYCORE_HTTP_ROUTES,
  requestPycoreHttp,
} from '../../core/integrations/pycore';
import type {
  AgentHistoryPromptDerivedItem,
  AgentHistoryPromptDerivedResponse,
} from '../../core/integrations/pycore/PycoreSpeechTypes';
import { copyTextToSystemClipboard } from '../../core/browser/SystemClipboard';
import '../cloud-clipboard/CloudClipboardLocales';

const PAGE_SIZE = 20;

const buttonClass = 'inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs hover:bg-slate-500/10 disabled:opacity-40';

const PromptDerivedPanel: React.FC = () => {
  const { t } = useTranslation('cloudClipboard');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AgentHistoryPromptDerivedResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (target: number) => {
    setLoading(true);
    try {
      const res = await requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryPromptDerived, {
        page: target,
        page_size: PAGE_SIZE,
      }) as AgentHistoryPromptDerivedResponse;
      if (res?.success && res.data) {
        setData(res.data);
        setPage(res.data.page);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  // Live push: a fresh derivation refetches the newest page when it is shown.
  useEffect(() => pycoreEventBus.subscribe(
    PYCORE_EVENT_TOPICS.agentHistoryPromptDerived,
    () => { if (page === 1) void load(1); },
  ), [page, load]);

  const items: AgentHistoryPromptDerivedItem[] = data?.items ?? [];
  const pageCount = Math.max(1, Number(data?.page_count || 1));

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Bot size={16} className="shrink-0 text-indigo-500" />
        <p className="flex-1 text-xs text-slate-500">{t('promptDerivedHint')}</p>
        <button type="button" className={buttonClass} disabled={loading}
          title={t('retry')} aria-label={t('retry')} onClick={() => void load(page)}>
          <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {items.length === 0 && !loading && (
        <p className="text-xs text-slate-500">{t('promptDerivedEmpty')}</p>
      )}
      {items.map((item) => (
        <article key={item.id}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-3 space-y-2">
          <header className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-semibold uppercase text-indigo-600 dark:text-indigo-300">
              {item.tool || '?'}
            </span>
            <span className="font-mono">{item.time || item.derived_at || ''}</span>
            {item.model && <span className="font-mono truncate">{item.model}</span>}
            <button type="button" className={`${buttonClass} ml-auto`}
              onClick={() => void copyTextToSystemClipboard(item.derived_text)}>
              {t('copyContent')}
            </button>
          </header>
          <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
            {item.derived_text}
          </div>
          <details className="text-[11px] text-slate-500">
            <summary className="cursor-pointer select-none">{t('promptOriginal')}</summary>
            <p className="mt-1 whitespace-pre-wrap break-words font-mono">{item.source_text}</p>
          </details>
        </article>
      ))}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <button type="button" className={buttonClass} disabled={loading || page <= 1}
            onClick={() => void load(page - 1)}>
            <ChevronLeft size={12} />{t('previous')}
          </button>
          <span>{t('page', { page })} / {pageCount}</span>
          <button type="button" className={buttonClass} disabled={loading || page >= pageCount}
            onClick={() => void load(page + 1)}>
            {t('next')}<ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PromptDerivedPanel;
