/**
 * PcImageSearchPage — pycore image-search (SerpApi Google-Images) evaluated
 * side-by-side with an AI render of the SAME query, plus the search history.
 * Status card + offline banner come from PcToolChrome; history from usePcHistory.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScanSearch, Sparkles, Search, Bot, ExternalLink, History, ImageOff, Layers, RefreshCw,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  ImageSearchStatus, ImageSearchResult, AiImageResponse, ImageSearchHistoryEntry,
} from '@/apps/pycore-manager/api';
import { PcPresenceBadge } from '../components/ai/PcStatusPill';
import PcHistoryList from '../components/ai/PcHistoryList';
import { PcSearchImage } from '../components/ai/tools/PcSearchImage';
import { PcToolStatusCard } from '../components/ai/tools/PcToolChrome';
import { usePcHistory } from '../hooks/usePcHistory';

const HISTORY_THUMBS = 4;

function aiSrc(ai: AiImageResponse | null): string | null {
  if (!ai || !ai.success || !ai.image_base64) return null;
  return `data:${ai.mime || 'image/png'};base64,${ai.image_base64}`;
}

export default function PcImageSearchPage() {
  const { t } = useTranslation('pc', { keyPrefix: 'imageSearch' });
  const [status, setStatus] = useState<ImageSearchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiImageResponse | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const history = usePcHistory('imageSearch');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await pycoreApi.getImageSearchStatus());
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const runSearch = useCallback(async () => {
    const clean = query.trim();
    if (!clean || searchBusy) return;
    setSearchBusy(true);
    setSearchError(null);
    setResults(null);
    try {
      const answer = await pycoreApi.searchImages(clean, status?.default_num || 12);
      setResults(answer.results || []);
      if (answer.error) setSearchError(answer.error);
      setOffline(false);
      void history.refresh();
    } catch (error: any) {
      setSearchError(error?.message || t('searchFailed'));
      setResults([]);
    } finally {
      setSearchBusy(false);
    }
  }, [query, searchBusy, status, history, t]);

  const runAi = useCallback(async () => {
    const clean = query.trim();
    if (!clean || aiBusy) return;
    setAiBusy(true);
    setAiResult(null);
    try {
      setAiResult(await pycoreApi.searchImagesAi(clean));
      setOffline(false);
    } catch (error: any) {
      setAiResult({
        success: false, provider: 'ai', model: '', image_base64: null,
        mime: 'image/png', latency_ms: null, error: error?.message || t('renderFailed'),
      });
    } finally {
      setAiBusy(false);
    }
  }, [query, aiBusy, t]);

  const runCompare = useCallback(async () => {
    const clean = query.trim();
    if (!clean || searchBusy || aiBusy) return;
    setSearchBusy(true);
    setAiBusy(true);
    setSearchError(null);
    setResults(null);
    setAiResult(null);
    try {
      const answer = await pycoreApi.compareImages(clean, status?.default_num || 12);
      setResults(answer.search?.results || []);
      setSearchError(answer.search?.error || null);
      setAiResult(answer.ai);
      setOffline(false);
      void history.refresh();
    } catch (error: any) {
      setSearchError(error?.message || t('compareFailed'));
      setResults([]);
    } finally {
      setSearchBusy(false);
      setAiBusy(false);
    }
  }, [query, searchBusy, aiBusy, status, history, t]);

  const aiImg = aiSrc(aiResult);
  const canRun = !!query.trim();

  const renderThumbs = (row: { raw: unknown }) => {
    const entry = row.raw as ImageSearchHistoryEntry;
    return (
      <div className="flex -space-x-2 shrink-0">
        {(entry.results || []).slice(0, HISTORY_THUMBS).map((result, index) => (
          <PcSearchImage
            key={index}
            url={result.thumbnail || result.url}
            alt=""
            className="w-9 h-9 rounded-lg object-cover border-2 border-white dark:border-slate-900 bg-slate-100"
          />
        ))}
        {(!entry.results || entry.results.length === 0) && (
          <span className="w-9 h-9 rounded-lg border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-black/30 flex items-center justify-center">
            <ImageOff className="w-4 h-4 text-slate-400" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PcToolStatusCard
        title={t('title')}
        subtitle={t('subtitle')}
        Icon={ScanSearch}
        accent="text-fuchsia-500"
        loading={loading}
        offline={offline}
        onRefresh={() => { void loadStatus(); }}
        statusLabel={t('status')}
        badges={<PcPresenceBadge ok={!!status?.available} yesLabel={t('available')} noLabel={t('unavailable')} />}
        fields={[
          { label: t('provider'), value: status?.provider || t('notSet') },
          { label: t('engine'), value: status?.engine || t('notSet') },
          { label: t('serviceUrl'), value: status?.service_url || t('notSet') },
          {
            label: t('historyCount'),
            Icon: History,
            value: status ? t('records', { count: status.history_count }) : t('notSet'),
          },
        ]}
        hint={status && !status.available ? t('noKeyHint') : null}
      />

      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Search className="w-4 h-4 text-fuchsia-500" /> {t('search')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{t('searchHint')}</p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void runSearch(); }}
            placeholder={t('queryPlaceholder')}
            className="flex-1 min-w-[220px] px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400"
          />
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={!canRun || searchBusy}
              className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {searchBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searchBusy ? t('searching') : t('searchSerp')}
            </button>
            <button
              type="button"
              onClick={() => void runAi()}
              disabled={!canRun || aiBusy}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {aiBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiBusy ? t('rendering') : t('renderAi')}
            </button>
            <button
              type="button"
              onClick={() => void runCompare()}
              disabled={!canRun || searchBusy || aiBusy}
              className="px-4 py-2.5 border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1 hover:border-slate-400 disabled:opacity-50">
              <Layers className="w-4 h-4" /> {t('compare')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-500 flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> {t('serpResults')}
              </span>
              {results && <span className="text-[10px] text-slate-400 font-mono">{t('results', { count: results.length })}</span>}
            </div>
            {searchError && <div className="text-sm text-rose-500 mb-2">{searchError}</div>}
            {results ? (
              results.length === 0 ? (
                !searchError && <div className="text-sm text-slate-400 flex items-center gap-2"><ImageOff className="w-4 h-4" /> {t('noResults')}</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {results.map((result, index) => (
                    <a
                      key={`${result.url}-${index}`}
                      href={result.link || result.url}
                      target="_blank"
                      rel="noreferrer"
                      title={result.title || result.source || t('open')}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/30">
                      <PcSearchImage
                        url={result.thumbnail || result.url}
                        alt={result.title || ''}
                        className="w-full h-full object-cover transition group-hover:scale-105"
                      />
                      <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[9px] font-mono text-white bg-black/55 truncate flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" /> {result.source || result.title || ''}
                      </span>
                    </a>
                  ))}
                </div>
              )
            ) : (
              <div className="text-sm text-slate-400">{t('noResult')}</div>
            )}
          </div>

          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" /> {t('aiRender')}
              </span>
              {aiResult?.success && aiResult.model && (
                <span className="text-[10px] font-semibold text-violet-400 font-mono truncate max-w-[120px]">
                  {t('model')}: {aiResult.model}
                </span>
              )}
            </div>
            {aiResult ? (
              aiImg ? (
                <img src={aiImg} alt={t('aiRender')} className="w-full rounded-xl border border-slate-200 dark:border-white/10" />
              ) : (
                <div className="text-sm text-rose-500">{aiResult.error || t('noResults')}</div>
              )
            ) : (
              <div className="text-sm text-slate-400">{t('noResult')}</div>
            )}
          </div>
        </div>
      </section>

      <section className="pc-glass p-6">
        <PcHistoryList
          history={history}
          showFilters={false}
          title={<><History className="w-4 h-4 text-fuchsia-500" /> {t('historyTitle')}</>}
          renderLeading={renderThumbs}
          onLoadRow={(row) => setQuery((row.raw as ImageSearchHistoryEntry).query)}
          maxHeightClass="max-h-[420px]"
        />
      </section>
    </div>
  );
}
