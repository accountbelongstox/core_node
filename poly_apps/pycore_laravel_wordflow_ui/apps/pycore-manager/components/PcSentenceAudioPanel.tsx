/**
 * PcSentenceAudioPanel - generate TTS audio for every sentence in the shared
 * library, with persistent progress.
 *
 * Connects DIRECTLY to the pycore backend (pyservice.ps1 -> :59000) over the
 * existing `media.enrich` WS RPC, which forwards to laravel_main's
 * SentenceEnrichmentService. That service is the authoritative "generate audio
 * for all sentences" engine and already satisfies every requirement here:
 *
 *   - IDEMPOTENT: fill-missing only, never clobber. A row that already carries
 *     audio (or all AI fields) is skipped by the selection query, so re-running
 *     "Generate Audio" only touches what is still missing.
 *   - SAVED LOCALLY: the mp3 is written under the sentence-sounds dir keyed by
 *     `<lang>/<content_id>.mp3` (PathMapper::getAppQyV1SentenceSoundsDir), the
 *     same asset the reader serves.
 *   - RESUMABLE: each batch returns `{processed, enriched, remaining, errors}`;
 *     `remaining` is the live DB count of rows still needing work, so the loop
 *     drains to zero and can be interrupted/resumed at any batch boundary.
 *
 * PROGRESS PERSISTENCE (survives refresh / reopen): the progress math is
 * `total = done + remaining`. `done` (cumulative enriched this session) and
 * `remaining` (last batch's authoritative count) are mirrored to localStorage
 * after every batch, so a refresh restores the exact bar position. Because
 * `remaining` is re-read from the DB on the next batch, the restored state is
 * self-correcting even if the cache is stale. An interrupted run (refresh
 * mid-generation) surfaces as "interrupted - Resume" rather than silently
 * losing state; resuming is safe (idempotent).
 *
 * The book list below is CONTEXT (which sources are synced + their sentence
 * counts). `media.enrich` is library-wide, so generation covers every synced
 * book at once - "all sentences". A book with 0 sentences simply has not been
 * synced to Laravel yet (Analyze -> Sync books to Laravel first).
 *
 * Local React state only; every call is guarded and the UI never crashes when
 * the backend (:59000) is offline. Hardcoded-English copy is centralized in `L`
 * (zh kept as comments - the pycore-manager pages have no `t` object).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Volume2, RefreshCw, Play, Square, CheckCircle2, AlertTriangle, WifiOff,
  BookOpen, Sparkles,
} from 'lucide-react';
import { callRpc, onWsStatus } from '../../../core/api-libs/pycore';
import type { BookSourceState } from '../../../core/api-libs/pycore';

// ---- persistence ---------------------------------------------------------- #
// One localStorage blob mirrors the generation session so a refresh/reopen
// restores the exact progress bar. `total = done + remaining` (see header).
const STORAGE_KEY = 'pc_sentence_audio_gen';
const BATCH_LIMIT_DEFAULT = 50;
// Cap the drain loop so a stuck/unreachable backend can never spin forever.
const MAX_LOOP_ITERATIONS = 2000;

type GenStatus = 'idle' | 'generating' | 'completed' | 'error' | 'interrupted';

interface AudioGenState {
  status: GenStatus;
  done: number;          // cumulative enriched this session
  remaining: number;     // last authoritative DB count of rows needing work
  processed: number;     // cumulative rows attempted this session
  errors: string[];
  batchLimit: number;
  updatedAt: number;
}

const initialState = (): AudioGenState => ({
  status: 'idle', done: 0, remaining: 0, processed: 0, errors: [],
  batchLimit: BATCH_LIMIT_DEFAULT, updatedAt: 0,
});

// Load the cached session (never throws - a corrupt blob resets to idle).
const loadState = (): AudioGenState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
};

const saveState = (s: AudioGenState) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota */ }
};

// ---- i18n labels (single source; the pages use literals, not a `t` object) - #
const L = {
  title: 'Sentence Audio',                          // 句子语音
  subtitle: 'Bulk backfill (media.enrich batches). On-demand reader audio: Queue Center → Sentence Voice Assist (claim queue).',
  generate: 'Generate Audio',                       // 生成语音
  resume: 'Resume',                                 // 继续
  generating: 'Generating…',                        // 生成中…
  stop: 'Stop',                                     // 停止
  batchLimit: 'Batch limit',                        // 批量上限
  progress: 'Progress',                             // 进度
  done: 'Done',                                     // 已完成
  remaining: 'Remaining',                           // 剩余
  processed: 'Processed',                           // 已处理
  errors: 'Errors',                                 // 错误
  completed: 'All sentences have audio',            // 全部句子已有语音
  interrupted: 'Generation was interrupted - click Resume to continue (idempotent, no duplicates).',
  error: 'Generation failed',                       // 生成失败
  needSynced: 'No synced books yet - Analyze a source, then "Sync books to Laravel" first.',
  syncedBooks: 'Synced books',                      // 已同步书籍
  noBooks: 'No book sources yet.',                  // 暂无书籍来源
  sentences: 'sentences',                           // 句
  notSynced: 'not synced',                          // 未同步
  wsDown: 'pycore backend (:59000) unreachable - start it (pyservice.ps1) to generate audio.',
  lastRun: 'Last run',                              // 上次运行
};

const nf = (n: number | undefined | null) => (typeof n === 'number' ? n.toLocaleString() : '0');

interface PcSentenceAudioPanelProps {
  /** Book sources (path + mode) from PcBooksPage, for the context list. */
  entries: { path: string; mode: string }[];
  /** Persisted per-source state (submission_state, sentence counts). */
  sourceStates: Record<string, BookSourceState>;
}

const PcSentenceAudioPanel: React.FC<PcSentenceAudioPanelProps> = ({ entries, sourceStates }) => {
  const [gen, setGen] = useState<AudioGenState>(loadState);
  const [wsConnected, setWsConnected] = useState(false);
  // If a cached session was mid-generation, it was interrupted by the
  // refresh/reopen - surface that instead of silently showing "generating".
  const [bootState, setBootState] = useState<AudioGenState>(loadState);
  const loopAbort = useRef(false);

  // Mirror status on every change so a refresh always has the latest batch.
  useEffect(() => { saveState(gen); }, [gen]);

  // WS reachability mirror (offline banner) - same pattern as PcBooksPage.
  useEffect(() => {
    const off = onWsStatus(setWsConnected);
    return off;
  }, []);

  // On mount, mark a cached "generating" session as interrupted (the loop died
  // with the page). The user resumes explicitly - never auto-run on load.
  useEffect(() => {
    if (bootState.status === 'generating') {
      setGen((prev) => ({ ...prev, status: 'interrupted' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synced-book context list (only synced sources carry sentences in Laravel).
  const syncedBooks = entries
    .map((e) => ({ path: e.path, state: sourceStates[e.path] }))
    .filter((b) => b.state?.submission_state === 'synced');
  const anySynced = syncedBooks.length > 0;

  const total = gen.done + gen.remaining;
  const pct = total > 0
    ? Math.min(100, Math.round((gen.done / total) * 100))
    : (gen.status === 'completed' ? 100 : 0);
  const isRunning = gen.status === 'generating';

  // One enrich batch (mirrors PcBooksPage::enrichOnce). Returns the parsed
  // {processed, enriched, remaining, errors} or null on failure.
  const enrichOnce = useCallback(async (limit: number): Promise<{
    processed: number; enriched: number; remaining: number; errors: string[];
  } | null> => {
    const r: any = await callRpc('media.enrich', { limit })
      .catch((e: any) => ({ error: e?.message || 'RPC failed' }));
    if (!r || r.error || r.success === false) {
      return null;
    }
    return {
      processed: Number(r.processed ?? 0),
      enriched: Number(r.enriched ?? 0),
      remaining: Number(r.remaining ?? 0),
      errors: Array.isArray(r.errors) ? r.errors.map((e: any) => (typeof e === 'string' ? e : JSON.stringify(e))) : [],
    };
  }, []);

  // Start (or resume) the drain loop. Idempotent: the backend skips rows that
  // already have audio, so resuming after an interrupt never duplicates work.
  const runGeneration = useCallback(async () => {
    if (isRunning) return;
    loopAbort.current = false;
    setGen((prev) => ({
      ...prev,
      status: 'generating',
      errors: [],
      // Preserve cumulative done/processed when resuming an interrupted run;
      // reset only the transient error list.
    }));
    let done = gen.done;
    let processed = gen.processed;
    let lastRemaining = gen.remaining;
    const allErrors: string[] = [];

    for (let i = 0; i < MAX_LOOP_ITERATIONS; i += 1) {
      if (loopAbort.current) break;
      const res = await enrichOnce(gen.batchLimit);
      if (!res) {
        setGen((prev) => ({
          ...prev, status: 'error', remaining: lastRemaining,
          errors: [...allErrors, 'pycore/Laravel unreachable or enrich failed'],
        }));
        return;
      }
      done += res.enriched;
      processed += res.processed;
      lastRemaining = res.remaining;
      if (res.errors.length) allErrors.push(...res.errors.slice(0, 5));
      setGen((prev) => ({
        ...prev,
        done, processed, remaining: lastRemaining,
        errors: allErrors.slice(-8),
        updatedAt: Date.now(),
      }));
      // Drain complete, or the batch made no forward progress (avoid spin).
      if (lastRemaining <= 0) break;
      if (res.processed <= 0 && res.enriched <= 0) break;
    }

    setGen((prev) => ({
      ...prev,
      status: loopAbort.current ? 'interrupted' : (lastRemaining <= 0 ? 'completed' : prev.status),
      remaining: lastRemaining,
      done, processed,
      errors: allErrors.slice(-8),
      updatedAt: Date.now(),
    }));
  }, [isRunning, gen.done, gen.processed, gen.remaining, gen.batchLimit, enrichOnce]);

  const stopGeneration = useCallback(() => { loopAbort.current = true; }, []);

  const setBatchLimit = useCallback((n: number) => {
    setGen((prev) => ({ ...prev, batchLimit: Math.max(1, Math.min(500, n)) }));
  }, []);

  // Reset the session (clears the cached bar + localStorage). Used after a
  // completed run to start a fresh progress baseline.
  const resetSession = useCallback(() => {
    loopAbort.current = true;
    setGen({ ...initialState(), batchLimit: gen.batchLimit });
  }, [gen.batchLimit]);

  const inputCls = 'text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none';

  return (
    <section className="pc-glass p-6">
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-rose-500" /> {L.title}
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">{L.subtitle}</p>
      </div>

      {!wsConnected && (
        <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{L.wsDown}</span>
        </div>
      )}

      {/* Synced-book context: explains "0 sentences" = not synced. */}
      <div className="mb-4 rounded-2xl p-3 border bg-slate-100/40 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-slate-500">
          <BookOpen className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-bold">{L.syncedBooks}</span>
          <span className="text-slate-400">· {syncedBooks.length}</span>
        </div>
        {!anySynced ? (
          <p className="text-[11px] text-amber-500">{L.needSynced}</p>
        ) : (
          <ul className="space-y-1 max-h-32 overflow-auto">
            {syncedBooks.map((b) => {
              const count = b.state?.summary?.aggregate?.sentence_count ?? 0;
              const name = b.path.split(/[\\/]/).pop() || b.path;
              return (
                <li key={b.path} className="flex items-center gap-2 text-[11px]">
                  <span className="flex-1 min-w-0 truncate font-mono text-slate-600 dark:text-slate-300" title={b.path}>{name}</span>
                  <span className="shrink-0 text-slate-400">{nf(count)} {L.sentences}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{L.batchLimit}</label>
          <input type="number" min={1} max={500} value={gen.batchLimit}
            onChange={(e) => setBatchLimit(Number(e.target.value) || 1)}
            disabled={isRunning}
            className={`${inputCls} w-28 disabled:opacity-50`} />
        </div>
        {!isRunning ? (
          <button onClick={() => void runGeneration()}
            disabled={!wsConnected}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {gen.status === 'interrupted' ? <Play className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {gen.status === 'interrupted' ? L.resume : L.generate}
          </button>
        ) : (
          <button onClick={stopGeneration}
            className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition">
            <RefreshCw className="w-4 h-4 animate-spin" /> {L.stop}
          </button>
        )}
        {(gen.status === 'completed' || gen.status === 'interrupted') && (
          <button onClick={resetSession}
            className="px-4 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition text-slate-700 dark:text-slate-200">
            <Square className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            {gen.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              : gen.status === 'error' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                : isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                  : <Volume2 className="w-3.5 h-3.5 text-slate-400" />}
            {L.progress}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">{pct}%</span>
        </div>
        <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div className={`h-full transition-all duration-300 ${
            gen.status === 'completed' ? 'bg-emerald-500'
              : gen.status === 'error' ? 'bg-amber-500'
                : 'bg-rose-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>{nf(gen.done)} / {nf(total)} {L.done}</span>
          {gen.updatedAt > 0 && <span>{L.lastRun}: {new Date(gen.updatedAt).toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Status messages */}
      {gen.status === 'completed' && (
        <p className="mt-3 text-[11px] text-emerald-500 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> {L.completed}
        </p>
      )}
      {gen.status === 'interrupted' && (
        <p className="mt-3 text-[11px] text-amber-500 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {L.interrupted}
        </p>
      )}
      {gen.status === 'error' && (
        <p className="mt-3 text-[11px] text-amber-500 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {L.error}
        </p>
      )}

      {/* Batch stats (mirrors PcBooksPage enrichment tiles) */}
      {(isRunning || gen.processed > 0) && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
          <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
            <div className="text-slate-400 uppercase tracking-wide">{L.processed}</div>
            <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{nf(gen.processed)}</div>
          </div>
          <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
            <div className="text-slate-400 uppercase tracking-wide">{L.done}</div>
            <div className="text-lg font-bold text-emerald-500">{nf(gen.done)}</div>
          </div>
          <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
            <div className="text-slate-400 uppercase tracking-wide">{L.remaining}</div>
            <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{nf(gen.remaining)}</div>
          </div>
        </div>
      )}

      {/* Recent errors (capped, never abort the batch) */}
      {gen.errors.length > 0 && (
        <details className="mt-3 text-[11px]">
          <summary className="cursor-pointer text-amber-500 font-bold">{L.errors} ({gen.errors.length})</summary>
          <ul className="mt-1.5 space-y-0.5 text-slate-500 dark:text-slate-400 max-h-32 overflow-auto">
            {gen.errors.map((e, i) => <li key={i} className="break-words">· {e}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
};

export default PcSentenceAudioPanel;
