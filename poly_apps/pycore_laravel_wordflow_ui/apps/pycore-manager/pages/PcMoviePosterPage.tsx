/**
 * PcMoviePosterPage — pycore Movie / TV poster pipeline status + control.
 *
 * Three self-contained capabilities, all over the pycore /pyapi proxy:
 *
 *  1. Provider key status — TMDB (v3 key and/or v4 read token) + OMDB, shown as
 *     green/grey badges with masked keys (the backend never returns full secrets).
 *     Driven by `pycoreApi.getPosterStatus()` (GET /api/local/poster/status).
 *
 *  2. Enable toggle — flips the SAME ingest flag the pipeline reads
 *     (user-data media_sync.fetch_poster) via `setPosterConfig`
 *     (POST /api/local/poster/config); the response is the fresh status.
 *
 *  3. Test lookup — a title (+ optional year) -> `testPoster`
 *     (POST /api/local/poster/test) renders the returned poster inline
 *     (data:<mime>;base64,…) with the provider + meta, or a "no match" message.
 *
 * Local React state only; every call is guarded and the page never crashes when
 * the backend (:59000) is offline. Hardcoded-English copy is centralized in `L`,
 * with zh values kept as comments (the pycore-manager pages have no `t` object).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Film, RefreshCw, Search, CheckCircle2, MinusCircle, KeyRound, WifiOff,
  ImageOff, Clapperboard,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { PosterStatus, PosterTestResponse } from '../../../core/api-libs/pycore';

// i18n labels (single source; the pages use literals, not a `t` object).
const L = {
  title: 'Movie Poster',                                              // 电影海报
  subtitle: 'TMDB / OMDB poster lookup status for the media ingest pipeline. Posters are fetched at ingest time and shipped to Laravel as local bytes.',
  refresh: 'Refresh',                                                 // 刷新
  providers: 'Providers',                                            // 提供方
  tmdb: 'TMDB',                                                      // TMDB
  omdb: 'OMDB',                                                      // OMDB
  configured: 'Configured',                                          // 已配置
  notConfigured: 'Not configured',                                  // 未配置
  v4Token: 'v4 read token',                                          // v4 读取令牌
  v4Present: 'Present',                                              // 已提供
  v4Missing: 'Missing',                                             // 缺失
  keys: 'Keys',                                                     // 密钥
  notSet: 'not set',                                                // 未设置
  fetchPoster: 'Fetch posters at ingest',                           // 入库时获取海报
  fetchHint: 'When on, the ingest pipeline looks up and downloads a poster for each media title.',
  enabled: 'Enabled',                                              // 已启用
  disabled: 'Disabled',                                            // 已禁用
  reuseTitle: 'Poster source',                                     // 海报来源
  reuseHint: 'How posters were obtained at ingest — local reuse of the extract poster.jpg vs a fresh TMDB/OMDB fetch.',
  reused: 'Local reuse',                                           // 本地复用
  fetched: 'Re-fetched',                                           // 重新抓取
  reset: 'Reset',                                                  // 重置
  testTitle: 'Test poster lookup',                                  // 测试海报查找
  testHint: 'Enter a movie / TV title (CJK titles are translated to English first), with an optional year, then run a one-off lookup.',
  titlePlaceholder: 'e.g. Spirited Away',                           // 例如 Spirited Away
  yearPlaceholder: 'Year (optional)',                               // 年份（可选）
  lookup: 'Look up',                                               // 查找
  lookingUp: 'Looking up…',                                        // 查找中…
  enterTitle: 'Enter a title first',                                // 请先输入标题
  noMatch: 'No poster found for that title.',                       // 未找到该标题的海报
  provider: 'Provider',                                            // 提供方
  sourceId: 'Source ID',                                           // 来源 ID
  year: 'Year',                                                    // 年份
  overview: 'Overview',                                            // 简介
  offline: 'pycore is offline — status unavailable.',               // pycore 离线 — 状态不可用
};

// Status-card badge styling — mirrors PcAiCapabilityView's vocabulary.
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

export default function PcMoviePosterPage() {
  const [status, setStatus] = useState<PosterStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<PosterTestResponse | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getPosterStatus();
      setStatus(s);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const toggleEnabled = useCallback(async () => {
    if (!status || saving) return;
    setSaving(true);
    try {
      const next = await pycoreApi.setPosterConfig(!status.enabled);
      setStatus(next);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setSaving(false);
    }
  }, [status, saving]);

  const resetStats = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await pycoreApi.resetPosterStats();
      setStatus(next);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const runTest = useCallback(async () => {
    const clean = title.trim();
    if (!clean || testing) return;
    setTesting(true);
    setResult(null);
    try {
      const y = year.trim() ? parseInt(year.trim(), 10) : undefined;
      const r = await pycoreApi.testPoster(clean, Number.isFinite(y as number) ? y : undefined);
      setResult(r);
      setOffline(false);
    } catch (e: any) {
      setResult({ found: false, error: e?.message || 'lookup failed' });
    } finally {
      setTesting(false);
    }
  }, [title, year, testing]);

  const tmdb = status?.providers.find((p) => p.name === 'tmdb');
  const omdb = status?.providers.find((p) => p.name === 'omdb');

  return (
    <div className="p-6 md:p-8 space-y-5">
      {/* header */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Film className="w-5 h-5 text-rose-500" /> {L.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{L.subtitle}</p>
          </div>
          <button onClick={() => void loadStatus()} disabled={loading}
            className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {L.refresh}
          </button>
        </div>

        {offline && (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-500">
            <WifiOff className="w-4 h-4" /> {L.offline}
          </div>
        )}

        {/* enable toggle */}
        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{L.fetchPoster}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{L.fetchHint}</p>
          </div>
          <button onClick={() => void toggleEnabled()} disabled={!status || saving}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              status?.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/15'}`}
            title={status?.enabled ? L.enabled : L.disabled}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition ${
              status?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* poster source — local reuse vs re-fetch counters */}
        <div className="mt-3 rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{L.reuseTitle}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">{L.reuseHint}</p>
            </div>
            <button onClick={() => void resetStats()} disabled={!status || saving}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} /> {L.reset}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/15 text-center">
              <div className="text-2xl font-black text-emerald-500">{status?.stats?.reused ?? 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{L.reused}</div>
            </div>
            <div className="rounded-xl p-3 bg-rose-500/5 border border-rose-500/15 text-center">
              <div className="text-2xl font-black text-rose-500">{status?.stats?.fetched ?? 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{L.fetched}</div>
            </div>
          </div>
        </div>
      </section>

      {/* providers */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-4">
          <Clapperboard className="w-4 h-4 text-rose-500" /> {L.providers}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* TMDB */}
          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L.tmdb}</span>
              <Badge ok={!!tmdb?.configured} okLabel={L.configured} offLabel={L.notConfigured} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              <span>{L.v4Token}</span>
              <Badge ok={!!tmdb?.has_v4_token} okLabel={L.v4Present} offLabel={L.v4Missing} />
            </div>
            <div className="space-y-1 text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" /> TMDB_API_KEY:
                <span className="text-slate-500 dark:text-slate-300">{status?.keys.TMDB_API_KEY || L.notSet}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" /> TMDB_API_READ_ACCESS_TOKEN:
                <span className="text-slate-500 dark:text-slate-300">{status?.keys.TMDB_API_READ_ACCESS_TOKEN || L.notSet}</span>
              </div>
            </div>
          </div>
          {/* OMDB */}
          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L.omdb}</span>
              <Badge ok={!!omdb?.configured} okLabel={L.configured} offLabel={L.notConfigured} />
            </div>
            <div className="space-y-1 text-[10px] font-mono text-slate-400 mt-7">
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" /> OMDB_API_KEY:
                <span className="text-slate-500 dark:text-slate-300">{status?.keys.OMDB_API_KEY || L.notSet}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* test lookup */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Search className="w-4 h-4 text-rose-500" /> {L.testTitle}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{L.testHint}</p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }}
            placeholder={L.titlePlaceholder}
            className="flex-1 min-w-[220px] px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-rose-400" />
          <input value={year} onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }}
            placeholder={L.yearPlaceholder}
            className="w-36 px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-rose-400" />
          <button onClick={() => void runTest()} disabled={!title.trim() || testing}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50">
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {testing ? L.lookingUp : L.lookup}
          </button>
        </div>

        {/* result */}
        {result && (
          result.found ? (
            <div className="flex flex-col sm:flex-row gap-4 rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
              {result.image_base64 ? (
                <img
                  src={`data:${result.mime || 'image/jpeg'};base64,${result.image_base64}`}
                  alt={result.meta?.title || L.title}
                  className="w-40 rounded-xl border border-slate-200/60 dark:border-white/10 object-cover shrink-0"
                />
              ) : (
                <div className="w-40 h-60 rounded-xl border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-300 shrink-0">
                  <ImageOff className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 space-y-2 text-sm">
                <div className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  {result.meta?.title || '—'}
                  {result.meta?.year ? <span className="text-slate-400 font-normal"> ({result.meta.year})</span> : null}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>{L.provider}: <b className="uppercase text-rose-500">{result.provider}</b></span>
                  {result.source_id && <span>{L.sourceId}: {result.source_id}</span>}
                  {result.meta?.year != null && <span>{L.year}: {result.meta.year}</span>}
                </div>
                {result.meta?.overview && (
                  <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-semibold text-slate-400">{L.overview}: </span>
                    {result.meta.overview}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-4 border bg-slate-100/60 dark:bg-black/20 border-slate-200/60 dark:border-white/5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ImageOff className="w-4 h-4" /> {result.error || L.noMatch}
            </div>
          )
        )}
      </section>
    </div>
  );
}
