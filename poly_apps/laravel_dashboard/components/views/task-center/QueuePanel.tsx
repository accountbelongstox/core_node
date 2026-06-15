/**
 * Task Center — QUEUE tab (global_tasks distributed work queue).
 *
 * Full port of the queue half of the former components/views/GlobalTasks.tsx
 * as a tab panel: 8 status stat cards, status filter chips, text filter, task
 * table with progress bars + cancel buttons, detail modal with payload /
 * priority / retries / timestamps. The workers half lives in WorkersPanel.
 *
 * Shares the 'laravel.global-tasks' persistent task key (same snapshot shape,
 * see shared.tsx GlobalTasksSnapshot) with WorkersPanel so switching between
 * the two tabs stays warm. Header refresh controls arrive from TaskCenter as
 * props.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../../../types';
import { api } from '../../../core/api';
import type {
  GlobalTaskItem,
  GlobalTaskDetail,
} from '../../../core/api/modules/ServerManagerAPI';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import { TRANSLATIONS } from '../../../constants';
import {
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Info,
  Layers,
  ListChecks,
  Ban,
  PlayCircle,
  UserCheck,
  FlaskConical,
} from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import Portal from '../../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';
import {
  StatCard,
  StatusBadge,
  ProgressBar,
  QUEUE_TASK_STATUSES,
  CANCELLABLE_STATUSES,
  formatDateTime,
  formatResultPreview,
  shortId,
  type GlobalTasksSnapshot,
} from './shared';

interface QueuePanelProps {
  lang: Language;
  autoRefresh: boolean;
  refreshIntervalSec: number;
  /** Bumped by TaskCenter's manual-refresh button → one immediate fetch. */
  refreshToken: number;
}

type TaskStatusFilter = 'all' | (typeof QUEUE_TASK_STATUSES)[number];

const QueuePanel: React.FC<QueuePanelProps> = ({
  lang,
  autoRefresh,
  refreshIntervalSec,
  refreshToken,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<GlobalTaskItem | null>(null);
  const [taskDetail, setTaskDetail] = useState<GlobalTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const t = TRANSLATIONS[lang].globalTasks;

  // The poll closure must always see the CURRENT status filter (the persistent
  // session in the provider keeps calling the registered poll), so read it
  // through a ref instead of capturing a stale value.
  const statusFilterRef = useRef<TaskStatusFilter>(statusFilter);
  statusFilterRef.current = statusFilter;

  // One snapshot poll = 4 parallel requests. The TASK LIST is the gating call
  // (the table is the tab's core); stats/workers degrade gracefully to null /
  // empty so a partial backend still renders. No try/catch — `.catch`.
  const fetchSnapshot = (): Promise<GlobalTasksSnapshot | null> => {
    const filter = statusFilterRef.current;
    const listParams: { limit: number; status?: string } = { limit: 100 };
    if (filter !== 'all') listParams.status = filter;

    return Promise.all([
      api.serverManager.getGlobalTaskStats(),
      api.serverManager.getGlobalTaskList(listParams),
      api.serverManager.getWorkerList(),
      api.serverManager.getWorkerStats(),
    ])
      .then(([statsRes, listRes, workersRes, workerStatsRes]) => {
        if (!listRes.success || !listRes.data) {
          let msg = listRes.error || t.load_failed;
          if ((listRes as any).isTimeout) {
            msg = t.timeout_hint;
          } else if ((listRes as any).isNetworkError) {
            msg = t.network_hint;
          }
          setError(msg);
          setLoading(false);
          return null; // settle (keep last snapshot); error banner shows the reason
        }
        setError(null);
        setLoading(false);
        return {
          stats: statsRes.success && statsRes.data ? statsRes.data.stats : null,
          tasks: Array.isArray(listRes.data.tasks) ? listRes.data.tasks : [],
          totalTasks: listRes.data.total ?? 0,
          workers:
            workersRes.success && workersRes.data && Array.isArray(workersRes.data.workers)
              ? workersRes.data.workers
              : [],
          workerStats:
            workerStatsRes.success && workerStatsRes.data ? workerStatsRes.data.stats : null,
          timestamp: new Date().toLocaleString(),
        };
      })
      .catch((err: any) => {
        setError(err?.message || t.load_failed);
        setLoading(false);
        return null;
      });
  };

  const task = usePersistentTask<GlobalTasksSnapshot>('laravel.global-tasks', {
    intervalMs: refreshIntervalSec * 1000,
    poll: fetchSnapshot,
    reattach: fetchSnapshot,
  });
  const snapshot = task.data;

  // Initial load: one immediate fetch pushed into the shared session (idempotent
  // — if a session is already live from a prior visit/reload, reuse its data).
  useEffect(() => {
    if (snapshot) return;
    setLoading(true);
    setError(null);
    fetchSnapshot().then((s) => { if (s) task.set(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared header auto-refresh toggle drives the persistent poll loop on/off.
  // Changing the interval while running restarts the loop.
  useEffect(() => {
    if (autoRefresh) {
      if (task.running) task.end();
      task.begin();
    } else if (task.running) {
      task.end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshIntervalSec]);

  // Manual refresh from the shared header.
  useEffect(() => {
    if (refreshToken === 0) return;
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // Manual refresh = one immediate fetch pushed into the shared session.
  const loadSnapshot = () => {
    setLoading(true);
    setError(null);
    fetchSnapshot().then((s) => { if (s) task.set(s); });
  };

  // The list is server-filtered by status, so a filter change must refetch.
  useEffect(() => {
    if (!snapshot) return;
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCancelTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setCancellingId(taskId);
    setNotice(null);
    try {
      const response = await api.serverManager.cancelGlobalTask(taskId);
      if (response.success) {
        setNotice(`${t.cancelled_ok}: ${shortId(taskId)}`);
        const s = await fetchSnapshot();
        if (s) task.set(s);
      } else {
        setNotice(`${t.cancel_failed}: ${response.error || ''}`.trim());
      }
    } catch (err: any) {
      setNotice(`${t.cancel_failed}: ${err?.message || ''}`.trim());
    } finally {
      setCancellingId(null);
    }
  };

  const openTaskDetail = async (row: GlobalTaskItem) => {
    setSelectedTask(row);
    setTaskDetail(null);
    setDetailLoading(true);
    try {
      const response = await api.serverManager.getGlobalTaskDetail(row.task_id);
      if (response.success && response.data && response.data.task) {
        setTaskDetail(response.data.task);
      }
    } catch {
      // Fall back silently to the row snapshot already in selectedTask.
    } finally {
      setDetailLoading(false);
    }
  };

  const closeTaskDetail = () => {
    setSelectedTask(null);
    setTaskDetail(null);
    setDetailLoading(false);
  };

  const previewLabels = { no_result: t.detail.no_result, result_truncated: t.detail.result_truncated };

  const getFilteredTasks = (): GlobalTaskItem[] => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return snapshot.tasks;
    return snapshot.tasks.filter(
      (row) =>
        (row.app_name || '').toLowerCase().includes(q) ||
        (row.task_type || '').toLowerCase().includes(q)
    );
  };

  const statusFilterLabel = (s: TaskStatusFilter): string => {
    if (s === 'all') return 'All';
    return (t.stats as Record<string, string>)[s] || s;
  };

  if (error && !snapshot) {
    return (
      <div className={`${commonClasses.card} p-6 flex items-center justify-center`}>
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-2 font-semibold">{t.load_failed}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={loadSnapshot}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} inline-flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  const stats = snapshot?.stats;

  return (
    <div className="flex flex-col gap-4">
      {/* Transient error / action notice banners */}
      {error && snapshot && (
        <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border p-3 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-2 text-sm text-indigo-700 dark:text-indigo-300">
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            {notice}
          </span>
          <button
            onClick={() => setNotice(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors shrink-0"
            aria-label="Dismiss notice"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && !snapshot ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : snapshot ? (
        <>
          {/* Summary Cards — full 8-status vocabulary of global_tasks */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <StatCard
              icon={Layers}
              iconClass="text-purple-500"
              label={t.stats.total}
              value={stats ? stats.total : '—'}
              valueClass="text-purple-600 dark:text-purple-400"
            />
            <StatCard
              icon={Clock}
              iconClass="text-blue-500"
              label={t.stats.pending}
              value={stats ? stats.pending : '—'}
              valueClass="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={UserCheck}
              iconClass="text-indigo-500"
              label={t.stats.assigned}
              value={stats ? stats.assigned : '—'}
              valueClass="text-indigo-600 dark:text-indigo-400"
            />
            <StatCard
              icon={PlayCircle}
              iconClass="text-amber-500"
              label={t.stats.processing}
              value={stats ? stats.processing : '—'}
              valueClass="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={CheckCircle}
              iconClass="text-green-500"
              label={t.stats.completed}
              value={stats ? stats.completed : '—'}
              valueClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={FlaskConical}
              iconClass="text-teal-500"
              label={`${t.stats.completed} (${t.stats.completed_demo_suffix})`}
              value={stats ? stats.completed_demo : '—'}
              valueClass="text-teal-600 dark:text-teal-400"
            />
            <StatCard
              icon={XCircle}
              iconClass="text-red-500"
              label={t.stats.failed}
              value={stats ? stats.failed : '—'}
              valueClass="text-red-600 dark:text-red-400"
            />
            <StatCard
              icon={Ban}
              iconClass="text-slate-500"
              label={t.stats.cancelled}
              value={stats ? stats.cancelled : '—'}
              valueClass="text-slate-600 dark:text-slate-400"
            />
          </div>

          {/* Filter + Search */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t.filter}</span>
            <div className="flex flex-wrap gap-2">
              {(['all', ...QUEUE_TASK_STATUSES] as TaskStatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {statusFilterLabel(f)}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_placeholder}
                className="pl-9 pr-3 py-1.5 text-sm w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {getFilteredTasks().length} / {snapshot.totalTasks} {t.tasks_suffix}
            </span>
          </div>

          {/* Tasks Table */}
          <div className={`${commonClasses.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.task_id}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.app_name}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.task_type}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.execution_type}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.status}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.progress}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.assigned_to}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.created_at}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{t.columns.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {getFilteredTasks().map((row) => (
                    <tr
                      key={row.task_id}
                      onClick={() => openTaskDetail(row)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400" title={row.task_id}>
                        {shortId(row.task_id)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{row.app_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">{row.task_type}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 font-mono">
                          {row.execution_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} kind="queue" />
                      </td>
                      <td className="px-4 py-3"><ProgressBar progress={row.progress} status={row.status} /></td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400" title={row.assigned_to || undefined}>
                        {row.assigned_to ? shortId(row.assigned_to) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {CANCELLABLE_STATUSES.includes(row.status) && (
                          <button
                            onClick={(e) => handleCancelTask(e, row.task_id)}
                            disabled={cancellingId === row.task_id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                            title={t.cancel}
                          >
                            {cancellingId === row.task_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Ban className="w-3 h-3" />
                            )}
                            {t.cancel}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {getFilteredTasks().length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t.no_tasks}</p>
              </div>
            )}
          </div>

          {/* Task Detail Modal */}
          {selectedTask && (() => {
            const detail: GlobalTaskDetail = taskDetail || {
              ...selectedTask,
              result: null,
              error: null,
              updated_at: null,
            };
            return (
            <Portal>
            <div
              className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}
              onClick={closeTaskDetail}
            >
              <div
                className={`${commonClasses.card} max-w-2xl w-full max-h-[80vh] overflow-y-auto`}
                onClick={(e) => e.stopPropagation()}
              >
                {detailLoading && (
                  <div className="flex items-center gap-2 px-6 py-2 text-xs text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t.detail.loading}
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{t.detail.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-mono break-all">
                        {detail.task_id}
                      </p>
                      {taskDetail && !detailLoading && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                          <Info className="w-3 h-3" /> {t.detail.live}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={closeTaskDetail}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Status + Progress */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t.detail.status}</div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={detail.status} kind="queue" size="sm" />
                        <div className="flex-1"><ProgressBar progress={detail.progress} status={detail.status} /></div>
                      </div>
                    </div>

                    {/* Core fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.app_name}</div>
                        <div className="text-sm font-bold">{detail.app_name}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.task_type}</div>
                        <div className="text-sm font-bold font-mono">{detail.task_type}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.execution_type}</div>
                        <div className="text-sm font-bold font-mono">{detail.execution_type}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.assigned_to}</div>
                        <div className="text-sm font-bold font-mono break-all">{detail.assigned_to || '—'}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.created_at}</div>
                        <div className="text-sm font-medium">{formatDateTime(detail.created_at)}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.updated_at}</div>
                        <div className="text-sm font-medium">{formatDateTime(detail.updated_at)}</div>
                      </div>
                      {detail.priority !== undefined && (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.priority}</div>
                          <div className="text-sm font-bold">{detail.priority}</div>
                        </div>
                      )}
                      {detail.retry_count !== undefined && (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.retries}</div>
                          <div className="text-sm font-bold">
                            {detail.retry_count} / {detail.max_retries ?? '—'}
                            {detail.timeout_seconds ? ` · ${detail.timeout_seconds}s` : ''}
                          </div>
                        </div>
                      )}
                      {detail.completed_at && (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.completed_at}</div>
                          <div className="text-sm font-medium">{formatDateTime(detail.completed_at)}</div>
                        </div>
                      )}
                    </div>

                    {/* Payload (truncated like result) */}
                    {detail.payload !== undefined && detail.payload !== null && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t.detail.payload}</div>
                        <pre className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                          {formatResultPreview(detail.payload, previewLabels)}
                        </pre>
                      </div>
                    )}

                    {/* Error */}
                    {detail.error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">{t.detail.error}</div>
                        <div className="text-sm text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                          {detail.error}
                        </div>
                      </div>
                    )}

                    {/* Result (truncated) */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t.detail.result}</div>
                      <pre className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                        {formatResultPreview(detail.result, previewLabels)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </Portal>
            );
          })()}

          {/* Last Updated */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            {t.last_updated} {snapshot.timestamp}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default QueuePanel;
