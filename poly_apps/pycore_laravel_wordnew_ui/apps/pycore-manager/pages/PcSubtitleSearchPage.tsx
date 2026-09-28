/**
 * PcSubtitleSearchPage — pycore subtitle-search (OpenSubtitles) direct on :59000.
 * Search movie & TV subtitles by title, download a result's .srt, and
 * keep a shared search history.
 *
 * Mirrors PcImageSearchPage's "status + search + history" shape:
 *
 *  1. Status — is the OpenSubtitles key configured, the provider/service URL,
 *     key name, whether the session is authenticated and how many searches are
 *     in the shared history. Includes a Probe button (reachability + latency).
 *     Driven by `pycoreApi.getSubtitleSearchStatus()` / `probeSubtitleSearch()`.
 *
 *  2. Search — a title + languages (+ optional year/season/episode) feed
 *     `pycoreApi.searchSubtitles()` over HTTP API. Results
 *     render as a list; each row can be downloaded via
 *     `pycoreApi.downloadSubtitle(file_id)` — on success the returned `content`
 *     is offered as a .srt Blob, else the `saved_path` is shown.
 *
 *  3. History — newest-first search records (metadata + result counts), with
 *     per-entry Load (re-run into results) + delete and a clear-all.
 *
 * Local React state only; every call is guarded and the page never crashes when
 * the backend (:59000) is offline. `L` maps each label to its `pc` locale key.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Captions, RefreshCw, CheckCircle2, MinusCircle, WifiOff, Languages,
  Search, Download, Trash2, History, FileX, Activity, ShieldCheck,
  ListOrdered, Play, Loader2, Database,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  SubtitleSearchStatus, SubtitleSearchProbe, SubtitleResult,
  SubtitleSearchHistoryEntry, SubtitleProvider, SubtitleProviderProbe,
  SubtitleCacheStats,
} from '@/apps/pycore-manager/api';
import { humanBytes } from '@/apps/pycore-manager/utils/pcFormat';
import { PresenceBadge } from '@/apps/pycore-manager/pages/vocabulary/vocabShared';

const L = {
  title: 'subtitlePage.title',
  subtitle: 'subtitlePage.subtitle',
  refresh: 'subtitlePage.refresh',
  status: 'subtitlePage.status',
  available: 'subtitlePage.available',
  unavailable: 'subtitlePage.unavailable',
  provider: 'subtitlePage.provider',
  serviceUrl: 'subtitlePage.serviceUrl',
  keyName: 'subtitlePage.keyName',
  authenticated: 'subtitlePage.authenticated',
  notAuthenticated: 'subtitlePage.notAuthenticated',
  historyCount: 'subtitlePage.historyCount',
  records: 'subtitlePage.records',
  noKeyHint: 'subtitlePage.noKeyHint',
  probe: 'subtitlePage.probe',
  probing: 'subtitlePage.probing',
  probeOk: 'subtitlePage.probeOk',
  probeFail: 'subtitlePage.probeFail',
  latency: 'subtitlePage.latency',
  languagesCount: 'subtitlePage.languagesCount',
  search: 'subtitlePage.search',
  searchHint: 'subtitlePage.searchHint',
  queryPlaceholder: 'subtitlePage.queryPlaceholder',
  languagesLabel: 'subtitlePage.languagesLabel',
  languagesPlaceholder: 'subtitlePage.languagesPlaceholder',
  year: 'subtitlePage.year',
  season: 'subtitlePage.season',
  episode: 'subtitlePage.episode',
  searchBtn: 'subtitlePage.searchBtn',
  searching: 'subtitlePage.searching',
  download: 'subtitlePage.download',
  downloading: 'subtitlePage.downloading',
  results: 'subtitlePage.results',
  noResults: 'subtitlePage.noResults',
  noResult: 'subtitlePage.noResult',
  downloads: 'subtitlePage.downloads',
  by: 'subtitlePage.by',
  hi: 'subtitlePage.hi',
  saved: 'subtitlePage.saved',
  downloaded: 'subtitlePage.downloaded',
  offline: 'subtitlePage.offline',
  notSet: 'subtitlePage.notSet',
  historyTitle: 'subtitlePage.historyTitle',
  clearAll: 'subtitlePage.clearAll',
  noHistory: 'subtitlePage.noHistory',
  delete: 'subtitlePage.delete',
  load: 'subtitlePage.load',
  providers: 'subtitlePage.providers',
  providersHint: 'subtitlePage.providersHint',
  primary: 'subtitlePage.primary',
  fallbackTag: 'subtitlePage.fallbackTag',
  providerAvailable: 'subtitlePage.providerAvailable',
  providerUnavailable: 'subtitlePage.providerUnavailable',
  needsLabel: 'subtitlePage.needsLabel',
  test: 'subtitlePage.test',
  testing: 'subtitlePage.testing',
  testOk: 'subtitlePage.testOk',
  testFail: 'subtitlePage.testFail',
  noProviders: 'subtitlePage.noProviders',
  cacheTitle: 'subtitlePage.cacheTitle',
  cacheHint: 'subtitlePage.cacheHint',
  cacheCached: 'subtitlePage.cacheCached',
  cacheKeys: 'subtitlePage.cacheKeys',
  cacheDir: 'subtitlePage.cacheDir',
  cacheClear: 'subtitlePage.cacheClear',
  cacheClearing: 'subtitlePage.cacheClearing',
  cacheCleared: 'subtitlePage.cacheCleared',
  cacheRemoved: 'subtitlePage.cacheRemoved',
  clearFailed: 'subtitlePage.clearFailed',
  testFailed: 'subtitlePage.testFailed',
  probeFailed: 'subtitlePage.probeFailed',
  searchFailed: 'subtitlePage.searchFailed',
  downloadFailed: 'subtitlePage.downloadFailed',
} as const;

/** Offer downloaded subtitle text as a .srt file. */
function offerSrt(name: string, content: string) {
  try {
    const blob = new Blob([content], { type: 'application/x-subrip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch { /* ignore — non-DOM env */ }
}

export default function PcSubtitleSearchPage() {
  const { t } = useTranslation('pc');
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
  const [languages, setLanguages] = useState('en,zh-cn');
  const [year, setYear] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');

  const [results, setResults] = useState<SubtitleResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);

  const [history, setHistory] = useState<SubtitleSearchHistoryEntry[]>([]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getSubtitleSearchStatus();
      setStatus(s);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await pycoreApi.getSubtitleSearchHistory(50);
      setHistory(r.entries || []);
    } catch {
      /* offline — leave history as-is */
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const r = await pycoreApi.getSubtitleProviders();
      const list = (r.providers || []).slice().sort((a, b) => a.order - b.order);
      setProviders(list);
    } catch {
      /* offline — leave providers as-is */
    }
  }, []);

  const loadCache = useCallback(async () => {
    try {
      const c = await pycoreApi.getSubtitleCacheStats();
      setCache(c);
    } catch {
      /* offline — leave cache as-is */
    }
  }, []);

  const onClearCache = useCallback(async () => {
    if (cacheBusy) return;
    setCacheBusy(true);
    setCacheNote(null);
    try {
      const r = await pycoreApi.clearSubtitleCache();
      setCacheNote(`${t(L.cacheCleared)} · ${r.removed ?? 0} ${t(L.cacheRemoved)}`);
      await loadCache();
    } catch (e: any) {
      setCacheNote(e?.message || t(L.clearFailed));
    } finally {
      setCacheBusy(false);
    }
  }, [cacheBusy, loadCache, t]);

  useEffect(() => { void loadStatus(); void loadHistory(); void loadProviders(); void loadCache(); }, [loadStatus, loadHistory, loadProviders, loadCache]);

  const runProviderTest = useCallback(async (name: string) => {
    setProviderTests((m) => ({ ...m, [name]: { ...m[name], testing: true } }));
    try {
      const res = await pycoreApi.testSubtitleProvider(name);
      setProviderTests((m) => ({ ...m, [name]: { testing: false, result: res } }));
    } catch (e: any) {
      setProviderTests((m) => ({
        ...m,
        [name]: { testing: false, result: { name, available: false, latency_ms: null, error: e?.message || t(L.testFailed) } },
      }));
    }
  }, [t]);

  const runProbe = useCallback(async () => {
    if (probeBusy) return;
    setProbeBusy(true);
    try {
      const p = await pycoreApi.probeSubtitleSearch();
      setProbe(p);
      setOffline(false);
    } catch (e: any) {
      setProbe({ configured: false, available: false, latency_ms: null, error: e?.message || t(L.probeFailed) });
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
      const r = await pycoreApi.searchSubtitles(clean, {
        languages: languages.trim() || undefined,
        year: year.trim() ? Number(year) : undefined,
        season: season.trim() ? Number(season) : undefined,
        episode: episode.trim() ? Number(episode) : undefined,
      });
      setResults(r.results || []);
      if (r.error) setSearchError(r.error);
      setOffline(false);
      void loadHistory();
    } catch (e: any) {
      setSearchError(e?.message || t(L.searchFailed));
      setResults([]);
    } finally {
      setSearchBusy(false);
    }
  }, [query, languages, year, season, episode, searchBusy, loadHistory, t]);

  const runDownload = useCallback(async (r: SubtitleResult) => {
    const id = String(r.file_id);
    if (downloadingId) return;
    setDownloadingId(id);
    setDownloadNote(null);
    try {
      const d = await pycoreApi.downloadSubtitle(r.file_id);
      if (!d.success) {
        setDownloadNote(d.error || t(L.noResults));
      } else {
        const fname = d.file_name || `${r.title || 'subtitle'}.${d.format || 'srt'}`;
        if (d.content) {
          offerSrt(fname, d.content);
          setDownloadNote(`${t(L.downloaded)}: ${fname}`);
        } else if (d.saved_path) {
          setDownloadNote(`${t(L.saved)} ${d.saved_path}`);
        } else if (d.link) {
          setDownloadNote(`${t(L.downloaded)}: ${d.link}`);
        } else {
          setDownloadNote(`${t(L.downloaded)}: ${fname}`);
        }
      }
      setOffline(false);
    } catch (e: any) {
      setDownloadNote(e?.message || t(L.downloadFailed));
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, t]);

  const onLoadHistoryEntry = useCallback((e: SubtitleSearchHistoryEntry) => {
    setQuery(e.query);
    setLanguages((e.languages || []).join(',') || 'en,zh-cn');
    setYear(e.year != null ? String(e.year) : '');
    if (e.results && e.results.length) {
      setResults(e.results);
      setSearchError(null);
    }
  }, []);

  const onDeleteHistory = useCallback(async (id: string) => {
    try {
      await pycoreApi.deleteSubtitleSearchHistory(id);
      setHistory((h) => h.filter((e) => e.id !== id));
    } catch { /* ignore */ }
  }, []);

  const onClearHistory = useCallback(async () => {
    try {
      await pycoreApi.clearSubtitleSearchHistory();
      setHistory([]);
    } catch { /* ignore */ }
  }, []);

  const canRun = !!query.trim();

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-5">
      {/* header + status */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Captions className="w-5 h-5 text-fuchsia-500" /> {t(L.title)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{t(L.subtitle)}</p>
          </div>
          <button onClick={() => { void loadStatus(); void loadProviders(); void loadCache(); }} disabled={loading}
            className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t(L.refresh)}
          </button>
        </div>

        {offline && (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-500">
            <WifiOff className="w-4 h-4" /> {t(L.offline)}
          </div>
        )}

        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t(L.status)}</span>
            <div className="flex items-center gap-2">
              <PresenceBadge ok={!!status?.authenticated} yesLabel={t(L.authenticated)} noLabel={t(L.notAuthenticated)} />
              <PresenceBadge ok={!!status?.available} yesLabel={t(L.available)} noLabel={t(L.unavailable)} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{t(L.provider)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.provider || t(L.notSet)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{t(L.serviceUrl)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300 truncate">{status?.service_url || t(L.notSet)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {t(L.keyName)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300 truncate">{status?.key_name || t(L.notSet)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><History className="w-3 h-3" /> {t(L.historyCount)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {status ? `${status.history_count} ${t(L.records)}` : t(L.notSet)}
              </div>
            </div>
          </div>
          {status && !status.available && (
            <div className="mt-3 text-[10px] text-amber-500">{t(L.noKeyHint)}</div>
          )}

          {/* probe */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button onClick={() => void runProbe()} disabled={probeBusy}
              className="px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 disabled:opacity-50">
              {probeBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {probeBusy ? t(L.probing) : t(L.probe)}
            </button>
            {probe && (
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <PresenceBadge ok={!!probe.available} yesLabel={t(L.probeOk)} noLabel={t(L.probeFail)} />
                {probe.latency_ms != null && <span className="text-slate-400">{t(L.latency)}: {probe.latency_ms} ms</span>}
                {probe.languages_count != null && <span className="text-slate-400">{probe.languages_count} {t(L.languagesCount)}</span>}
                {probe.error && <span className="text-rose-500">{probe.error}</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* providers — fallback chain */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <ListOrdered className="w-4 h-4 text-fuchsia-500" /> {t(L.providers)}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">{t(L.providersHint)}</p>

        {providers && providers.length === 0 && (
          <div className="text-sm text-slate-400">{t(L.noProviders)}</div>
        )}
        {!providers && offline && (
          <div className="text-sm text-slate-400 flex items-center gap-2"><WifiOff className="w-4 h-4" /> {t(L.offline)}</div>
        )}

        {providers && providers.length > 0 && (
          <div className="space-y-2">
            {providers.map((p) => {
              const providerTest = providerTests[p.name];
              const testing = !!providerTest?.testing;
              const result = providerTest?.result;
              return (
                <div key={p.name}
                  className={`rounded-xl p-3.5 border flex items-start gap-3 ${p.fallback
                    ? 'bg-white/30 dark:bg-white/[0.03] border-slate-300/25 dark:border-white/5 opacity-90'
                    : 'bg-white/55 dark:bg-white/5 border-fuchsia-300/40 dark:border-fuchsia-500/20'}`}>
                  {/* order badge */}
                  <span className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${p.fallback
                    ? 'bg-slate-500/15 text-slate-400'
                    : 'bg-fuchsia-600 text-white shadow shadow-fuchsia-600/30'}`}>
                    #{p.order}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.label}</span>
                      <PresenceBadge ok={p.available} yesLabel={t(L.providerAvailable)} noLabel={t(L.providerUnavailable)} />
                      {!p.fallback && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-500">{t(L.primary)}</span>
                      )}
                      {p.fallback && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500">{t(L.fallbackTag)}</span>
                      )}
                    </div>
                    {p.note && (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{p.note}</div>
                    )}
                    {!p.available && p.needs && (
                      <div className="mt-1.5 text-[10px] text-amber-500 font-mono break-all">
                        <span className="uppercase tracking-wider mr-1 text-slate-400">{t(L.needsLabel)}:</span>{p.needs}
                      </div>
                    )}
                    {result && (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono">
                        {result.available
                          ? <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /> {t(L.testOk)}{result.latency_ms != null ? ` · ${result.latency_ms}ms` : ''}</span>
                          : <span className="flex items-center gap-1 text-rose-500"><MinusCircle className="w-3.5 h-3.5" /> {t(L.testFail)}{result.error ? ` · ${result.error}` : ''}</span>}
                      </div>
                    )}
                  </div>

                  <button onClick={() => void runProviderTest(p.name)} disabled={testing}
                    title={t(L.test)}
                    className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 transition flex items-center gap-1 disabled:opacity-50">
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {testing ? t(L.testing) : t(L.test)}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* download cache */}
        <div className="mt-5 rounded-xl p-3.5 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-fuchsia-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(L.cacheTitle)}</span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {cache
                    ? `${cache.downloads} ${t(L.cacheCached)} · ${cache.fetches} ${t(L.cacheKeys)} · ${humanBytes(cache.bytes)}`
                    : t(L.notSet)}
                </span>
              </div>
              {cache?.dir && (
                <div className="mt-1 text-[10px] text-slate-400 font-mono truncate" title={cache.dir}>
                  <span className="uppercase tracking-wider mr-1">{t(L.cacheDir)}:</span>{cache.dir}
                </div>
              )}
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{t(L.cacheHint)}</div>
              {cacheNote && (
                <div className="mt-1 text-[10px] font-mono text-emerald-500 break-all">{cacheNote}</div>
              )}
            </div>
            <button onClick={() => void onClearCache()} disabled={cacheBusy}
              title={t(L.cacheClear)}
              className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-rose-300 hover:text-rose-500 transition flex items-center gap-1 disabled:opacity-50">
              {cacheBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {cacheBusy ? t(L.cacheClearing) : t(L.cacheClear)}
            </button>
          </div>
        </div>
      </section>

      {/* search box */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Search className="w-4 h-4 text-fuchsia-500" /> {t(L.search)}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{t(L.searchHint)}</p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }}
              placeholder={t(L.queryPlaceholder)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[150px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Languages className="w-3 h-3" /> {t(L.languagesLabel)}</label>
            <input value={languages} onChange={(e) => setLanguages(e.target.value)}
              placeholder={t(L.languagesPlaceholder)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[80px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t(L.year)}</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[70px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t(L.season)}</label>
            <input value={season} onChange={(e) => setSeason(e.target.value)} inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[70px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t(L.episode)}</label>
            <input value={episode} onChange={(e) => setEpisode(e.target.value)} inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <button onClick={() => void runSearch()} disabled={!canRun || searchBusy}
            className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
            {searchBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchBusy ? t(L.searching) : t(L.searchBtn)}
          </button>
        </div>

        {downloadNote && (
          <div className="mb-3 text-[11px] font-mono text-emerald-500 break-all">{downloadNote}</div>
        )}

        {/* results */}
        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-500 flex items-center gap-1">
              <Captions className="w-3.5 h-3.5" /> {t(L.results)}
            </span>
            {results && <span className="text-[10px] text-slate-400 font-mono">{results.length} {t(L.results)}</span>}
          </div>
          {searchError && <div className="text-sm text-rose-500 mb-2">{searchError}</div>}
          {results ? (
            results.length === 0 ? (
              !searchError && <div className="text-sm text-slate-400 flex items-center gap-2"><FileX className="w-4 h-4" /> {t(L.noResults)}</div>
            ) : (
              <div className="space-y-2">
                {results.map((r, i) => {
                  const id = String(r.file_id);
                  const busy = downloadingId === id;
                  return (
                    <div key={`${id}-${i}`}
                      className="rounded-xl p-3 border bg-white/50 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {r.title || r.release || id}
                        </div>
                        {r.release && r.release !== r.title && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">{r.release}</div>
                        )}
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] font-mono text-slate-400">
                          {r.language && (
                            <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-500 font-bold uppercase">{r.language}</span>
                          )}
                          {r.format && <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 uppercase">{r.format}</span>}
                          {r.hearing_impaired && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-bold">{t(L.hi)}</span>}
                          {r.downloads != null && <span>{r.downloads} {t(L.downloads)}</span>}
                          {r.uploader && <span>{t(L.by)} {r.uploader}</span>}
                        </div>
                      </div>
                      <button onClick={() => void runDownload(r)} disabled={busy || !!downloadingId}
                        title={t(L.download)}
                        className="px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold rounded-lg shadow shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50 shrink-0">
                        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {busy ? t(L.downloading) : t(L.download)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-sm text-slate-400">{t(L.noResult)}</div>
          )}
        </div>
      </section>

      {/* history */}
      <section className="pc-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <History className="w-4 h-4 text-fuchsia-500" /> {t(L.historyTitle)}
          </h3>
          {history.length > 0 && (
            <button onClick={() => void onClearHistory()}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-rose-300 hover:text-rose-500 transition flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> {t(L.clearAll)}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-sm text-slate-400">{t(L.noHistory)}</div>
        ) : (
          <div className="space-y-2">
            {history.map((e) => (
              <div key={e.id}
                className="rounded-xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{e.query}</div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                    <span>{e.result_count} {t(L.results)}</span>
                    {(e.languages || []).length > 0 && (
                      <span className="flex items-center gap-0.5"><Languages className="w-3 h-3" /> {e.languages.join(',')}</span>
                    )}
                    {e.year != null && <span>· {e.year}</span>}
                    <span>·</span>
                    <span>{e.iso?.replace('T', ' ').replace('+00:00', 'Z')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onLoadHistoryEntry(e)}
                    title={t(L.load)}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 transition">
                    {t(L.load)}
                  </button>
                  <button onClick={() => void onDeleteHistory(e.id)}
                    title={t(L.delete)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-400 hover:border-rose-300 hover:text-rose-500 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
