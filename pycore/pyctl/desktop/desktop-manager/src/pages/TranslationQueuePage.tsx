import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ListOrdered, RefreshCcw, AlertTriangle, CheckCircle2, WifiOff, Wifi,
  Clock, Languages, ChevronUp, ChevronsUp, ChevronDown, Flame, Zap, User,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { pycoreApi } from '../api/pycore';
import type { TranslationQueueItem, TranslationQueueSummary } from '../types';

/**
 * Translation Queue — Laravel's pending translation queue, steerable from pycore.
 *
 * On mount + a ~5s auto-refresh it fetches GET /api/local/translation/queue (via
 * the /pyapi reverse proxy) and renders the summary counts, a Laravel-reachable
 * indicator and the list of pending items. Each item exposes priority controls
 * (raise / boost-to-top / lower → POST .../queue/priority) and the panel has a
 * stack control (POST .../queue/stack) that dedups+bumps existing words or
 * enqueues new ones at high priority. Items the backend flagged
 * `recently_bumped` get an animated amber ring + "bumped" badge so qyApp-driven
 * priority jumps are visible in real time. The contract is owned by the backend.
 */

const REFRESH_MS = 5000;
const EMPTY_SUMMARY: TranslationQueueSummary = {
  pending: 0, processing: 0, completed: 0, failed: 0, total: 0,
};

// Human-friendly age, e.g. 12s / 3m / 2h.
function ageLabel(seconds: number): string {
  if (seconds == null || seconds < 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

// Truncate a long word list to a compact "a, b, c +N" preview.
function wordsLabel(words: string[]): string {
  if (!words || words.length === 0) return '-';
  const head = words.slice(0, 3).join(', ');
  return words.length > 3 ? `${head} +${words.length - 3}` : head;
}

export default function TranslationQueuePage() {
  const { settings, t, toast } = useApp();
  const dark = settings.theme === 'dark';

  const [items, setItems] = useState<TranslationQueueItem[] | null>(null);
  const [summary, setSummary] = useState<TranslationQueueSummary>(EMPTY_SUMMARY);
  const [reachable, setReachable] = useState(true);
  const [loading, setLoading] = useState(true);   // first paint = loading
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null); // task with an in-flight priority change

  // Stack form state.
  const [stackWords, setStackWords] = useState('');
  const [stackLang, setStackLang] = useState('en');
  const [stackTarget, setStackTarget] = useState('zh');
  const [stacking, setStacking] = useState(false);

  // Guard against state updates after unmount (auto-refresh interval).
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchQueue = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else if (items === null) setLoading(true);
    try {
      const r = await pycoreApi.queueTranslation(refresh);
      if (!mounted.current) return;
      setItems(Array.isArray(r?.items) ? r.items : []);
      setSummary(r?.summary ?? EMPTY_SUMMARY);
      setReachable(r?.laravel_reachable !== false);
      setError(r?.error ?? null);
    } catch (e: any) {
      if (!mounted.current) return;
      setError(e?.message || t.tqError);
      // keep the last good snapshot (if any) so a transient refresh failure
      // doesn't blank the panel.
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, [items, t.tqError]);

  // Initial load + periodic auto-refresh (background, non-spinning).
  useEffect(() => {
    fetchQueue(false);
    const id = setInterval(() => fetchQueue(false), REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- priority steering ------------------------------------------------- #
  const changePriority = useCallback(async (it: TranslationQueueItem, next: number) => {
    setBusyTask(it.task_id);
    try {
      const r = await pycoreApi.setQueuePriority(it.task_id, next);
      if (r?.success === false) throw new Error(r?.error || t.tqActionFailed);
      toast(t.tqPriorityOk, 'success');
      await fetchQueue(true);
    } catch (e: any) {
      toast(`${t.tqActionFailed}: ${e?.message || ''}`.trim(), 'error');
    } finally {
      if (mounted.current) setBusyTask(null);
    }
  }, [fetchQueue, t.tqActionFailed, t.tqPriorityOk, toast]);

  // --- stack (dedup+bump or enqueue at high priority) -------------------- #
  const submitStack = useCallback(async () => {
    const words = stackWords.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) { toast(t.tqStackEmpty, 'error'); return; }
    setStacking(true);
    try {
      const r = await pycoreApi.stackQueue(words, stackLang.trim() || 'en', stackTarget.trim() || 'zh');
      if (r?.success === false) throw new Error(r?.error || t.tqActionFailed);
      toast(t.tqStackOk, 'success');
      setStackWords('');
      await fetchQueue(true);
    } catch (e: any) {
      toast(`${t.tqActionFailed}: ${e?.message || ''}`.trim(), 'error');
    } finally {
      if (mounted.current) setStacking(false);
    }
  }, [stackWords, stackLang, stackTarget, fetchQueue, t.tqActionFailed, t.tqStackEmpty, t.tqStackOk, toast]);

  // --- styling helpers (mirrors the other pages) ------------------------- #
  const card = `rounded-3xl p-6 border backdrop-blur-xl transition-all ${
    dark ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-md'}`;
  const stat = `rounded-2xl p-4 border ${
    dark ? 'bg-white/5 border-white/5' : 'bg-slate-100/60 border-slate-300/35'}`;
  const inputCls = `w-full rounded-xl px-3 py-2 text-sm border outline-none transition ${
    dark ? 'bg-white/5 border-white/10 focus:border-sky-400/50 text-zinc-200'
         : 'bg-white border-slate-300 focus:border-sky-400 text-slate-700'}`;

  // A summary stat chip.
  const chip = (label: string, value: number, cls: string) => (
    <div className={stat}>
      <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
    </div>
  );

  const list = items ?? [];

  return (
    <div className="space-y-5">
      <div className={card}>
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-sky-400" /> {t.tq}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.tqSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Laravel reachability indicator */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                reachable ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}
              title={reachable ? t.tqOnline : t.tqOffline}>
              {reachable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {reachable ? t.tqOnline : t.tqOffline}
            </span>
            <button onClick={() => fetchQueue(true)} disabled={loading || refreshing}
              className="px-3 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
              <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {t.tqRefresh}
            </button>
          </div>
        </div>

        {/* offline banner (when Laravel is unreachable) */}
        {!reachable && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-500">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{t.tqOffline}</span>
          </div>
        )}

        {/* error banner (shown alongside any cached snapshot) */}
        {error && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-500">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{t.tqError} {error}</span>
          </div>
        )}

        {/* summary stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {chip(t.tqPending, summary.pending, 'text-sky-500')}
          {chip(t.tqProcessing, summary.processing, 'text-violet-500')}
          {chip(t.tqCompleted, summary.completed, 'text-emerald-500')}
          {chip(t.tqFailed, summary.failed, 'text-rose-500')}
        </div>

        {/* states: loading / empty / list */}
        {loading && list.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" />
            {t.tqLoading}
          </div>
        ) : list.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            {t.tqEmpty}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {list.map((it) => {
              const busy = busyTask === it.task_id;
              return (
              <li
                key={it.task_id}
                className={`${stat} flex items-center gap-3 transition ${
                  it.recently_bumped
                    ? 'ring-2 ring-amber-400/70 animate-pulse border-amber-400/40'
                    : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* prominent priority */}
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-sky-500/15 text-sky-500 tabular-nums"
                      title={t.tqPriority}>
                      <Flame className="w-3 h-3" /> {it.priority}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate" title={it.words?.join(', ')}>
                      {wordsLabel(it.words)}
                    </span>
                    {it.recently_bumped && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-500">
                        <Zap className="w-3 h-3" /> {t.tqBumped}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1" title={t.tqStatus}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="font-mono">{it.status}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title={t.tqTarget}>
                      <Languages className="w-3 h-3" />
                      <span className="font-mono">{it.language} → {it.target_language}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title={t.tqAge}>
                      <Clock className="w-3 h-3" />
                      <span className="font-mono">{ageLabel(it.age_seconds)}</span>
                    </span>
                    {it.assigned_to && (
                      <span className="inline-flex items-center gap-1" title={t.tqAssigned}>
                        <User className="w-3 h-3" />
                        <span className="font-mono truncate max-w-[8rem]">{it.assigned_to}</span>
                      </span>
                    )}
                  </div>
                </div>
                {/* priority controls */}
                <div className="shrink-0 flex items-center gap-1">
                  <button onClick={() => changePriority(it, it.priority + 1)} disabled={busy}
                    title={t.tqRaise}
                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition disabled:opacity-40">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => changePriority(it, it.priority + 10)} disabled={busy}
                    title={t.tqRaiseMore}
                    className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 transition disabled:opacity-40">
                    <ChevronsUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => changePriority(it, Math.max(0, it.priority - 1))} disabled={busy || it.priority <= 0}
                    title={t.tqLower}
                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition disabled:opacity-40">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* stack control card */}
      <div className={card}>
        <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-amber-500" /> {t.tqStackTitle}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.tqStackHint}</p>
        <textarea
          value={stackWords}
          onChange={(e) => setStackWords(e.target.value)}
          placeholder={t.tqStackWords}
          rows={2}
          className={`${inputCls} resize-y mb-3`} />
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 text-[11px] text-slate-500">
            {t.tqStackLang}
            <input value={stackLang} onChange={(e) => setStackLang(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="flex-1 text-[11px] text-slate-500">
            {t.tqStackTarget}
            <input value={stackTarget} onChange={(e) => setStackTarget(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <button onClick={submitStack} disabled={stacking}
            className="self-end px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shrink-0">
            <Zap className={`w-3.5 h-3.5 ${stacking ? 'animate-pulse' : ''}`} /> {t.tqStackBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
