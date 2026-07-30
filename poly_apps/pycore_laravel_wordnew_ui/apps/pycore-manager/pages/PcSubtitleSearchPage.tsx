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
 *     `pycoreApi.searchSubtitles()` over RPC v2. Results
 *     render as a list; each row can be downloaded via
 *     `pycoreApi.downloadSubtitle(file_id)` — on success the returned `content`
 *     is offered as a .srt Blob, else the `saved_path` is shown.
 *
 *  3. History — newest-first search records (metadata + result counts), with
 *     per-entry Load (re-run into results) + delete and a clear-all.
 *
 * Local React state only; every call is guarded and the page never crashes when
 * the backend (:59000) is offline. Hardcoded-English copy is centralized in `L`,
 * with zh values kept as comments (the pycore-manager pages have no `t` object).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Captions, RefreshCw, CheckCircle2, MinusCircle, WifiOff, Languages,
  Search, Download, Trash2, History, FileX, Activity, ShieldCheck,
  ListOrdered, Play, Loader2, Database,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type {
  SubtitleSearchStatus, SubtitleSearchProbe, SubtitleResult,
  SubtitleSearchHistoryEntry, SubtitleProvider, SubtitleProviderProbe,
  SubtitleCacheStats,
} from '../../../core/api-libs/pycore';

// i18n labels (single source; the pages use literals, not a `t` object).
const L = {
  title: 'Subtitle Search',                                           // 字幕搜索
  subtitle: 'Search and download movie & TV subtitles by title via OpenSubtitles, with a shared search history.',
  refresh: 'Refresh',                                                 // 刷新
  status: 'Status',                                                   // 状态
  available: 'Key set',                                               // 已配置密钥
  unavailable: 'No key',                                              // 未配置密钥
  provider: 'Provider',                                               // 提供方
  serviceUrl: 'Service URL',                                          // 服务地址
  keyName: 'Key name',                                                // 密钥名称
  authenticated: 'Authenticated',                                     // 已认证
  notAuthenticated: 'Not authenticated',                              // 未认证
  historyCount: 'History',                                            // 历史
  records: 'records',                                                 // 条记录
  noKeyHint: 'Set OPENSUBTITLES_API_KEY in the Special Software environment manager to enable search.',
  probe: 'Probe',                                                     // 探测
  probing: 'Probing…',                                                // 探测中…
  probeOk: 'Reachable',                                               // 可达
  probeFail: 'Unreachable',                                           // 不可达
  latency: 'latency',                                                 // 延迟
  languagesCount: 'languages',                                        // 种语言
  search: 'Search subtitles',                                         // 搜索字幕
  searchHint: 'Enter a movie or TV title (optionally a year/season/episode), then search OpenSubtitles.',
  queryPlaceholder: 'e.g. Inception 2010',                            // 例如：盗梦空间 2010
  languagesLabel: 'Languages',                                        // 语言
  languagesPlaceholder: 'en,zh-cn',                                   // en,zh-cn
  year: 'Year',                                                       // 年份
  season: 'Season',                                                   // 季
  episode: 'Episode',                                                 // 集
  searchBtn: 'Search',                                                // 搜索
  searching: 'Searching…',                                            // 搜索中…
  download: 'Download',                                               // 下载
  downloading: 'Downloading…',                                        // 下载中…
  results: 'results',                                                 // 个结果
  noResults: 'No subtitles found.',                                   // 未找到字幕
  noResult: 'No result yet.',                                         // 暂无结果
  downloads: 'downloads',                                             // 次下载
  by: 'by',                                                           // 上传者
  hi: 'HI',                                                           // 听障
  saved: 'Saved to',                                                  // 已保存至
  downloaded: 'Downloaded',                                           // 已下载
  offline: 'pycore is offline — status unavailable.',                 // pycore 离线 — 状态不可用
  notSet: 'unknown',                                                  // 未知
  historyTitle: 'Search history',                                    // 搜索历史
  clearAll: 'Clear all',                                             // 清空全部
  noHistory: 'No searches yet.',                                     // 暂无搜索
  delete: 'Delete',                                                   // 删除
  load: 'Load',                                                      // 载入

  // providers (fallback chain)
  providers: 'Providers (fallback chain)',                            // 提供方（回退链）
  providersHint: 'The subtitle side tries these providers in order, then falls back to Whisper generation. The scraper lanes are best-effort and may be outdated.',
  primary: 'Primary',                                                 // 主要
  fallbackTag: 'Fallback',                                            // 回退
  providerAvailable: 'Available',                                     // 可用
  providerUnavailable: 'Unavailable',                                 // 不可用
  needsLabel: 'Needs',                                                // 需要
  test: 'Test',                                                       // 测试
  testing: 'Testing…',                                                // 测试中…
  testOk: 'OK',                                                       // 正常
  testFail: 'Failed',                                                 // 失败
  noProviders: 'No providers reported.',                              // 无提供方

  // download cache
  cacheTitle: 'Download cache',                                       // 下载缓存
  cacheHint: 'Cached downloads are reused, so a rate/quota-limited subtitle is never downloaded twice.',
  cacheCached: 'cached',                                              // 已缓存
  cacheKeys: 'keys',                                                  // 键
  cacheDir: 'Cache directory',                                        // 缓存目录
  cacheClear: 'Clear',                                                // 清空
  cacheClearing: 'Clearing…',                                         // 清空中…
  cacheCleared: 'Cache cleared',                                      // 缓存已清空
  cacheRemoved: 'removed',                                            // 已移除
};

const OK_BADGE = 'bg-emerald-500/15 text-emerald-500';
const OFF_BADGE = 'bg-slate-500/15 text-slate-400';

function Badge({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  const Icon = ok ? CheckCircle2 : MinusCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ok ? OK_BADGE : OFF_BADGE}`}>
      <Icon className="w-3 h-3" /> {ok ? okLabel : offLabel}
    </span>
  );
}

/** Compact byte size (B / KB / MB). */
function humanBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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
      setCacheNote(`${L.cacheCleared} · ${r.removed ?? 0} ${L.cacheRemoved}`);
      await loadCache();
    } catch (e: any) {
      setCacheNote(e?.message || 'clear failed');
    } finally {
      setCacheBusy(false);
    }
  }, [cacheBusy, loadCache]);

  useEffect(() => { void loadStatus(); void loadHistory(); void loadProviders(); void loadCache(); }, [loadStatus, loadHistory, loadProviders, loadCache]);

  const runProviderTest = useCallback(async (name: string) => {
    setProviderTests((m) => ({ ...m, [name]: { ...m[name], testing: true } }));
    try {
      const res = await pycoreApi.testSubtitleProvider(name);
      setProviderTests((m) => ({ ...m, [name]: { testing: false, result: res } }));
    } catch (e: any) {
      setProviderTests((m) => ({
        ...m,
        [name]: { testing: false, result: { name, available: false, latency_ms: null, error: e?.message || 'test failed' } },
      }));
    }
  }, []);

  const runProbe = useCallback(async () => {
    if (probeBusy) return;
    setProbeBusy(true);
    try {
      const p = await pycoreApi.probeSubtitleSearch();
      setProbe(p);
      setOffline(false);
    } catch (e: any) {
      setProbe({ configured: false, available: false, latency_ms: null, error: e?.message || 'probe failed' });
    } finally {
      setProbeBusy(false);
    }
  }, [probeBusy]);

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
      setSearchError(e?.message || 'search failed');
      setResults([]);
    } finally {
      setSearchBusy(false);
    }
  }, [query, languages, year, season, episode, searchBusy, loadHistory]);

  const runDownload = useCallback(async (r: SubtitleResult) => {
    const id = String(r.file_id);
    if (downloadingId) return;
    setDownloadingId(id);
    setDownloadNote(null);
    try {
      const d = await pycoreApi.downloadSubtitle(r.file_id);
      if (!d.success) {
        setDownloadNote(d.error || L.noResults);
      } else {
        const fname = d.file_name || `${r.title || 'subtitle'}.${d.format || 'srt'}`;
        if (d.content) {
          offerSrt(fname, d.content);
          setDownloadNote(`${L.downloaded}: ${fname}`);
        } else if (d.saved_path) {
          setDownloadNote(`${L.saved} ${d.saved_path}`);
        } else if (d.link) {
          setDownloadNote(`${L.downloaded}: ${d.link}`);
        } else {
          setDownloadNote(`${L.downloaded}: ${fname}`);
        }
      }
      setOffline(false);
    } catch (e: any) {
      setDownloadNote(e?.message || 'download failed');
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId]);

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
    <div className="p-6 md:p-8 space-y-5">
      {/* header + status */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Captions className="w-5 h-5 text-fuchsia-500" /> {L.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{L.subtitle}</p>
          </div>
          <button onClick={() => { void loadStatus(); void loadProviders(); void loadCache(); }} disabled={loading}
            className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {L.refresh}
          </button>
        </div>

        {offline && (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-500">
            <WifiOff className="w-4 h-4" /> {L.offline}
          </div>
        )}

        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L.status}</span>
            <div className="flex items-center gap-2">
              <Badge ok={!!status?.authenticated} okLabel={L.authenticated} offLabel={L.notAuthenticated} />
              <Badge ok={!!status?.available} okLabel={L.available} offLabel={L.unavailable} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{L.provider}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.provider || L.notSet}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{L.serviceUrl}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300 truncate">{status?.service_url || L.notSet}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {L.keyName}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300 truncate">{status?.key_name || L.notSet}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><History className="w-3 h-3" /> {L.historyCount}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {status ? `${status.history_count} ${L.records}` : L.notSet}
              </div>
            </div>
          </div>
          {status && !status.available && (
            <div className="mt-3 text-[10px] text-amber-500">{L.noKeyHint}</div>
          )}

          {/* probe */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button onClick={() => void runProbe()} disabled={probeBusy}
              className="px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 disabled:opacity-50">
              {probeBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {probeBusy ? L.probing : L.probe}
            </button>
            {probe && (
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <Badge ok={!!probe.available} okLabel={L.probeOk} offLabel={L.probeFail} />
                {probe.latency_ms != null && <span className="text-slate-400">{L.latency}: {probe.latency_ms} ms</span>}
                {probe.languages_count != null && <span className="text-slate-400">{probe.languages_count} {L.languagesCount}</span>}
                {probe.error && <span className="text-rose-500">{probe.error}</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* providers — fallback chain */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <ListOrdered className="w-4 h-4 text-fuchsia-500" /> {L.providers}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">{L.providersHint}</p>

        {providers && providers.length === 0 && (
          <div className="text-sm text-slate-400">{L.noProviders}</div>
        )}
        {!providers && offline && (
          <div className="text-sm text-slate-400 flex items-center gap-2"><WifiOff className="w-4 h-4" /> {L.offline}</div>
        )}

        {providers && providers.length > 0 && (
          <div className="space-y-2">
            {providers.map((p) => {
              const t = providerTests[p.name];
              const testing = !!t?.testing;
              const result = t?.result;
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
                      <Badge ok={p.available} okLabel={L.providerAvailable} offLabel={L.providerUnavailable} />
                      {!p.fallback && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-500">{L.primary}</span>
                      )}
                      {p.fallback && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500">{L.fallbackTag}</span>
                      )}
                    </div>
                    {p.note && (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{p.note}</div>
                    )}
                    {!p.available && p.needs && (
                      <div className="mt-1.5 text-[10px] text-amber-500 font-mono break-all">
                        <span className="uppercase tracking-wider mr-1 text-slate-400">{L.needsLabel}:</span>{p.needs}
                      </div>
                    )}
                    {result && (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono">
                        {result.available
                          ? <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /> {L.testOk}{result.latency_ms != null ? ` · ${result.latency_ms}ms` : ''}</span>
                          : <span className="flex items-center gap-1 text-rose-500"><MinusCircle className="w-3.5 h-3.5" /> {L.testFail}{result.error ? ` · ${result.error}` : ''}</span>}
                      </div>
                    )}
                  </div>

                  <button onClick={() => void runProviderTest(p.name)} disabled={testing}
                    title={L.test}
                    className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 transition flex items-center gap-1 disabled:opacity-50">
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {testing ? L.testing : L.test}
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
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{L.cacheTitle}</span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {cache
                    ? `${cache.downloads} ${L.cacheCached} · ${cache.fetches} ${L.cacheKeys} · ${humanBytes(cache.bytes)}`
                    : L.notSet}
                </span>
              </div>
              {cache?.dir && (
                <div className="mt-1 text-[10px] text-slate-400 font-mono truncate" title={cache.dir}>
                  <span className="uppercase tracking-wider mr-1">{L.cacheDir}:</span>{cache.dir}
                </div>
              )}
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{L.cacheHint}</div>
              {cacheNote && (
                <div className="mt-1 text-[10px] font-mono text-emerald-500 break-all">{cacheNote}</div>
              )}
            </div>
            <button onClick={() => void onClearCache()} disabled={cacheBusy}
              title={L.cacheClear}
              className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-rose-300 hover:text-rose-500 transition flex items-center gap-1 disabled:opacity-50">
              {cacheBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {cacheBusy ? L.cacheClearing : L.cacheClear}
            </button>
          </div>
        </div>
      </section>

      {/* search box */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Search className="w-4 h-4 text-fuchsia-500" /> {L.search}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{L.searchHint}</p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }}
              placeholder={L.queryPlaceholder}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[150px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Languages className="w-3 h-3" /> {L.languagesLabel}</label>
            <input value={languages} onChange={(e) => setLanguages(e.target.value)}
              placeholder={L.languagesPlaceholder}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[80px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{L.year}</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[70px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{L.season}</label>
            <input value={season} onChange={(e) => setSeason(e.target.value)} inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[70px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{L.episode}</label>
            <input value={episode} onChange={(e) => setEpisode(e.target.value)} inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <button onClick={() => void runSearch()} disabled={!canRun || searchBusy}
            className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
            {searchBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchBusy ? L.searching : L.searchBtn}
          </button>
        </div>

        {downloadNote && (
          <div className="mb-3 text-[11px] font-mono text-emerald-500 break-all">{downloadNote}</div>
        )}

        {/* results */}
        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-500 flex items-center gap-1">
              <Captions className="w-3.5 h-3.5" /> {L.results}
            </span>
            {results && <span className="text-[10px] text-slate-400 font-mono">{results.length} {L.results}</span>}
          </div>
          {searchError && <div className="text-sm text-rose-500 mb-2">{searchError}</div>}
          {results ? (
            results.length === 0 ? (
              !searchError && <div className="text-sm text-slate-400 flex items-center gap-2"><FileX className="w-4 h-4" /> {L.noResults}</div>
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
                          {r.hearing_impaired && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-bold">{L.hi}</span>}
                          {r.downloads != null && <span>{r.downloads} {L.downloads}</span>}
                          {r.uploader && <span>{L.by} {r.uploader}</span>}
                        </div>
                      </div>
                      <button onClick={() => void runDownload(r)} disabled={busy || !!downloadingId}
                        title={L.download}
                        className="px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold rounded-lg shadow shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50 shrink-0">
                        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {busy ? L.downloading : L.download}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-sm text-slate-400">{L.noResult}</div>
          )}
        </div>
      </section>

      {/* history */}
      <section className="pc-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <History className="w-4 h-4 text-fuchsia-500" /> {L.historyTitle}
          </h3>
          {history.length > 0 && (
            <button onClick={() => void onClearHistory()}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-rose-300 hover:text-rose-500 transition flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> {L.clearAll}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-sm text-slate-400">{L.noHistory}</div>
        ) : (
          <div className="space-y-2">
            {history.map((e) => (
              <div key={e.id}
                className="rounded-xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{e.query}</div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                    <span>{e.result_count} {L.results}</span>
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
                    title={L.load}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-500 transition">
                    {L.load}
                  </button>
                  <button onClick={() => void onDeleteHistory(e.id)}
                    title={L.delete}
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
