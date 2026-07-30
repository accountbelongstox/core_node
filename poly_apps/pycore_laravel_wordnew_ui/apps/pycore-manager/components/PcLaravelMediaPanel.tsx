/**
 * PcLaravelMediaPanel — collapsible "Laravel backend data" panel (pycore end).
 *
 * Read-only counterpart check for the pycore→Laravel media sync. PRIMARY data
 * source is the pycore RPC `video_extract.backend_status`, which resolves the
 * Laravel base URL exactly like the sync engine does — so the panel reports
 * against the SAME backend the sync actually targets (single source of truth
 * for "what did my sync land"). It shows the resolved base_url + reachability
 * and a per-source local↔backend comparison with a sync-state badge.
 *
 * Books and detail peeks use video_extract.backend_media_* RPC v2 routes.
 * Only pycore performs the selected-endpoint HTTP calls to Laravel; this UI
 * never falls back to a browser Laravel client.
 *
 * Deliberately NOT part of the page's main flow: collapsed by default, lazy
 * fetch on first expand, and it never blocks or crashes the page when either
 * backend is offline. Used by PcVideoExtractPage; reusable anywhere on the
 * pycore end (e.g. PcBooksPage).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Database, ChevronDown, ChevronUp, RefreshCw, WifiOff, Wifi, Film, BookOpen,
} from 'lucide-react';
import { callRpc } from '../../../core/api-libs/pycore';
import { PYCORE_BROWSER_EVENTS } from '../../../core/api-libs/pycore/PycoreEventTopics';
import { PYCORE_RPC_ROUTES } from '../../../core/api-libs/pycore/PycoreRpcRoutes';
import type {
  MediaSourceListItem, MediaListResponse, MediaSentence,
} from '../../../core/api/modules/MediaQueryAPI';

// i18n labels (single source; pycore-manager pages use literals, no `t` object).
const L = {
  title: 'Laravel backend data',                       // Laravel 后端数据
  hint: 'Per-source sync status against the SAME Laravel backend the sync engine targets.',
  refresh: 'Refresh',                                  // 刷新
  movies: 'Movies',                                    // 影片
  books: 'Books',                                      // 书籍
  sources: 'Sources',                                  // 来源
  total: 'total',                                      // 共
  segments: 'segments',                                // 段
  sentences: 'sentences',                              // 句
  subtitles: 'subtitles',                              // 字幕
  cues: 'cues',                                        // 字幕条
  clips: 'clips',                                      // 切片
  local: 'local',                                      // 本地
  backend: 'backend',                                  // 后端
  synced: 'Synced',                                    // 同步于
  syncTarget: 'Sync target',                           // 同步目标
  reachable: 'reachable',                              // 可达
  notReachable: 'unreachable',                         // 不可达
  notSynced: 'not on backend yet',                     // 后端尚无数据
  stateSynced: 'synced',                               // 已同步
  statePartial: 'partial',                             // 部分同步
  stateMissing: 'missing',                             // 未同步
  stateUnknown: 'unknown',                             // 未知
  empty: 'Nothing ingested yet — run a sync above, then refresh.',
  noSources: 'No extracted sources known to pycore yet — run an extraction, then refresh.',
  unreachable: 'Laravel backend unreachable — laravel_main (:9000) may be offline.',
  peek: 'Peek',                                        // 速览
  peekFirst: 'First sentences',                        // 前几句
  noSentences: 'No sentences stored for this source.',
  loadError: 'Query failed',                           // 查询失败
};

const PER_PAGE = 8;
const PEEK_COUNT = 5;

// ---- pycore `video_extract.backend_status` response (FE/BE contract) ----- #
type BackendSyncState = 'synced' | 'partial' | 'missing' | 'unknown';
interface BackendStatusSource {
  stem: string;
  source_key: string;
  source_path: string;
  src_abs: string;
  local: { segments: number; cues: number; clips: number; srt: boolean };
  backend: { segments: number; cues: number; sentences: number; synced_at?: string } | null;
  state: BackendSyncState;
}
interface BackendStatus {
  success: boolean;
  base_url: string;
  reachable: boolean;
  total_backend_subtitles?: number | null;
  sources: BackendStatusSource[];
}

interface MediaRpcEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface MediaDetailPayload {
  sentences?: MediaSentence[] | { items?: MediaSentence[] };
  segments?: unknown[];
}

// badge styling per sync state (synced=emerald, partial=amber, missing=rose,
// unknown=slate — mirrors the page's pill conventions).
const STATE_BADGE: Record<BackendSyncState, string> = {
  synced: 'bg-emerald-500/15 text-emerald-500',
  partial: 'bg-amber-500/15 text-amber-500',
  missing: 'bg-rose-500/15 text-rose-500',
  unknown: 'bg-slate-500/15 text-slate-400',
};
const STATE_LABEL: Record<BackendSyncState, string> = {
  synced: L.stateSynced,
  partial: L.statePartial,
  missing: L.stateMissing,
  unknown: L.stateUnknown,
};

interface PeekState {
  key: string;
  kind: 'movie' | 'book';
  loading: boolean;
  error?: string;
  sentences: MediaSentence[];
  segments: number;
}

const countLine = (item: MediaSourceListItem): string => {
  const parts: string[] = [];
  if (typeof item.segment_count === 'number') parts.push(`${item.segment_count} ${L.segments}`);
  if (typeof item.sentence_count === 'number') parts.push(`${item.sentence_count} ${L.sentences}`);
  if (typeof item.subtitle_count === 'number') parts.push(`${item.subtitle_count} ${L.subtitles}`);
  return parts.join(' · ');
};

const PcLaravelMediaPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [books, setBooks] = useState<MediaListResponse | null>(null);
  const [peek, setPeek] = useState<PeekState | null>(null);

  // Both reads travel UI -> pycore RPC v2 -> Laravel HTTP.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, booksResult] = await Promise.all([
        callRpc(PYCORE_RPC_ROUTES.videoExtractBackendStatus, {}) as Promise<BackendStatus>,
        callRpc(PYCORE_RPC_ROUTES.videoExtractBackendMediaList, {
          kind: 'book', per_page: PER_PAGE,
        }) as Promise<MediaRpcEnvelope<MediaListResponse>>,
      ]);
      if (!statusResult?.success) throw new Error(L.unreachable);
      setStatus(statusResult);
      setBooks(booksResult?.success && booksResult.data ? booksResult.data : null);
      setError(booksResult?.success ? null : booksResult?.error || L.loadError);
    } catch (e: unknown) {
      setStatus(null);
      setBooks(null);
      setError(e instanceof Error ? e.message : L.unreachable);
    }
    setLoading(false);
    setFetchedOnce(true);
  }, []);

  // When the sync engine's Laravel target changes (endpoint switcher above),
  // re-fetch backend_status against the NEW backend — but only if this panel
  // has data on screen (already fetched once); a never-opened panel keeps its
  // lazy first-expand fetch.
  useEffect(() => {
    const onEndpointChanged = () => {
      if (fetchedOnce) refresh();
    };
    window.addEventListener(PYCORE_BROWSER_EVENTS.laravelApiChanged, onEndpointChanged);
    return () => window.removeEventListener(PYCORE_BROWSER_EVENTS.laravelApiChanged, onEndpointChanged);
  }, [fetchedOnce, refresh]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !fetchedOnce && !loading) refresh();
  };

  // Inline per-source peek: first sentences (+ segment count for movies).
  // The content spot-check uses the same selected Laravel endpoint as sync.
  const togglePeek = useCallback(async (item: MediaSourceListItem, kind: 'movie' | 'book') => {
    if (peek?.key === item.source_key) { setPeek(null); return; }
    setPeek({ key: item.source_key, kind, loading: true, sentences: [], segments: 0 });
    try {
      const res = await callRpc(PYCORE_RPC_ROUTES.videoExtractBackendMediaDetail, {
        kind,
        source_key: item.source_key,
        grain: 'sentence',
      }) as MediaRpcEnvelope<MediaDetailPayload>;
      if (!res.success || !res.data) throw new Error(res.error || L.loadError);
      const sentenceValue = res.data.sentences;
      const sentences = Array.isArray(sentenceValue)
        ? sentenceValue
        : Array.isArray(sentenceValue?.items) ? sentenceValue.items : [];
      setPeek({
        key: item.source_key,
        kind,
        loading: false,
        sentences: sentences.slice(0, PEEK_COUNT),
        segments: Array.isArray(res.data.segments) ? res.data.segments.length : 0,
      });
    } catch (e: unknown) {
      setPeek({
        key: item.source_key, kind, loading: false,
        error: e instanceof Error ? e.message : L.loadError, sentences: [], segments: 0,
      });
    }
  }, [peek?.key]);

  const totalSummary = !fetchedOnce
    ? ''
    : status
      ? `${status.sources.length} ${L.sources.toLowerCase()} · ${status.sources.filter((s) => s.state === 'synced').length} ${L.stateSynced}`
      : '';

  // ---- pycore mode: per-source local↔backend comparison ------------------ #
  const renderStatusRow = (src: BackendStatusSource) => (
    <li key={src.source_key || src.src_abs || src.stem}
      className="rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02] p-2">
      <div className="flex items-center gap-2">
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${STATE_BADGE[src.state] || STATE_BADGE.unknown}`}>
          {STATE_LABEL[src.state] || L.stateUnknown}
        </span>
        <span className="flex-1 min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 truncate"
          title={src.src_abs || src.source_path}>
          {src.stem || src.source_key}
        </span>
        {src.backend?.synced_at && (
          <span className="shrink-0 text-[10px] text-slate-400">{L.synced} {src.backend.synced_at}</span>
        )}
      </div>
      <div className="mt-1 text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          <span className="font-bold uppercase tracking-wide mr-1">{L.local}</span>
          {src.local.segments} {L.segments} · {src.local.cues} {L.cues} · {src.local.clips} {L.clips}
          {src.local.srt ? ' · srt' : ''}
        </span>
        <span>
          <span className="font-bold uppercase tracking-wide mr-1">{L.backend}</span>
          {src.backend
            ? `${src.backend.segments} ${L.segments} · ${src.backend.cues} ${L.cues} · ${src.backend.sentences} ${L.sentences}`
            : L.notSynced}
        </span>
      </div>
    </li>
  );

  // ---- dashboard mode + books block: original list rendering ------------- #
  const renderList = (
    data: MediaListResponse | null, kind: 'movie' | 'book',
    label: string, Icon: typeof Film,
  ) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" /> {label}
        </span>
        <span className="text-[11px] text-slate-500">{data?.total ?? 0} {L.total}</span>
      </div>
      {!data || data.items.length === 0 ? (
        <div className="text-[11px] text-slate-500 py-3 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-xl">
          {L.empty}
        </div>
      ) : (
        <ul className="space-y-1">
          {data.items.map((item) => {
            const peeking = peek?.key === item.source_key;
            return (
              <li key={item.source_key}
                className="rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02]">
                <button type="button" onClick={() => togglePeek(item, kind)}
                  className="w-full flex items-center gap-2 p-2 text-left">
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 truncate"
                      title={item.original_name || item.title}>
                      {item.title || item.source_key}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {countLine(item)}
                      {item.language ? ` · ${item.language}` : ''}
                      {item.synced_at ? ` · ${L.synced} ${item.synced_at}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-rose-500 flex items-center gap-1">
                    {L.peek} {peeking ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </span>
                </button>
                {peeking && peek && (
                  <div className="px-2 pb-2">
                    {peek.loading ? (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 py-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> …
                      </div>
                    ) : peek.error ? (
                      <p className="text-[11px] text-amber-500 py-1">{peek.error}</p>
                    ) : (
                      <div className="rounded-lg bg-slate-200/40 dark:bg-black/30 p-2 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {L.peekFirst}
                          {kind === 'movie' ? ` · ${peek.segments} ${L.segments}` : ''}
                        </p>
                        {peek.sentences.length === 0 ? (
                          <p className="text-[11px] text-slate-500">{L.noSentences}</p>
                        ) : peek.sentences.map((s) => (
                          <p key={s.seq} className="text-[11px] text-slate-600 dark:text-slate-300 break-words">
                            <span className="font-mono text-slate-400 mr-1.5">{s.seq}.</span>{s.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <section className="pc-glass p-6">
      <button type="button" onClick={toggleOpen}
        className="w-full flex items-center justify-between text-xs font-bold uppercase text-slate-400 tracking-wider">
        <span className="flex items-center gap-2">
          <Database className="w-4 h-4 text-rose-500" /> {L.title}
        </span>
        <span className="flex items-center gap-2 normal-case font-normal text-[11px] text-slate-500">
          {!open && totalSummary && <span>{totalSummary}</span>}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 min-w-[12rem] text-[11px] text-slate-400">
              {L.hint}
            </p>
            {status && (
              <span className={`text-[10px] font-mono truncate max-w-[16rem] flex items-center gap-1 ${
                status.reachable ? 'text-emerald-500' : 'text-rose-500'}`}
                title={`${L.syncTarget}: ${status.base_url} (${status.reachable ? L.reachable : L.notReachable})`}>
                {status.reachable ? <Wifi className="w-3 h-3 shrink-0" /> : <WifiOff className="w-3 h-3 shrink-0" />}
                {status.base_url}
              </span>
            )}
            <button type="button" onClick={refresh} disabled={loading}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 shrink-0 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {L.refresh}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{L.unreachable} ({error})</span>
            </div>
          )}

          {status && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5" /> {L.sources}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {status.sources.length} {L.total}
                    {typeof status.total_backend_subtitles === 'number'
                      ? ` · ${status.total_backend_subtitles} ${L.subtitles} ${L.backend}` : ''}
                  </span>
                </div>
                {status.sources.length === 0 ? (
                  <div className="text-[11px] text-slate-500 py-3 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-xl">
                    {L.noSources}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {status.sources.map(renderStatusRow)}
                  </ul>
                )}
              </div>
              {/* Secondary block uses the same pycore-selected Laravel endpoint. */}
              {renderList(books, 'book', L.books, BookOpen)}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PcLaravelMediaPanel;
