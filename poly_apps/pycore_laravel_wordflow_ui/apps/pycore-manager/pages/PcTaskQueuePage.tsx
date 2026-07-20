/**
 * PcTaskQueuePanel — pycore voice-subtitle task list with live progress
 * (Task Queue tab body).
 *
 * Formerly the standalone PcTaskQueuePage (route /pycore-manager/task-queue);
 * now one tab of PcQueueCenterPage, which owns the page header, the shared
 * refresh button (`refreshTick`) and the auto-refresh interval. The data logic
 * is unchanged: polls /voice-subtitle/tasks (via pycoreApi.pyGet) through the
 * global task layer (usePersistentTask, survives navigation) and keeps tasks
 * live through a WS `task_update` subscription + connectPycoreWs. Every
 * backend call is guarded; an inline "pycore unreachable" state is shown when
 * the backend (:59000) is offline. Count/loading are reported up via `onMeta`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ListChecks, RefreshCw, AlertTriangle, Wifi, WifiOff, Layers2,
} from 'lucide-react';
import { pycoreApi, connectPycoreWs, subscribe, onWsStatus } from '../../../core/api-libs/pycore';
import type { LocalTaskDetail, PycoreGlobalTaskDetail } from '../../../core/api-libs/pycore/pycoreTypes';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import { PcLocalTaskDetailModal } from '../components/PcTaskDetailModal';
import { extractTaskContentSummary } from '../utils/pcTaskContent';
import { extractAudioPath } from '../components/PcTaskAudioPreview';
import { extractEngine, extractSynthCommand } from '../components/PcTaskSynthInfo';
import { isLaravelGlobalTaskId, mergeTaskResultSources, resolveRemoteTaskId } from '../utils/pcTaskResult';

interface TaskRow {
  task_id: string;
  task_type: string;
  status: string;
  progress: number;
  created_at?: string;
  updated_at?: string;
  input_data?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

const REFRESH_MS = 4000;

function statusColor(s: string): string {
  return s === 'completed' ? 'text-emerald-500'
    : s === 'failed' ? 'text-rose-500'
    : s === 'processing' ? 'text-sky-500'
    : 'text-slate-400';
}

// Merge an incoming task into the list, keyed by task_id (newest fields win).
function mergeTask(list: TaskRow[], incoming: Partial<TaskRow> & { task_id?: string }): TaskRow[] {
  if (!incoming?.task_id) return list;
  const idx = list.findIndex((t) => t.task_id === incoming.task_id);
  if (idx === -1) {
    return [{
      task_id: incoming.task_id,
      task_type: incoming.task_type ?? '?',
      status: incoming.status ?? 'pending',
      progress: incoming.progress ?? 0,
      created_at: incoming.created_at,
      updated_at: incoming.updated_at,
      input_data: incoming.input_data,
      result: incoming.result,
      error: incoming.error,
    }, ...list];
  }
  const next = list.slice();
  next[idx] = { ...next[idx], ...incoming } as TaskRow;
  return next;
}

import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';

/** Contract with PcQueueCenterPage (shared panel props + section live switch). */
type PanelProps = QueueCenterPanelProps & { live?: boolean };

const PcTaskQueuePanel: React.FC<PanelProps> = ({ refreshTick = 0, onMeta, live = true }) => {
  // Continuous-poll view backed by the global task layer: the list + poll loop
  // live in <TaskPersistenceProvider> above the router, so they survive leaving
  // and returning to this page, and a full reload re-polls. The poll fn reports
  // reachability/error through refs that React state mirrors for the banner.
  const [unreachable, setUnreachable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<LocalTaskDetail | null>(null);
  const [remoteDetail, setRemoteDetail] = useState<PycoreGlobalTaskDetail | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [laravelReachable, setLaravelReachable] = useState<boolean | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Last time a fetch ran (persistent poll OR manual/tick refresh). Used to skip
  // the parent-tick immediate fetch when a persistent poll just ran, so the two
  // don't double-fetch the same endpoint.
  const lastFetchAt = useRef(0);

  const queue = usePersistentTask<TaskRow[]>('pycore.task-queue', {
    intervalMs: REFRESH_MS,
    poll: () => pycoreApi.pyGet<any>('/voice-subtitle/tasks?limit=50')
      .then((r: any) => {
        if (mounted.current) { setUnreachable(false); setError(null); setLoading(false); }
        lastFetchAt.current = Date.now();
        return Array.isArray(r?.tasks) ? r.tasks : Array.isArray(r) ? r : [];
      })
      .catch((e: any) => {
        if (mounted.current) { setUnreachable(true); setError(e?.message || 'pycore unreachable'); setLoading(false); }
        return null; // keep the last good list (don't clobber on a transient failure)
      }),
  });

  const tasks: TaskRow[] = queue.data ?? [];

  // Start/stop the continuous poll with the section live switch (idempotent if
  // already running). Stop it on unmount so the persistent session does NOT poll
  // forever app-wide after the user leaves this page (the session is kept alive
  // across navigation by design, but polling with no consumer is pure waste).
  useEffect(() => {
    if (live && !queue.running) queue.begin();
    else if (!live && queue.running) queue.end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  useEffect(() => () => { queue.end(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  // Manual refresh = one immediate poll pushed into the shared session.
  const refresh = useCallback(() => {
    setLoading(true);
    lastFetchAt.current = Date.now();
    pycoreApi.pyGet<any>('/voice-subtitle/tasks?limit=50')
      .then((r: any) => {
        if (!mounted.current) return;
        const list = Array.isArray(r?.tasks) ? r.tasks : Array.isArray(r) ? r : [];
        queue.set(list);
        setUnreachable(false); setError(null); setLoading(false);
      })
      .catch((e: any) => {
        if (!mounted.current) return;
        setUnreachable(true); setError(e?.message || 'pycore unreachable'); setLoading(false);
      });
  }, [queue]);

  // Parent-driven refresh (manual button or the shared auto-refresh interval).
  // Skip when the persistent poll fetched within the last interval - the two
  // would otherwise hit the same endpoint back-to-back on every tick.
  const lastTick = useRef(refreshTick);
  useEffect(() => {
    if (refreshTick !== lastTick.current) {
      lastTick.current = refreshTick;
      if (live && Date.now() - lastFetchAt.current >= REFRESH_MS) {
        refresh();
      }
    }
  }, [refreshTick, refresh, live]);

  // Report count + loading up to the tab bar / shared spinner.
  useEffect(() => { onMeta?.({ count: tasks.length, loading }); }, [tasks.length, loading, onMeta]);

  // Optional live updates: a task tick patches the matching row in place.
  useEffect(() => {
    connectPycoreWs();
    const offStatus = onWsStatus(setWsConnected);
    const offTask = subscribe('task_update', (data: any) => {
      if (!data) return;
      if (Array.isArray(data.tasks)) { queue.set(data.tasks); return; }
      queue.set(mergeTask(queue.data ?? [], data));
    });
    return () => { offStatus(); offTask(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = tasks.filter((t) => t.status === 'processing' || t.status === 'pending').length;

  const openTaskDetail = useCallback(async (taskId: string) => {
    const row = tasks.find((t) => t.task_id === taskId);
    setSelectedId(taskId);
    setRemoteDetail(null);
    setRemoteError(null);
    setLaravelReachable(null);
    setRemoteLoading(false);
    setDetailLoading(true);
    if (row) {
      setTaskDetail({
        task_id: row.task_id,
        task_type: row.task_type,
        status: row.status,
        progress: row.progress ?? 0,
        input_data: (row.input_data as Record<string, unknown>) ?? {},
        result: row.result ?? null,
        error: row.error ?? null,
        created_at: row.created_at ?? '',
        updated_at: row.updated_at ?? row.created_at ?? '',
      });
    } else {
      setTaskDetail(null);
    }
    try {
      const r = await pycoreApi.getLocalTaskDetail(taskId);
      if (!mounted.current) return;
      if (r?.success && r.task) {
        setTaskDetail(r.task);
        const remoteId = resolveRemoteTaskId(
          r.task.input_data as Record<string, unknown> | undefined,
          r.task.result as Record<string, unknown> | undefined,
        );
        if (isLaravelGlobalTaskId(remoteId)) {
          setRemoteLoading(true);
          try {
            const remote = await pycoreApi.getTranslationTaskDetail(remoteId);
            if (!mounted.current) return;
            if (remote?.success && remote.task) {
              setRemoteDetail(remote.task);
              setRemoteError(null);
              setLaravelReachable(remote.laravel_reachable ?? true);
            } else {
              setRemoteError(remote?.error ?? 'Remote task detail unavailable');
              setLaravelReachable(remote?.laravel_reachable ?? null);
            }
          } catch (e) {
            if (mounted.current) {
              setRemoteError(e instanceof Error ? e.message : 'Remote task detail unavailable');
            }
          } finally {
            if (mounted.current) setRemoteLoading(false);
          }
        }
      }
    } catch {
      // Keep the row snapshot already shown.
    } finally {
      if (mounted.current) setDetailLoading(false);
    }
  }, [tasks]);

  const closeTaskDetail = useCallback(() => {
    setSelectedId(null);
    setTaskDetail(null);
    setRemoteDetail(null);
    setRemoteError(null);
    setLaravelReachable(null);
    setDetailLoading(false);
    setRemoteLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            pycore unreachable — the backend (:59000) may be offline.{error ? ` (${error})` : ''}
          </span>
        </div>
      )}

      <section className="pc-glass overflow-hidden">
        <div className="p-5 border-b border-slate-200/40 dark:border-white/5 flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <ListChecks className="w-4 h-4 text-sky-500" /> Tasks
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">{tasks.length}</span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{active} active</span>
          </h2>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
            wsConnected ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}
            title={wsConnected ? 'Live connected' : 'Live disconnected'}>
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsConnected ? 'Live' : 'Polling'}
          </span>
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 max-h-[480px] overflow-auto min-h-[260px]">
          {loading && tasks.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <p className="text-xs">Loading tasks…</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-500">
              <Layers2 className="w-8 h-8 opacity-40 mb-2 text-sky-500" />
              <p className="text-xs italic">No tasks yet.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              {/* sticky header so column labels stay visible in long lists */}
              <thead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                <tr className="text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200/50 dark:border-white/5">
                  <th className="py-3 font-semibold">Task ID</th>
                  <th className="py-3 font-semibold">Type</th>
                  <th className="py-3 font-semibold">Content</th>
                  <th className="py-3 font-semibold">Engine</th>
                  <th className="py-3 font-semibold">Output</th>
                  <th className="py-3 font-semibold">Status</th>
                  <th className="py-3 font-semibold w-40">Progress</th>
                  <th className="py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {tasks.map((tk) => {
                  const pct = Math.max(0, Math.min(100, tk.progress ?? 0));
                  const contentLabel = extractTaskContentSummary(tk.input_data);
                  const merged = mergeTaskResultSources(tk.input_data, tk.result ?? undefined);
                  const engine = extractEngine(merged);
                  const synthCmd = extractSynthCommand(merged);
                  const audioPath = extractAudioPath(merged);
                  return (
                    <tr
                      key={tk.task_id}
                      onClick={() => openTaskDetail(tk.task_id)}
                      className="hover:bg-sky-500/5 transition cursor-pointer"
                    >
                      <td className="py-3 font-mono text-[10px] text-slate-500">{tk.task_id}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-300">{tk.task_type}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-300 max-w-[12rem] truncate" title={contentLabel}>
                        {contentLabel}
                      </td>
                      <td className="py-3 text-[10px] font-mono text-sky-600 dark:text-sky-400 max-w-[6rem] truncate" title={engine ?? undefined}>
                        {engine ?? (tk.status === 'processing' ? '…' : '—')}
                      </td>
                      <td className="py-3 max-w-[14rem]">
                        {audioPath ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400" title={audioPath}>
                            ▶ cached
                          </span>
                        ) : synthCmd && tk.status === 'processing' ? (
                          <span className="text-[10px] font-mono text-slate-500 truncate block" title={synthCmd}>
                            {synthCmd.slice(0, 48)}{synthCmd.length > 48 ? '…' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`py-3 font-bold uppercase text-[10px] ${statusColor(tk.status)}`}>{tk.status}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full transition-all ${tk.status === 'failed' ? 'bg-rose-500' : tk.status === 'completed' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 w-9 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-slate-500 text-[10px]">
                        {tk.created_at ? new Date(tk.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedId && (
        <PcLocalTaskDetailModal
          task={taskDetail}
          remoteTask={remoteDetail}
          remoteError={remoteError}
          laravelReachable={laravelReachable}
          loading={detailLoading}
          remoteLoading={remoteLoading}
          onClose={closeTaskDetail}
        />
      )}
    </div>
  );
};

export default PcTaskQueuePanel;
