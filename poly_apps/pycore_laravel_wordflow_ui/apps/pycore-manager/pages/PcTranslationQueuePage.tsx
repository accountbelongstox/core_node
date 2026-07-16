/**
 * PcTranslationQueuePanel — Laravel's pending translation queue, steered via
 * pycore (Translation Queue tab body).
 *
 * Formerly the standalone PcTranslationQueuePage (route
 * /pycore-manager/translation-queue); now one tab of PcQueueCenterPage, which
 * owns the page header, the shared refresh button (`refreshTick`) and the
 * auto-refresh interval. The data logic is unchanged: a ~5s continuous poll of
 * pycoreApi.queueTranslation through the global task layer renders summary
 * counts, a Laravel-reachable indicator and the pending items. Each item
 * exposes priority controls (raise / boost / lower → setQueuePriority) and a
 * stack control (stackQueue) dedups+bumps or enqueues at high priority. Items
 * the backend flagged `recently_bumped` get an animated ring. Every backend
 * call is guarded; the last good snapshot is kept on a transient failure.
 * Pending count/loading are reported up via `onMeta`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ListOrdered, RefreshCcw, AlertTriangle, CheckCircle2, WifiOff, Wifi, Radio,
  Clock, Languages, ChevronUp, ChevronsUp, ChevronDown, Flame, Zap, User,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { TranslationQueueItem, TranslationQueueSummary, PycoreGlobalTaskDetail } from '../../../core/api-libs/pycore/pycoreTypes';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import { PcGlobalTaskDetailModal } from '../components/PcTaskDetailModal';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

const REFRESH_MS = 5000;
const EMPTY_SUMMARY: TranslationQueueSummary = {
  pending: 0, processing: 0, completed: 0, failed: 0, total: 0,
};

function ageLabel(seconds: number): string {
  if (seconds == null || seconds < 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function wordsLabel(words: string[]): string {
  if (!words || words.length === 0) return '-';
  const head = words.slice(0, 3).join(', ');
  return words.length > 3 ? `${head} +${words.length - 3}` : head;
}

// The backend-owned snapshot kept alive across navigation/reload by the global
// task layer. Page-only UI (stack form, busy flags, notices) stays local.
interface QueueSnapshot {
  items: TranslationQueueItem[];
  summary: TranslationQueueSummary;
  reachable: boolean;
  /** Live-log WS bridge state from pycore (`ws_connected`); null = backend didn't report it. */
  wsConnected: boolean | null;
  error: string | null;
}

import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';

/** Contract with PcQueueCenterPage (shared panel props). */
type PanelProps = QueueCenterPanelProps;

const PcTranslationQueuePanel: React.FC<PanelProps> = ({ refreshTick = 0, onMeta }) => {
  const { laravelStoredEndpoint, laravelActiveEndpoint } = useQueueCenterHub();
  const laravelEndpoint = laravelStoredEndpoint || laravelActiveEndpoint;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);

  const [stackWords, setStackWords] = useState('');
  const [stackLang, setStackLang] = useState('en');
  const [stackTarget, setStackTarget] = useState('zh');
  const [stacking, setStacking] = useState(false);

  const [selectedItem, setSelectedItem] = useState<TranslationQueueItem | null>(null);
  const [taskDetail, setTaskDetail] = useState<PycoreGlobalTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Last time a fetch ran (persistent poll OR manual/tick refresh). Used to skip
  // the parent-tick immediate fetch when a persistent poll just ran, so the two
  // don't double-fetch the same endpoint.
  const lastFetchAt = useRef(0);

  // Continuous-poll view: the snapshot + poll loop live in the global provider
  // above the router (survive navigation; reload re-polls).
  const queue = usePersistentTask<QueueSnapshot>('pycore.translation-queue', {
    intervalMs: REFRESH_MS,
    poll: () => pycoreApi.queueTranslation(false)
      .then((r: any) => {
        if (mounted.current) setLoading(false);
        lastFetchAt.current = Date.now();
        return {
          items: Array.isArray(r?.items) ? r.items : [],
          summary: r?.summary ?? EMPTY_SUMMARY,
          reachable: r?.laravel_reachable !== false,
          wsConnected: typeof r?.ws_connected === 'boolean' ? r.ws_connected : null,
          error: r?.error ?? null,
        };
      })
      .catch((e: any) => {
        if (mounted.current) setLoading(false);
        // keep the last good snapshot; surface only the unreachable state
        const prev = queue.data;
        return { ...(prev ?? { items: [], summary: EMPTY_SUMMARY, wsConnected: null }), reachable: false, error: e?.message || 'pycore unreachable' } as QueueSnapshot;
      }),
  });

  const snap = queue.data;
  const items: TranslationQueueItem[] | null = snap ? snap.items : null;
  const summary: TranslationQueueSummary = snap?.summary ?? EMPTY_SUMMARY;
  const reachable = snap ? snap.reachable : true;
  const wsConnected = snap?.wsConnected ?? null;
  const error = snap?.error ?? null;

  // Start the continuous poll on first mount. Stop it on unmount so the
  // persistent session does NOT poll forever app-wide after the user leaves
  // this tab (polling with no consumer is pure waste).
  useEffect(() => {
    if (!queue.running) queue.begin();
    return () => { queue.end(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual / post-action refresh = one immediate fetch pushed into the session.
  const fetchQueue = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else if (queue.data === null) setLoading(true);
    lastFetchAt.current = Date.now();
    const r = await pycoreApi.queueTranslation(refresh).catch((e: any) => ({ __err: e?.message || 'pycore unreachable' } as any));
    if (!mounted.current) return;
    if (r && r.__err) {
      const prev = queue.data;
      queue.set({ ...(prev ?? { items: [], summary: EMPTY_SUMMARY, wsConnected: null }), reachable: false, error: r.__err } as QueueSnapshot);
    } else {
      queue.set({
        items: Array.isArray(r?.items) ? r.items : [],
        summary: r?.summary ?? EMPTY_SUMMARY,
        reachable: r?.laravel_reachable !== false,
        wsConnected: typeof r?.ws_connected === 'boolean' ? r.ws_connected : null,
        error: r?.error ?? null,
      });
    }
    setLoading(false); setRefreshing(false);
  }, [queue]);

  // Parent-driven refresh (manual button or the shared auto-refresh interval).
  // Skip when the persistent poll fetched within the last interval - the two
  // would otherwise hit the same endpoint back-to-back on every tick.
  const lastTick = useRef(refreshTick);
  useEffect(() => {
    if (refreshTick !== lastTick.current) {
      lastTick.current = refreshTick;
      if (Date.now() - lastFetchAt.current >= REFRESH_MS) {
        fetchQueue(true);
      }
    }
  }, [refreshTick, fetchQueue]);

  // Report the pending count + in-flight state up to the tab bar.
  useEffect(() => {
    onMeta?.({ count: snap ? summary.pending : null, loading: loading || refreshing });
  }, [snap, summary.pending, loading, refreshing, onMeta]);

  const changePriority = useCallback(async (it: TranslationQueueItem, next: number) => {
    setBusyTask(it.task_id);
    try {
      const r = await pycoreApi.setQueuePriority(it.task_id, next);
      if (r?.success === false) throw new Error(r?.error || 'Action failed');
      setNotice('Priority updated');
      await fetchQueue(true);
    } catch (e: any) {
      setNotice(`Action failed: ${e?.message || ''}`.trim());
    } finally {
      if (mounted.current) setBusyTask(null);
    }
  }, [fetchQueue]);

  const submitStack = useCallback(async () => {
    const words = stackWords.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) { setNotice('Enter at least one word'); return; }
    setStacking(true);
    try {
      const r = await pycoreApi.stackQueue(words, stackLang.trim() || 'en', stackTarget.trim() || 'zh');
      if (r?.success === false) throw new Error(r?.error || 'Action failed');
      setNotice('Words stacked at high priority');
      setStackWords('');
      await fetchQueue(true);
    } catch (e: any) {
      setNotice(`Action failed: ${e?.message || ''}`.trim());
    } finally {
      if (mounted.current) setStacking(false);
    }
  }, [stackWords, stackLang, stackTarget, fetchQueue]);

  const openTaskDetail = useCallback(async (it: TranslationQueueItem) => {
    setSelectedItem(it);
    setDetailLoading(true);
    setTaskDetail({
      task_id: it.task_id,
      app_name: '—',
      task_type: 'word_translation',
      execution_type: 'remote_translation',
      status: it.status,
      progress: it.status === 'completed' ? 100 : 0,
      assigned_to: it.assigned_to,
      created_at: it.created_at,
      updated_at: null,
      payload: { words: it.words, language: it.language, target_language: it.target_language, priority: it.priority },
    });
    try {
      const r = await pycoreApi.getTranslationTaskDetail(it.task_id);
      if (mounted.current && r?.success && r.task) {
        setTaskDetail(r.task);
      }
    } catch {
      // Keep list-row snapshot.
    } finally {
      if (mounted.current) setDetailLoading(false);
    }
  }, []);

  const closeTaskDetail = useCallback(() => {
    setSelectedItem(null);
    setTaskDetail(null);
    setDetailLoading(false);
  }, []);

  const inputCls = 'w-full rounded-xl px-3 py-2 text-sm border outline-none transition bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 focus:border-sky-400 text-slate-700 dark:text-zinc-200';
  const stat = 'rounded-2xl p-4 border bg-slate-100/60 dark:bg-white/5 border-slate-300/35 dark:border-white/5';

  const chip = (label: string, value: number, cls: string) => (
    <div className={stat}>
      <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
    </div>
  );

  const list = items ?? [];

  return (
    <div className="space-y-5">
      <section className="pc-glass p-6">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <ListOrdered className="w-4 h-4 text-sky-500" /> Pending translations
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">{summary.pending}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Laravel's pending translation queue, steerable from pycore.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
              reachable ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}
              title={reachable ? 'Online' : 'Offline'}>
              {reachable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {reachable ? 'Online' : 'Offline'}
            </span>
            {wsConnected !== null && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                wsConnected ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}
                title={wsConnected ? 'Live-log WebSocket connected' : 'Live-log WebSocket not connected'}>
                <Radio className="w-3 h-3" />
                {wsConnected ? 'WS live' : 'WS off'}
              </span>
            )}
          </div>
        </div>

        {!reachable && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">
              Backend unreachable
              {laravelEndpoint ? <> at <span className="font-mono">{laravelEndpoint}</span></> : null}
              {' '}— showing the last known snapshot. Enable Assist Translation and check the Laravel endpoint in Settings.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-500">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* summary stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {chip('Pending', summary.pending, 'text-sky-500')}
          {chip('Processing', summary.processing, 'text-violet-500')}
          {chip('Completed', summary.completed, 'text-emerald-500')}
          {chip('Failed', summary.failed, 'text-rose-500')}
        </div>

        {loading && list.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" />
            Loading queue…
          </div>
        ) : list.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            The translation queue is empty.
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-[480px] overflow-y-auto">
            {list.map((it) => {
              const busy = busyTask === it.task_id;
              return (
                <li key={it.task_id}
                  onClick={() => openTaskDetail(it)}
                  className={`${stat} flex items-center gap-3 transition cursor-pointer hover:border-sky-400/40 ${
                    it.recently_bumped ? 'ring-2 ring-amber-400/70 animate-pulse border-amber-400/40' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-sky-500/15 text-sky-500 tabular-nums" title="Priority">
                        <Flame className="w-3 h-3" /> {it.priority}
                      </span>
                      <span className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate" title={it.words?.join(', ')}>
                        {wordsLabel(it.words)}
                      </span>
                      {it.recently_bumped && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-500">
                          <Zap className="w-3 h-3" /> bumped
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1" title="Status">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="font-mono">{it.status}</span>
                      </span>
                      <span className="inline-flex items-center gap-1" title="Translation">
                        <Languages className="w-3 h-3" />
                        <span className="font-mono">{it.language} → {it.target_language}</span>
                      </span>
                      <span className="inline-flex items-center gap-1" title="Age">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{ageLabel(it.age_seconds)}</span>
                      </span>
                      {it.assigned_to && (
                        <span className="inline-flex items-center gap-1" title="Assigned to">
                          <User className="w-3 h-3" />
                          <span className="font-mono truncate max-w-[8rem]">{it.assigned_to}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => changePriority(it, it.priority + 1)} disabled={busy}
                      title="Raise priority"
                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition disabled:opacity-40">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => changePriority(it, it.priority + 10)} disabled={busy}
                      title="Boost priority"
                      className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 transition disabled:opacity-40">
                      <ChevronsUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => changePriority(it, Math.max(0, it.priority - 1))} disabled={busy || it.priority <= 0}
                      title="Lower priority"
                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition disabled:opacity-40">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {notice && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>
        )}
      </section>

      {/* stack control card */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 mb-1 text-slate-800 dark:text-slate-100">
          <Zap className="w-4 h-4 text-amber-500" /> Stack words
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Dedup + bump existing words, or enqueue new ones at high priority.
        </p>
        <textarea
          value={stackWords}
          onChange={(e) => setStackWords(e.target.value)}
          placeholder="words, separated by commas or new lines"
          rows={2}
          className={`${inputCls} resize-y mb-3`} />
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 text-[11px] text-slate-500">
            Source language
            <input value={stackLang} onChange={(e) => setStackLang(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="flex-1 text-[11px] text-slate-500">
            Target language
            <input value={stackTarget} onChange={(e) => setStackTarget(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <button onClick={submitStack} disabled={stacking}
            className="self-end px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shrink-0">
            <Zap className={`w-3.5 h-3.5 ${stacking ? 'animate-pulse' : ''}`} /> Stack
          </button>
        </div>
      </section>

      {selectedItem && (
        <PcGlobalTaskDetailModal
          task={taskDetail}
          loading={detailLoading}
          onClose={closeTaskDetail}
        />
      )}
    </div>
  );
};

export default PcTranslationQueuePanel;
