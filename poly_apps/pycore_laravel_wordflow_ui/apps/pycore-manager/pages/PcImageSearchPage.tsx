/**
 * PcImageSearchPage — pycore image-search (SerpApi Google-Images) evaluated
 * side-by-side with an AI render of the SAME query, plus the search history.
 *
 * Mirrors PcTranslatePage's "compare a free source against AI on one input"
 * shape, direct on pycore :59000:
 *
 *  1. Status — is the SerpApi key configured, the engine, the service URL and
 *     how many searches are in the shared history.
 *     Driven by `pycoreApi.getImageSearchStatus()` (GET /api/local/image-search/status).
 *
 *  2. Search + AI compare (the "evaluate alongside AI" requirement) — one query
 *     feeds BOTH paths:
 *       - "Search (SerpApi)" -> POST /api/local/image-search — a real Google-Images
 *         result grid (each links back to its source page).
 *       - "AI render" -> POST /api/local/image-search/ai — one AI-generated image
 *         for the same query (unified IMAGE contract), shown beside the grid.
 *       - "Search + AI" -> POST /api/local/image-search/compare — does both in one
 *         call and records a single combined evaluation entry.
 *     This is the SAME SerpApi capability the movie-poster pipeline now prefers
 *     as its first source, so the records also explain where a poster came from.
 *
 *  3. History — newest-first search records (metadata + result thumbnails), with
 *     per-entry delete and a clear-all. Driven by the /history endpoints.
 *
 * Local React state only; every call is guarded and the page never crashes when
 * the backend (:59000) is offline. Hardcoded-English copy is centralized in `L`,
 * with zh values kept as comments (the pycore-manager pages have no `t` object).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScanSearch, RefreshCw, CheckCircle2, MinusCircle, WifiOff, Sparkles,
  Search, Bot, Trash2, ExternalLink, History, ImageOff, Layers,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type {
  ImageSearchStatus, ImageSearchResult, AiImageResponse,
  ImageSearchHistoryEntry,
} from '../../../core/api-libs/pycore';

// i18n labels (single source; the pages use literals, not a `t` object).
const L = {
  title: 'Image Search',                                              // 图片搜索
  subtitle: 'SerpApi Google-Images search evaluated side-by-side with an AI render of the SAME query. This is also the preferred source for the movie-poster pipeline.',
  refresh: 'Refresh',                                                 // 刷新
  status: 'Status',                                                   // 状态
  available: 'Key set',                                               // 已配置密钥
  unavailable: 'No key',                                              // 未配置密钥
  provider: 'Provider',                                               // 提供方
  engine: 'Engine',                                                   // 引擎
  serviceUrl: 'Service URL',                                          // 服务地址
  historyCount: 'History',                                            // 历史
  records: 'records',                                                 // 条记录
  noKeyHint: 'Set SERPAPI_API_KEY in the Special Software environment manager to enable search.',
  search: 'Search images',                                            // 搜索图片
  searchHint: 'Enter a query, then search with SerpApi and render with AI to compare both on the same input.',
  queryPlaceholder: 'e.g. Dune 2021 movie poster',                    // 例如：沙丘 2021 电影海报
  searchSerp: 'Search (SerpApi)',                                    // 搜索（SerpApi）
  renderAi: 'AI render',                                             // AI 生成
  compare: 'Search + AI',                                            // 搜索 + AI
  searching: 'Searching…',                                          // 搜索中…
  rendering: 'Rendering…',                                          // 生成中…
  enterQuery: 'Enter a query first',                                  // 请先输入查询
  serpResults: 'SerpApi results',                                    // SerpApi 结果
  aiRender: 'AI render',                                            // AI 生成图
  noResult: 'No result yet.',                                         // 暂无结果
  noResults: 'No images found.',                                     // 未找到图片
  model: 'Model',                                                     // 模型
  source: 'Source',                                                   // 来源
  open: 'Open source page',                                          // 打开来源页
  offline: 'pycore is offline — status unavailable.',                 // pycore 离线 — 状态不可用
  notSet: 'unknown',                                                  // 未知
  historyTitle: 'Search history',                                    // 搜索历史
  clearAll: 'Clear all',                                             // 清空全部
  noHistory: 'No searches yet.',                                     // 暂无搜索
  delete: 'Delete',                                                   // 删除
  withAi: 'AI compared',                                            // 已对比 AI
  results: 'results',                                                // 个结果
  load: 'Load',                                                      // 载入
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

function aiSrc(ai: AiImageResponse | null): string | null {
  if (!ai || !ai.success || !ai.image_base64) return null;
  return `data:${ai.mime || 'image/png'};base64,${ai.image_base64}`;
}

export default function PcImageSearchPage() {
  const [status, setStatus] = useState<ImageSearchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiImageResponse | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const [history, setHistory] = useState<ImageSearchHistoryEntry[]>([]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getImageSearchStatus();
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
      const r = await pycoreApi.getImageSearchHistory(50);
      setHistory(r.entries || []);
    } catch {
      /* offline — leave history as-is */
    }
  }, []);

  useEffect(() => { void loadStatus(); void loadHistory(); }, [loadStatus, loadHistory]);

  const runSearch = useCallback(async () => {
    const clean = query.trim();
    if (!clean || searchBusy) return;
    setSearchBusy(true);
    setSearchError(null);
    setResults(null);
    try {
      const r = await pycoreApi.searchImages(clean, status?.default_num || 12);
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
  }, [query, searchBusy, status, loadHistory]);

  const runAi = useCallback(async () => {
    const clean = query.trim();
    if (!clean || aiBusy) return;
    setAiBusy(true);
    setAiResult(null);
    try {
      const r = await pycoreApi.searchImagesAi(clean);
      setAiResult(r);
      setOffline(false);
    } catch (e: any) {
      setAiResult({
        success: false, provider: 'ai', model: '', image_base64: null,
        mime: 'image/png', latency_ms: null, error: e?.message || 'render failed',
      });
    } finally {
      setAiBusy(false);
    }
  }, [query, aiBusy]);

  // "Search + AI" — both legs, then refresh history (the combined record).
  const runCompare = useCallback(async () => {
    const clean = query.trim();
    if (!clean || searchBusy || aiBusy) return;
    setSearchBusy(true);
    setAiBusy(true);
    setSearchError(null);
    setResults(null);
    setAiResult(null);
    try {
      const r = await pycoreApi.compareImages(clean, status?.default_num || 12);
      setResults(r.search?.results || []);
      setSearchError(r.search?.error || null);
      setAiResult(r.ai);
      setOffline(false);
      void loadHistory();
    } catch (e: any) {
      setSearchError(e?.message || 'compare failed');
      setResults([]);
    } finally {
      setSearchBusy(false);
      setAiBusy(false);
    }
  }, [query, searchBusy, aiBusy, status, loadHistory]);

  const onDeleteHistory = useCallback(async (id: string) => {
    try {
      await pycoreApi.deleteImageSearchHistory(id);
      setHistory((h) => h.filter((e) => e.id !== id));
    } catch { /* ignore */ }
  }, []);

  const onClearHistory = useCallback(async () => {
    try {
      await pycoreApi.clearImageSearchHistory();
      setHistory([]);
    } catch { /* ignore */ }
  }, []);

  const aiImg = aiSrc(aiResult);
  const canRun = !!query.trim();

  return (
    <div className="p-6 md:p-8 space-y-5">
      {/* header + status */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <ScanSearch className="w-5 h-5 text-fuchsia-500" /> {L.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{L.subtitle}</p>
          </div>
          <button onClick={() => void loadStatus()} disabled={loading}
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
            <Badge ok={!!status?.available} okLabel={L.available} offLabel={L.unavailable} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{L.provider}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.provider || L.notSet}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{L.engine}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.engine || L.notSet}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{L.serviceUrl}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300 truncate">{status?.service_url || L.notSet}</div>
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
        </div>
      </section>

      {/* search box */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Search className="w-4 h-4 text-fuchsia-500" /> {L.search}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{L.searchHint}</p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }}
            placeholder={L.queryPlaceholder}
            className="flex-1 min-w-[220px] px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => void runSearch()} disabled={!canRun || searchBusy}
              className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {searchBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searchBusy ? L.searching : L.searchSerp}
            </button>
            <button onClick={() => void runAi()} disabled={!canRun || aiBusy}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {aiBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiBusy ? L.rendering : L.renderAi}
            </button>
            <button onClick={() => void runCompare()} disabled={!canRun || searchBusy || aiBusy}
              className="px-4 py-2.5 border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1 hover:border-slate-400 disabled:opacity-50">
              <Layers className="w-4 h-4" /> {L.compare}
            </button>
          </div>
        </div>

        {/* side-by-side: SerpApi grid vs AI render on the SAME query */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* SerpApi results (wider) */}
          <div className="lg:col-span-2 rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-500 flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> {L.serpResults}
              </span>
              {results && <span className="text-[10px] text-slate-400 font-mono">{results.length} {L.results}</span>}
            </div>
            {searchError && <div className="text-sm text-rose-500 mb-2">{searchError}</div>}
            {results ? (
              results.length === 0 ? (
                !searchError && <div className="text-sm text-slate-400 flex items-center gap-2"><ImageOff className="w-4 h-4" /> {L.noResults}</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {results.map((r, i) => (
                    <a key={`${r.url}-${i}`} href={r.link || r.url} target="_blank" rel="noreferrer"
                      title={r.title || r.source || L.open}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/30">
                      <img src={r.thumbnail || r.url} alt={r.title || ''} loading="lazy"
                        className="w-full h-full object-cover transition group-hover:scale-105" />
                      <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[9px] font-mono text-white bg-black/55 truncate flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" /> {r.source || r.title || ''}
                      </span>
                    </a>
                  ))}
                </div>
              )
            ) : (
              <div className="text-sm text-slate-400">{L.noResult}</div>
            )}
          </div>

          {/* AI render */}
          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" /> {L.aiRender}
              </span>
              {aiResult?.success && aiResult.model && (
                <span className="text-[10px] font-semibold text-violet-400 font-mono truncate max-w-[120px]">
                  {L.model}: {aiResult.model}
                </span>
              )}
            </div>
            {aiResult ? (
              aiImg ? (
                <img src={aiImg} alt="AI render"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10" />
              ) : (
                <div className="text-sm text-rose-500">{aiResult.error || L.noResults}</div>
              )
            ) : (
              <div className="text-sm text-slate-400">{L.noResult}</div>
            )}
          </div>
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
                {/* thumbnails strip */}
                <div className="flex -space-x-2 shrink-0">
                  {(e.results || []).slice(0, 4).map((r, i) => (
                    <img key={i} src={r.thumbnail || r.url} alt=""
                      className="w-9 h-9 rounded-lg object-cover border-2 border-white dark:border-slate-900 bg-slate-100" />
                  ))}
                  {(!e.results || e.results.length === 0) && (
                    <span className="w-9 h-9 rounded-lg border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-black/30 flex items-center justify-center">
                      <ImageOff className="w-4 h-4 text-slate-400" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{e.query}</div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                    <span>{e.result_count} {L.results}</span>
                    <span>·</span>
                    <span>{e.iso?.replace('T', ' ').replace('+00:00', 'Z')}</span>
                    {e.ai && <span className="text-violet-400 flex items-center gap-0.5"><Bot className="w-3 h-3" /> {L.withAi}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setQuery(e.query); }}
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
