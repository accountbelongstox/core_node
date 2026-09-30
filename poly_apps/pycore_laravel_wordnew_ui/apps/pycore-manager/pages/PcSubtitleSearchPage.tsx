/**
 * PcSubtitleSearchPage — pycore subtitle-search (OpenSubtitles): status + probe,
 * the provider fallback chain with per-provider test, the download cache, title
 * search with .srt download and the shared search history. Status card + offline
 * banner come from PcToolChrome; history from usePcHistory.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Captions, RefreshCw, CheckCircle2, MinusCircle, Languages,
  Search, Download, Trash2, History, FileX, Activity, ShieldCheck,
  ListOrdered, Play, Loader2, Database,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  SubtitleSearchStatus, SubtitleSearchProbe, SubtitleResult,
  SubtitleSearchHistoryEntry, SubtitleProvider, SubtitleProviderProbe,
  SubtitleCacheStats,
} from '@/apps/pycore-manager/api';
import { formatBytes } from '../../../core/utils/formatters';
import { PcOfflineBanner, PcToolStatusCard } from '../components/ai/tools/PcToolChrome';
import { PcPresenceBadge } from '../components/ai/PcStatusPill';
import PcHistoryList from '../components/ai/PcHistoryList';
import { usePcHistory } from '../hooks/usePcHistory';

const DEFAULT_LANGUAGES = 'en,zh-cn';
const HISTORY_LIST_HEIGHT = 'max-h-[420px]';
const inputClass = 'w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400';

/** Offer downloaded subtitle text as a .srt file. */
function offerSrt(name: string, content: string) {
  try {
    const blob = new Blob([content], { type: 'application/x-subrip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch { /* non-DOM environment */ }
}

export default function PcSubtitleSearchPage() {
  const { t } = useTranslation('pc', { keyPrefix: 'subtitlePage' });
  const [status, setStatus] = useState<SubtitleSearchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [probe, setProbe] = useState<SubtitleSearchProbe | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);

  const [providers, setProviders] = useState<SubtitleProvider[] | null>(null);
  const [providerTests, setProviderTests] = useState<Record<string, { testing?: boolean; result?: SubtitleProviderProbe }>>({});

  const [cache, setCache] = useState<SubtitleCacheStats | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheNote, setCacheNote] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES);
  const [year, setYear] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');

  const [results, setResults] = useState<SubtitleResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);

  const history = usePcHistory('subtitleSearch');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await pycoreApi.getSubtitleSearchStatus());
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const answer = await pycoreApi.getSubtitleProviders();
      setProviders((answer.providers || []).slice().sort((a, b) => a.order - b.order));
    } catch { /* keep the last providers */ }
  }, []);

  const loadCache = useCallback(async () => {
    try {
      setCache(await pycoreApi.getSubtitleCacheStats());
    } catch { /* keep the last cache stats */ }
  }, []);

  const refreshAll = useCallback(() => {
    void loadStatus();
    void loadProviders();
    void loadCache();
  }, [loadStatus, loadProviders, loadCache]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const onClearCache = useCallback(async () => {
    if (cacheBusy) return;
    setCacheBusy(true);
    setCacheNote(null);
    try {
      const answer = await pycoreApi.clearSubtitleCache();
      setCacheNote(`${t('cacheCleared')} · ${answer.removed ?? 0} ${t('cacheRemoved')}`);
      await loadCache();
    } catch {
      setCacheNote(t('clearFailed'));
    } finally {
      setCacheBusy(false);
    }
  }, [cacheBusy, loadCache, t]);

  const runProviderTest = useCallback(async (name: string) => {
    setProviderTests((map) => ({ ...map, [name]: { ...map[name], testing: true } }));
    try {
      const result = await pycoreApi.testSubtitleProvider(name);
      setProviderTests((map) => ({ ...map, [name]: { testing: false, result } }));
    } catch {
      setProviderTests((map) => ({
        ...map,
        [name]: { testing: false, result: { name, available: false, latency_ms: null, error: t('testFailed') } },
      }));
    }
  }, [t]);

  const runProbe = useCallback(async () => {
    if (probeBusy) return;
    setProbeBusy(true);
    try {
      setProbe(await pycoreApi.probeSubtitleSearch());
      setOffline(false);
    } catch {
      setProbe({ configured: false, available: false, latency_ms: null, error: t('probeFailed') });
    } finally {
      setProbeBusy(false);
    }
  }, [probeBusy, t]);

  const runSearch = useCallback(async () => {
    const clean = query.trim();
    if (!clean || searchBusy) return;
    setSearchBusy(true);
    setSearchError(null);
    setResults(null);
    setDownloadNote(null);
    try {
      const answer = await pycoreApi.searchSubtitles(clean, {
        languages: languages.trim() || undefined,
        year: year.trim() ? Number(year) : undefined,
        season: season.trim() ? Number(season) : undefined,
        episode: episode.trim() ? Number(episode) : undefined,
      });
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
  }, [query, languages, year, season, episode, searchBusy, history, t]);

  const runDownload = useCallback(async (result: SubtitleResult) => {
    const id = String(result.file_id);
    if (downloadingId) return;
    setDownloadingId(id);
    setDownloadNote(null);
    try {
      const answer = await pycoreApi.downloadSubtitle(result.file_id);
      if (!answer.success) {
        setDownloadNote(answer.error || t('noResults'));
      } else {
        const fileName = answer.file_name || `${result.title || 'subtitle'}.${answer.format || 'srt'}`;
        if (answer.content) {
          offerSrt(fileName, answer.content);
          setDownloadNote(`${t('downloaded')}: ${fileName}`);
        } else if (answer.saved_path) {
          setDownloadNote(`${t('saved')} ${answer.saved_path}`);
        } else {
          setDownloadNote(`${t('downloaded')}: ${answer.link || fileName}`);
        }
      }
      setOffline(false);
    } catch (error: any) {
      setDownloadNote(error?.message || t('downloadFailed'));
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, t]);

  const onLoadHistoryEntry = useCallback((entry: SubtitleSearchHistoryEntry) => {
    setQuery(entry.query);
    setLanguages((entry.languages || []).join(',') || DEFAULT_LANGUAGES);
    setYear(entry.year != null ? String(entry.year) : '');
    if (entry.results && entry.results.length) {
      setResults(entry.results);
      setSearchError(null);
    }
  }, []);

  const canRun = !!query.trim();

  return (
    <div className="space-y-5">
      <PcToolStatusCard
        title={t('title')}
        subtitle={t('subtitle')}
        Icon={Captions}
        accent="text-fuchsia-500"
        loading={loading}
        offline={offline}
        onRefresh={refreshAll}
        statusLabel={t('status')}
        badges={(
          <>
            <PcPresenceBadge ok={!!status?.authenticated} yesLabel={t('authenticated')} noLabel={t('notAuthenticated')} />
            <PcPresenceBadge ok={!!status?.available} yesLabel={t('available')} noLabel={t('unavailable')} />
          </>
        )}
        fields={[
          { label: t('provider'), value: status?.provider || t('notSet') },
          { label: t('serviceUrl'), value: status?.service_url || t('notSet') },
          { label: t('keyName'), Icon: ShieldCheck, value: status?.key_name || t('notSet') },
          {
            label: t('historyCount'),
            Icon: History,
            value: status ? `${status.history_count} ${t('records')}` : t('notSet'),
          },
        ]}
        hint={status && !status.available ? t('noKeyHint') : null}
        footer={(
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => void runProbe()}
              disabled={probeBusy}
              className="px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 disabled:opacity-50">
              {probeBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {probeBusy ? t('probing') : t('probe')}
            </button>
            {probe && (
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <PcPresenceBadge ok={!!probe.available} yesLabel={t('probeOk')} noLabel={t('probeFail')} />
                {probe.latency_ms != null && <span className="text-slate-400">{t('latency')}: {probe.latency_ms} ms</span>}
                {probe.languages_count != null && <span className="text-slate-400">{probe.languages_count} {t('languagesCount')}</span>}
                {probe.error && <span className="text-rose-500">{probe.error}</span>}
              </div>
            )}
          </div>
        )}
      />

      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <ListOrdered className="w-4 h-4 text-fuchsia-500" /> {t('providers')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">{t('providersHint')}</p>

        {providers && providers.length === 0 && <div className="text-sm text-slate-400">{t('noProviders')}</div>}
        {!providers && offline && <PcOfflineBanner />}

        {providers && providers.length > 0 && (
          <div className="space-y-2">
            {providers.map((provider) => {
              const providerTest = providerTests[provider.name];
              const testing = !!providerTest?.testing;
              const result = providerTest?.result;
              return (
                <div
                  key={provider.name}
                  className={`rounded-xl p-3.5 border flex items-start gap-3 ${provider.fallback
                    ? 'bg-white/30 dark:bg-white/[0.03] border-slate-300/25 dark:border-white/5 opacity-90'
                    : 'bg-white/55 dark:bg-white/5 border-fuchsia-300/40 dark:border-fuchsia-500/20'}`}>
                  <span className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${provider.fallback
                    ? 'bg-slate-500/15 text-slate-400'
                    : 'bg-fuchsia-600 text-white shadow shadow-fuchsia-600/30'}`}>
                    #{provider.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{provider.label}</span>
                      <PcPresenceBadge ok={provider.available} yesLabel={t('providerAvailable')} noLabel={t('providerUnavailable')} />
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${provider.fallback
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'bg-fuchsia-500/15 text-fuchsia-500'}`}>
                        {provider.fallback ? t('fallbackTag') : t('primary')}
                      </span>
                    </div>
                    {provider.note && <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{provider.note}</div>}
                    {!provider.available && provider.needs && (
                      <div className="mt-1.5 text-[10px] text-amber-500 font-mono break-all">
                        <span className="uppercase tracking-wider mr-1 text-slate-400">{t('needsLabel')}:</span>{provider.needs}
                      </div>
                    )}
                    {result && (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono">
                        {result.available
                          ? <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /> {t('testOk')}{result.latency_ms != null ? ` · ${result.latency_ms}ms` : ''}</span>
                          : <span className="flex items-center gap-1 text-rose-500"><MinusCircle className="w-3.5 h-3.5" /> {t('testFail')}{result.error ? ` · ${result.error}` : ''}</span>}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void runProviderTest(provider.name)}
                    disabled={testing}
                    title={t('test')}
                    className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 transition flex items-center gap-1 disabled:opacity-50">
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {testing ? t('testing') : t('test')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 rounded-xl p-3.5 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-fuchsia-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('cacheTitle')}</span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {cache
                    ? `${cache.downloads} ${t('cacheCached')} · ${cache.fetches} ${t('cacheKeys')} · ${formatBytes(cache.bytes)}`
                    : t('notSet')}
                </span>
              </div>
              {cache?.dir && (
                <div className="mt-1 text-[10px] text-slate-400 font-mono truncate" title={cache.dir}>
                  <span className="uppercase tracking-wider mr-1">{t('cacheDir')}:</span>{cache.dir}
                </div>
              )}
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{t('cacheHint')}</div>
              {cacheNote && <div className="mt-1 text-[10px] font-mono text-emerald-500 break-all">{cacheNote}</div>}
            </div>
            <button
              type="button"
              onClick={() => void onClearCache()}
              disabled={cacheBusy}
              title={t('cacheClear')}
              className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-rose-300 hover:text-rose-500 transition flex items-center gap-1 disabled:opacity-50">
              {cacheBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {cacheBusy ? t('cacheClearing') : t('cacheClear')}
            </button>
          </div>
        </div>
      </section>

      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Search className="w-4 h-4 text-fuchsia-500" /> {t('search')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{t('searchHint')}</p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void runSearch(); }}
              placeholder={t('queryPlaceholder')}
              className={inputClass}
            />
          </div>
          <div className="w-[150px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Languages className="w-3 h-3" /> {t('languagesLabel')}
            </label>
            <input value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder={t('languagesPlaceholder')} className={inputClass} />
          </div>
          {[
            { label: t('year'), value: year, set: setYear, width: 'w-[80px]' },
            { label: t('season'), value: season, set: setSeason, width: 'w-[70px]' },
            { label: t('episode'), value: episode, set: setEpisode, width: 'w-[70px]' },
          ].map((field) => (
            <div key={field.label} className={field.width}>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{field.label}</label>
              <input value={field.value} onChange={(event) => field.set(event.target.value)} inputMode="numeric" className={inputClass} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={!canRun || searchBusy}
            className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
            {searchBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchBusy ? t('searching') : t('searchBtn')}
          </button>
        </div>

        {downloadNote && <div className="mb-3 text-[11px] font-mono text-emerald-500 break-all">{downloadNote}</div>}

        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-500 flex items-center gap-1">
              <Captions className="w-3.5 h-3.5" /> {t('results')}
            </span>
            {results && <span className="text-[10px] text-slate-400 font-mono">{results.length} {t('results')}</span>}
          </div>
          {searchError && <div className="text-sm text-rose-500 mb-2">{searchError}</div>}
          {results ? (
            results.length === 0 ? (
              !searchError && <div className="text-sm text-slate-400 flex items-center gap-2"><FileX className="w-4 h-4" /> {t('noResults')}</div>
            ) : (
              <div className="space-y-2">
                {results.map((result, index) => {
                  const id = String(result.file_id);
                  const busy = downloadingId === id;
                  return (
                    <div
                      key={`${id}-${index}`}
                      className="rounded-xl p-3 border bg-white/50 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{result.title || result.release || id}</div>
                        {result.release && result.release !== result.title && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">{result.release}</div>
                        )}
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] font-mono text-slate-400">
                          {result.language && <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-500 font-bold uppercase">{result.language}</span>}
                          {result.format && <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 uppercase">{result.format}</span>}
                          {result.hearing_impaired && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-bold">{t('hi')}</span>}
                          {result.downloads != null && <span>{result.downloads} {t('downloads')}</span>}
                          {result.uploader && <span>{t('by')} {result.uploader}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void runDownload(result)}
                        disabled={busy || !!downloadingId}
                        title={t('download')}
                        className="px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold rounded-lg shadow shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50 shrink-0">
                        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {busy ? t('downloading') : t('download')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-sm text-slate-400">{t('noResult')}</div>
          )}
        </div>
      </section>

      <section className="pc-glass p-6">
        <PcHistoryList
          history={history}
          showFilters={false}
          title={<><History className="w-4 h-4 text-fuchsia-500" /> {t('historyTitle')}</>}
          onLoadRow={(row) => onLoadHistoryEntry(row.raw as SubtitleSearchHistoryEntry)}
          maxHeightClass={HISTORY_LIST_HEIGHT}
        />
      </section>
    </div>
  );
}
