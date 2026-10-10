/**
 * PromptDerivedPanel — the "Prompts" tab embedded in the global cloud
 * clipboard panel (ShellCloudClipboard). Paginated newest-first feed of
 * AI-derived English prompts produced by the pycore Linux prompt-derive
 * watcher; while page 1 is open, the shared agent-history prompt feed
 * refetches it on every agent_history.prompt.derived push.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Bot, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
import {
  pycoreApi,
  PYCORE_EVENT_TOPICS,
  useAgentHistoryPromptFeed,
} from '../../core/integrations/pycore';
import {
  persistAgentHistoryArticleConfig,
  useAgentHistoryRuntime,
} from '@/apps/pycore-manager/api';
import type {
  AgentHistoryPromptDerivedItem,
  AgentHistoryPromptDerivedResponse,
} from '../../core/integrations/pycore/PycoreSpeechTypes';

const DERIVED_FEED_TOPICS: readonly string[] = [PYCORE_EVENT_TOPICS.agentHistoryPromptDerived];
import { copyTextToSystemClipboard } from '../../core/browser/SystemClipboard';
import '../cloud-clipboard/CloudClipboardLocales';
import { deviceKvGet, deviceKvSet } from '../persistence/DeviceKvCache';

const PAGE_SIZE = 20;
/** Newest page kept on the device so the feed shows at once, offline included. */
const NEWEST_PAGE_CACHE_KEY = 'prompts.derived.newest';

const buttonClass = 'inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs hover:bg-slate-500/10 disabled:opacity-40';

const PromptDerivedPanel: React.FC = () => {
  const { t } = useTranslation('cloudClipboard');
  const { articleConfig } = useAgentHistoryRuntime();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AgentHistoryPromptDerivedResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [soundBusy, setSoundBusy] = useState(false);

  // pycore owns sound playback; this toggle persists the shared config flag
  // (prompt_derive_sound) that the derive worker checks before every playback.
  const soundEnabled = articleConfig ? articleConfig.prompt_derive_sound !== false : true;

  const toggleSound = useCallback(async () => {
    setSoundBusy(true);
    try {
      await persistAgentHistoryArticleConfig({ prompt_derive_sound: !soundEnabled });
    } finally {
      setSoundBusy(false);
    }
  }, [soundEnabled]);

  const load = useCallback(async (target: number) => {
    setLoading(true);
    try {
      const res = await pycoreApi.getAgentHistoryPromptDerived({ page: target, pageSize: PAGE_SIZE });
      if (res?.success && res.data) {
        setData(res.data);
        setPage(res.data.page);
        if (res.data.page === 1) void deviceKvSet(NEWEST_PAGE_CACHE_KEY, res.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void deviceKvGet<AgentHistoryPromptDerivedResponse['data']>(NEWEST_PAGE_CACHE_KEY)
      .then((cached) => { if (cached) setData((current) => current ?? cached); });
    void load(1);
  }, [load]);

  const reloadNewest = useCallback(() => load(1), [load]);
  useAgentHistoryPromptFeed(reloadNewest, { enabled: page === 1, topics: DERIVED_FEED_TOPICS });

  const items: AgentHistoryPromptDerivedItem[] = data?.items ?? [];
  const pageCount = Math.max(1, Number(data?.page_count || 1));

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Bot size={16} className="shrink-0 text-indigo-500" />
        <p className="flex-1 text-xs text-slate-500">{t('promptDerivedHint')}</p>
        <button type="button" className={buttonClass} disabled={soundBusy}
          title={soundEnabled ? t('promptSoundOn') : t('promptSoundOff')}
          aria-label={soundEnabled ? t('promptSoundOn') : t('promptSoundOff')}
          onClick={() => void toggleSound()}>
          {soundEnabled ? <Bell size={12} /> : <BellOff size={12} />}
        </button>
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
