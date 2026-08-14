/**
 * WfNewAdminQueues — TTS + translation queue monitoring panel of the wordnew
 * SUPER-ADMIN console (mounted by WfNewAdminPage under the "queues" sub-tab).
 *
 * Two stacked cards:
 *   1. TTS QUEUE — live stats snapshot (total / by_status counts as clickable
 *      filter chips) + a paginated items list (20/page). An auto-refresh toggle
 *      polls the STATS every 5s; the manual Refresh chip reloads stats AND the
 *      items list and toasts on success.
 *   2. TRANSLATION QUEUE — pending-words count + one-click enqueue of all
 *      pending translations, plus the first 20 current queue tasks. The list
 *      payload is a loose backend blob, so the task array is read defensively
 *      (.tasks || .items || .list || bare array).
 *
 * All data flows through the wfNewAdminApi gateway (page-origin pinned base);
 * every async load is guarded against out-of-order responses (reqId refs) and
 * unmount (alive ref), and the poll timer is cleared on toggle-off/unmount.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ListTodo, Languages, RefreshCw, Activity, Send, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewAdminApi } from '../../api';
import type {
  WfNewAdminTtsQueueStats, WfNewAdminQueueItem, WfNewAdminTransTask,
} from '../../api';

const PAGE_SIZE = 20;
const POLL_MS = 5000;

/** Statuses surfaced as clickable stat/filter chips (backend by_status keys). */
const STATUS_KEYS = ['pending', 'processing', 'completed', 'failed'] as const;

/** Full literal class strings per status (Tailwind cannot see dynamic names). */
const STATUS_TONES: Record<string, { chip: string; active: string; label: string }> = {
  pending: {
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    active: 'border-amber-400/60 bg-amber-500/20 text-amber-200',
    label: 'admin.q.pending',
  },
  processing: {
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    active: 'border-sky-400/60 bg-sky-500/20 text-sky-200',
    label: 'admin.q.processing',
  },
  completed: {
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    active: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200',
    label: 'admin.q.completed',
  },
  failed: {
    chip: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    active: 'border-rose-400/60 bg-rose-500/20 text-rose-200',
    label: 'admin.q.failed',
  },
};

const NEUTRAL_CHIP = 'border-white/10 bg-white/5 text-zinc-400';
const BTN_CHIP = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40';
const BTN_CHIP_ACTIVE = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 transition disabled:opacity-40';

const statusTone = (status?: string): string =>
  (status && STATUS_TONES[status]?.chip) || NEUTRAL_CHIP;

interface WfNewAdminQueuesProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type?: 'success' | 'info' | 'warning' | 'star') => void;
}

export const WfNewAdminQueues: React.FC<WfNewAdminQueuesProps> = ({
  activeTheme,
  trans,
  addToast,
}) => {
  // ---- TTS queue state ---- //
  const [stats, setStats] = useState<WfNewAdminTtsQueueStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [items, setItems] = useState<WfNewAdminQueueItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // ---- translation queue state ---- //
  const [transPending, setTransPending] = useState(0);
  const [transTasks, setTransTasks] = useState<WfNewAdminTransTask[]>([]);
  const [transLoading, setTransLoading] = useState(true);
  const [transError, setTransError] = useState<string | null>(null);
  const [enqueueBusy, setEnqueueBusy] = useState(false);

  // Out-of-order / unmount guards: only the latest request may apply state.
  const alive = useRef(true);
  const statsReq = useRef(0);
  const itemsReq = useRef(0);
  const transReq = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(itemsTotal / PAGE_SIZE));

  const loadStats = useCallback(async (): Promise<boolean> => {
    const id = ++statsReq.current;
    setStatsLoading(true);
    try {
      const s = await wfNewAdminApi.getTtsQueueStats();
      if (!alive.current || id !== statsReq.current) return false;
      setStats(s);
      setStatsError(null);
      return true;
    } catch (e: any) {
      if (!alive.current || id !== statsReq.current) return false;
      setStatsError(String(e?.message || 'Request failed'));
      return false;
    } finally {
      if (alive.current && id === statsReq.current) setStatsLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (pageArg: number, statusArg: string | null): Promise<boolean> => {
    const id = ++itemsReq.current;
    setItemsLoading(true);
    try {
      const res = await wfNewAdminApi.getTtsQueueItems({
        ...(statusArg ? { status: statusArg } : {}),
        start: (pageArg - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (!alive.current || id !== itemsReq.current) return false;
      setItems(Array.isArray(res?.items) ? res.items : []);
      setItemsTotal(Number(res?.total ?? 0));
      setItemsError(null);
      return true;
    } catch (e: any) {
      if (!alive.current || id !== itemsReq.current) return false;
      setItemsError(String(e?.message || 'Request failed'));
      return false;
    } finally {
      if (alive.current && id === itemsReq.current) setItemsLoading(false);
    }
  }, []);

  const loadTranslation = useCallback(async (): Promise<void> => {
    const id = ++transReq.current;
    setTransLoading(true);
    try {
      const [pend, list] = await Promise.all([
        wfNewAdminApi.getTranslationPendingWords(),
        wfNewAdminApi.getTranslationQueueList(),
      ]);
      if (!alive.current || id !== transReq.current) return;
      setTransPending(Number(pend?.total ?? 0));
      const raw: any = list;
      const arr: WfNewAdminTransTask[] = Array.isArray(raw?.tasks) ? raw.tasks
        : Array.isArray(raw?.items) ? raw.items
          : Array.isArray(raw?.list) ? raw.list
            : Array.isArray(raw) ? raw : [];
      setTransTasks(arr.slice(0, PAGE_SIZE));
      setTransError(null);
    } catch (e: any) {
      if (!alive.current || id !== transReq.current) return;
      setTransError(String(e?.message || 'Request failed'));
    } finally {
      if (alive.current && id === transReq.current) setTransLoading(false);
    }
  }, []);

  // Initial load: both cards.
  useEffect(() => {
    loadStats();
    loadItems(1, null);
    loadTranslation();
  }, [loadStats, loadItems, loadTranslation]);

  // Auto-refresh: poll STATS ONLY every 5s while toggled on (silent, no toast).
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => { loadStats(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, loadStats]);

  /** Manual refresh: stats + items; toast only here (never on auto polls). */
  const refreshTts = useCallback(async () => {
    const [okStats, okItems] = await Promise.all([
      loadStats(),
      loadItems(page, statusFilter),
    ]);
    if (okStats && okItems) addToast(trans('admin.q.updated'), 'success');
  }, [loadStats, loadItems, page, statusFilter, addToast, trans]);

  /** Toggle a status filter chip (click again to clear) — restarts at page 1. */
  const toggleStatusFilter = useCallback((status: string) => {
    const next = statusFilter === status ? null : status;
    setStatusFilter(next);
    setPage(1);
    loadItems(1, next);
  }, [statusFilter, loadItems]);

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    if (clamped === page) return;
    setPage(clamped);
    loadItems(clamped, statusFilter);
  }, [page, totalPages, statusFilter, loadItems]);

  const enqueuePending = useCallback(async () => {
    setEnqueueBusy(true);
    try {
      const res = await wfNewAdminApi.enqueuePendingTranslations();
      addToast(trans('admin.q.enqueued', { n: Number(res?.enqueued ?? 0) }), 'success');
      await loadTranslation();
    } catch (e: any) {
      if (e?.status === 401) addToast(trans('admin.needLogin'), 'warning');
      else addToast(String(e?.message || 'Request failed'), 'warning');
    } finally {
      if (alive.current) setEnqueueBusy(false);
    }
  }, [addToast, trans, loadTranslation]);

  const byStatus = stats?.by_status ?? {};

  return (
    <div className="space-y-5">
      {/* ---- TTS QUEUE ---- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ListTodo className="w-4 h-4 text-indigo-400" />
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">
            {trans('admin.q.tts')}
          </h3>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={autoRefresh ? BTN_CHIP_ACTIVE : BTN_CHIP}
          >
            <Activity className="w-3.5 h-3.5" /> {trans('admin.q.auto')}
          </button>
          <button type="button" onClick={refreshTts} disabled={statsLoading || itemsLoading} className={BTN_CHIP}>
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} /> {trans('admin.refresh')}
          </button>
        </div>

        {/* Stats: total + clickable per-status filter chips */}
        {statsError && !stats ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-[12px] font-mono text-rose-400">{statsError}</p>
            <button type="button" onClick={() => loadStats()} className={BTN_CHIP}>
              {trans('admin.retry')}
            </button>
          </div>
        ) : !stats && statsLoading ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border ${NEUTRAL_CHIP}`}>
              {trans('admin.q.total')}: <span className="text-zinc-200">{Number(stats?.total ?? 0).toLocaleString()}</span>
            </span>
            {STATUS_KEYS.map((key) => {
              const tone = STATUS_TONES[key];
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStatusFilter(key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition ${active ? tone.active : tone.chip}`}
                >
                  {trans(tone.label)}: {Number(byStatus[key] ?? 0).toLocaleString()}
                </button>
              );
            })}
          </div>
        )}

        {/* Items list */}
        <div className="space-y-2">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">
            {trans('admin.q.items')}
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {itemsLoading ? (
              <div className="p-8 text-center">
                <p className="text-[12px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
              </div>
            ) : itemsError ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-[12px] font-mono text-rose-400">{itemsError}</p>
                <button type="button" onClick={() => loadItems(page, statusFilter)} className={BTN_CHIP}>
                  {trans('admin.retry')}
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[12px] font-mono text-zinc-500">{trans('admin.empty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                <div className="grid grid-cols-[1fr_5rem_6rem_5rem] gap-3 px-4 py-2 bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                  <span>{trans('admin.q.col.content')}</span>
                  <span>{trans('admin.q.col.type')}</span>
                  <span>{trans('admin.q.col.status')}</span>
                  <span>{trans('admin.q.col.lang')}</span>
                </div>
                {items.map((item, i) => (
                  <div
                    key={`${item.content ?? item.text ?? 'row'}-${i}`}
                    className="grid grid-cols-[1fr_5rem_6rem_5rem] gap-3 px-4 py-2.5 items-center hover:bg-white/[0.03] transition"
                  >
                    <span className="text-[12px] text-zinc-300 truncate">{item.content ?? item.text ?? '—'}</span>
                    <span className="text-[10px] font-mono text-zinc-500 truncate">{item.type ?? '—'}</span>
                    <span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${statusTone(item.status)}`}>
                        {item.status ?? '—'}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 truncate">{item.language ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* prev / next pager */}
          {!itemsLoading && !itemsError && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className={BTN_CHIP}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> {trans('content.prev')}
              </button>
              <span className="px-3 text-[11px] font-mono text-zinc-400">
                {trans('content.pageOf', { page, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className={BTN_CHIP}
              >
                {trans('content.next')} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ---- TRANSLATION QUEUE ---- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Languages className="w-4 h-4 text-indigo-400" />
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">
            {trans('admin.q.trans')}
          </h3>
          <div className="min-w-0 flex-1" />
          <button type="button" onClick={loadTranslation} disabled={transLoading} className={BTN_CHIP}>
            <RefreshCw className={`w-3.5 h-3.5 ${transLoading ? 'animate-spin' : ''}`} /> {trans('admin.refresh')}
          </button>
        </div>

        {transLoading && transTasks.length === 0 && !transError ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500 animate-pulse">{trans('admin.loading')}</p>
          </div>
        ) : transError ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-[12px] font-mono text-rose-400">{transError}</p>
            <button type="button" onClick={loadTranslation} className={BTN_CHIP}>
              {trans('admin.retry')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border ${STATUS_TONES.pending.chip}`}>
                {trans('admin.q.transPending', { n: transPending })}
              </span>
              <button
                type="button"
                onClick={enqueuePending}
                disabled={enqueueBusy}
                className={BTN_CHIP}
              >
                <Send className="w-3.5 h-3.5" /> {trans('admin.q.enqueue')}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              {transTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-[12px] font-mono text-zinc-500">{trans('admin.empty')}</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  <div className="grid grid-cols-[1fr_5rem_6rem_3rem] gap-3 px-4 py-2 bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                    <span>{trans('admin.q.col.content')}</span>
                    <span>{trans('admin.q.col.lang')}</span>
                    <span>{trans('admin.q.col.status')}</span>
                    <span aria-hidden="true" />
                  </div>
                  {transTasks.map((task, i) => (
                    <div
                      key={`${task.id ?? task.word ?? task.content ?? 'task'}-${i}`}
                      className="grid grid-cols-[1fr_5rem_6rem_3rem] gap-3 px-4 py-2.5 items-center hover:bg-white/[0.03] transition"
                    >
                      <span className="text-[12px] text-zinc-300 truncate">{task.word ?? task.content ?? '—'}</span>
                      <span className="text-[10px] font-mono text-zinc-500 truncate">{task.language ?? '—'}</span>
                      <span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${statusTone(task.status)}`}>
                          {task.status ?? '—'}
                        </span>
                      </span>
                      {/* priority: bare numeric badge, only when the blob carries one */}
                      <span className="text-[10px] font-mono text-zinc-500 text-right">
                        {typeof task.priority === 'number' ? task.priority : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
