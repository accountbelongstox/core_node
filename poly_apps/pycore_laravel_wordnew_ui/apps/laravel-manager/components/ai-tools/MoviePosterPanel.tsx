/**
 * MoviePosterPanel — laravel-manager view of the movie/TV poster pipeline.
 *
 * Reads GET /media/poster/status (mcp-chrome ownership + per-type queue counts)
 * and exposes a "Queue poster" control that calls
 * POST /media/poster/fetch for one media row (book / subtitle, by id or
 * source_key) to move it to the shared mcp-chrome queue head.
 *
 * Styling reuses the shared AI Tools kit (ToolWrapper / AiBentoCard /
 * AiToolAlert / provider badges) — no new design system.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Film, RefreshCcw, CheckCircle2, MinusCircle, AlertTriangle, ImageIcon, Send,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import type {
  PosterStatusData, PosterStatusCounts, PosterFetchResult,
} from '@/apps/laravel-manager/api';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import { AI_BODY, AI_GRID_2, AiBentoCard, AiToolAlert } from '@/shared/ui/AiToolUi';

type MediaType = 'book' | 'subtitle';

const COUNT_META: Array<{ key: keyof PosterStatusCounts; tone: string }> = [
  { key: 'ready', tone: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'pending', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'failed', tone: 'text-rose-600 dark:text-rose-400' },
  { key: 'none', tone: 'text-slate-500 dark:text-slate-400' },
];

const inputCls = `${commonClasses.input} !py-2 text-xs font-mono disabled:opacity-50`;
const selectCls = `${commonClasses.input} !py-2 text-xs disabled:opacity-50`;

/** A single configured/not-configured pill, matching AiStatusPanel badges. */
const ConfigBadge: React.FC<{ ok: boolean; okLabel: string; offLabel: string }> = ({ ok, okLabel, offLabel }) => (
  <span
    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
      ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'
    }`}
  >
    {ok ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
    {ok ? okLabel : offLabel}
  </span>
);

/** Per-type poster_status count chips. */
const CountChips: React.FC<{ counts: PosterStatusCounts }> = ({ counts }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {COUNT_META.map((m) => (
        <div key={m.key} className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-500/5 dark:bg-white/5 min-w-[60px]">
          <span className={`text-base font-bold tabular-nums ${m.tone}`}>{(counts[m.key] ?? 0).toLocaleString()}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{t(`uiAi.movie_poster.count.${m.key}`)}</span>
        </div>
      ))}
      <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-900/[0.04] dark:bg-white/[0.06] min-w-[60px]">
        <span className="text-base font-bold tabular-nums text-slate-700 dark:text-slate-200">{(counts.total ?? 0).toLocaleString()}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{t('uiAi.movie_poster.count.total')}</span>
      </div>
    </div>
  );
};

const MoviePosterPanel: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PosterStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual priority control state.
  const [testType, setTestType] = useState<MediaType>('book');
  const [testId, setTestId] = useState<string>('');
  const [testSourceKey, setTestSourceKey] = useState<string>('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchResult, setFetchResult] = useState<PosterFetchResult | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.appQyV1.getPosterStatus();
      if (res.success && res.data) {
        setStatus(res.data);
        setError(null);
      } else {
        setError(res.error || t('uiAi.movie_poster.status_unavailable'));
      }
    } catch (e: any) {
      setError(e?.message || t('uiAi.movie_poster.status_unreachable'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(false); }, [load]);

  const runFetch = useCallback(async () => {
    const id = testId.trim();
    const sourceKey = testSourceKey.trim();
    if (id === '' && sourceKey === '') {
      setFetchError(t('uiAi.movie_poster.id_or_source_required'));
      return;
    }
    setFetching(true);
    setFetchError(null);
    setFetchResult(null);
    try {
      const res = await api.appQyV1.fetchPoster(testType, {
        id: id !== '' ? id : undefined,
        sourceKey: sourceKey !== '' ? sourceKey : undefined,
      });
      if (res.success && res.data) {
        setFetchResult(res.data);
      } else {
        // The server returns a data payload (image_url/poster_status) even on
        // some non-2xx outcomes — surface it alongside the error.
        setFetchResult((res.data as PosterFetchResult) ?? null);
        setFetchError(res.error || t('uiAi.movie_poster.fetch_failed'));
      }
    } catch (e: any) {
      setFetchError(e?.message || t('uiAi.movie_poster.fetch_request_failed'));
    } finally {
      setFetching(false);
    }
  }, [testType, testId, testSourceKey, t]);

  const mcpChrome = status?.providers.find((p) => p.name === 'mcp-chrome');

  const statusTone = (s?: string): string => {
    if (s === 'ready') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    if (s === 'failed') return 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
    if (s === 'pending') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
    return 'bg-slate-500/15 text-slate-500 dark:text-slate-400';
  };

  return (
    <ToolWrapper
      title={t('uiAi.movie_poster.title')}
      icon={Film}
      gradient="indigo"
      description={t('uiAi.movie_poster.description')}
      actions={
        <button
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {t('uiAi.movie_poster.refresh')}
        </button>
      }
    >
      <div className={AI_BODY}>
        {error && (
          <AiToolAlert variant="warning">
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </span>
          </AiToolAlert>
        )}

        {/* Execution ownership */}
        <AiBentoCard title={t('uiAi.movie_poster.execution_owner')}>
          {loading && !status ? (
            <div className="text-xs text-slate-500 py-6 text-center flex flex-col items-center gap-2">
              <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> {t('uiAi.movie_poster.loading_status')}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">apps/mcp-chrome</span>
                <ConfigBadge ok={!!mcpChrome?.configured} okLabel={t('uiAi.movie_poster.queue_owner')} offLabel={t('uiAi.movie_poster.unavailable')} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('uiAi.movie_poster.owner_desc')}
              </p>
            </div>
          )}
        </AiBentoCard>

        {/* Per-type poster_status counts */}
        <AiBentoCard title={t('uiAi.movie_poster.status_counts')}>
          <div className={AI_GRID_2}>
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('uiAi.movie_poster.books')}</div>
              <CountChips counts={status?.counts?.book ?? { pending: 0, ready: 0, failed: 0, none: 0, total: 0 }} />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('uiAi.movie_poster.subtitles')}</div>
              <CountChips counts={status?.counts?.subtitle ?? { pending: 0, ready: 0, failed: 0, none: 0, total: 0 }} />
            </div>
          </div>
        </AiBentoCard>

        {/* Queue one poster */}
        <AiBentoCard title={t('uiAi.movie_poster.queue_poster_title')}>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('uiAi.movie_poster.queue_desc')}
            </p>

            <div className={AI_GRID_2}>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('uiAi.movie_poster.type')}</span>
                <select value={testType} onChange={(e) => setTestType(e.target.value as MediaType)} className={selectCls}>
                  <option value="book">{t('uiAi.movie_poster.type_book')}</option>
                  <option value="subtitle">{t('uiAi.movie_poster.type_subtitle')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('uiAi.movie_poster.id')}</span>
                <input
                  value={testId}
                  onChange={(e) => setTestId(e.target.value)}
                  placeholder={t('uiAi.movie_poster.id_placeholder')}
                  className={inputCls}
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('uiAi.movie_poster.source_key')} <span className="normal-case font-normal text-slate-400">{t('uiAi.movie_poster.source_key_hint')}</span>
              </span>
              <input
                value={testSourceKey}
                onChange={(e) => setTestSourceKey(e.target.value)}
                placeholder="source_key"
                className={inputCls}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={runFetch}
                disabled={fetching}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
              >
                {fetching ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {fetching ? t('uiAi.movie_poster.queueing') : t('uiAi.movie_poster.queue_poster')}
              </button>
              {fetchResult && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusTone(fetchResult.poster_status)}`}
                >
                  {fetchResult.poster_status}
                  {fetchResult.provider ? ` · ${fetchResult.provider}` : ''}
                  {fetchResult.already_done ? ` · ${t('uiAi.movie_poster.tag_cached')}` : ''}
                  {fetchResult.queued ? ` · ${t('uiAi.movie_poster.tag_queued')}` : ''}
                </span>
              )}
            </div>

            {fetchError && (
              <AiToolAlert>
                <span className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{fetchError}</span>
                </span>
              </AiToolAlert>
            )}

            {fetchResult?.image_url ? (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">{t('uiAi.movie_poster.poster')}</div>
                <img
                  src={fetchResult.image_url}
                  alt={t('uiAi.movie_poster.poster_alt')}
                  className="max-h-72 w-auto rounded-xl border border-slate-200/70 dark:border-white/10 shadow-sm"
                />
                <p className="mt-1.5 text-[10px] font-mono break-all text-slate-400">{fetchResult.image_url}</p>
              </div>
            ) : fetchResult && !fetchError ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ImageIcon className="w-4 h-4" /> {t('uiAi.movie_poster.queued_no_poster')}
              </div>
            ) : null}
          </div>
        </AiBentoCard>
      </div>
    </ToolWrapper>
  );
};

export default MoviePosterPanel;
