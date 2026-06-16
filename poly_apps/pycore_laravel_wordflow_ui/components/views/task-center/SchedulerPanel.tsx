/**
 * Task Center — SCHEDULER tab (Octane timer layer).
 *
 * Full port of the former components/views/OctaneTasks.tsx as a tab panel:
 * summary cards, heartbeat status, filter chips, search, task table, detail
 * modal (Portal + OVERLAY_*), verify button — all behavior preserved. The
 * header refresh controls now live in TaskCenter and arrive as props
 * (autoRefresh / refreshIntervalSec / refreshToken).
 *
 * NEW vs the old view: rows whose task name has a queue_role in the aggregate
 * overview (passed down as prop) are annotated with the shared RoleBadge —
 * the visible join between the scheduler layer and the queue layer.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Language } from '../../../types';
import { api } from '../../../core/api';
import type {
  TaskCenterOverview,
  TaskCenterQueueRole,
} from '../../../core/api/modules/ServerManagerAPI';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import {
  Activity,
  Layers,
  PlayCircle,
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  PauseCircle,
  Settings,
  Zap,
  TrendingUp,
  AlertTriangle,
  Search,
  ShieldCheck,
  Info,
  Loader2,
} from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import Portal from '../../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';
import {
  StatCard,
  StatusBadge,
  RoleBadge,
  formatUptime,
  formatDuration,
  formatLastRunAgo,
} from './shared';

interface SchedulerPanelProps {
  lang: Language;
  autoRefresh: boolean;
  refreshIntervalSec: number;
  /** Bumped by TaskCenter's manual-refresh button → one immediate fetch. */
  refreshToken: number;
  /** Aggregate overview (for queue_role row annotation); may be null while loading. */
  overview: TaskCenterOverview | null;
}

interface TaskStatus {
  name: string;
  class: string;
  interval: number;
  enabled: boolean;
  registered: boolean;
  running: boolean;
  status: string;
  runtime?: {
    interval: number;
    run_count: number;
    error_count: number;
    last_run: number;
    last_run_ago: number | null;
    last_duration: number | null;
    last_error: string | null;
  };
}

interface VerifyResult {
  success: boolean;
  issues: string[];
  summary: {
    total_discovered: number;
    total_registered: number;
    total_running: number;
    timer_running: boolean;
    timer_uptime: number | null;
    total_ticks: number;
  };
  timestamp: string;
}

interface OctaneStatus {
  summary: {
    total_discovered: number;
    total_registered: number;
    total_running: number;
    timer_running: boolean;
    timer_uptime: number | null;
    total_ticks: number;
  };
  tasks: TaskStatus[];
  heartbeat: {
    exists: boolean;
    last_modified?: string;
    seconds_ago?: number;
    is_fresh?: boolean;
    status?: string;
    message?: string;
  };
  timestamp: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running':
    case 'running_with_errors':
      return <PlayCircle className="w-4 h-4 text-green-500" />;
    case 'waiting':
    case 'registered':
      return <Clock className="w-4 h-4 text-blue-500" />;
    case 'disabled':
      return <PauseCircle className="w-4 h-4 text-slate-400" />;
    case 'not_registered':
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Activity className="w-4 h-4 text-slate-400" />;
  }
};

const SchedulerPanel: React.FC<SchedulerPanelProps> = ({
  lang,
  autoRefresh,
  refreshIntervalSec,
  refreshToken,
  overview,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'running' | 'error' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskStatus | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskStatus | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  /** task name → queue role, joined from the aggregate overview. */
  const queueRoleByName = useMemo(() => {
    const map: Record<string, TaskCenterQueueRole> = {};
    overview?.scheduler.tasks.forEach((t) => {
      if (t.queue_role) map[t.name] = t.queue_role;
    });
    return map;
  }, [overview]);

  // Backed by the global task layer (`laravel.octane-tasks`): the polled
  // OctaneStatus snapshot + its poll loop live in <TaskPersistenceProvider>
  // above the router, so they survive leaving and returning to this tab and a
  // full reload re-polls. Loading/error are panel-local UI; the poll fn mirrors
  // them through React state for the banner/spinner. No try/catch — `.catch`.
  const fetchOctaneStatus = (): Promise<OctaneStatus | null> =>
    api.serverManager.getOctaneTasksStatus()
      .then((response: any) => {
        if (response.success && response.data) {
          setError(null);
          setLoading(false);
          return response.data as OctaneStatus;
        }
        let msg = response.error || 'Failed to load Octane status';
        if (response.isTimeout) {
          msg = 'Request timed out — the Octane server did not respond in time.';
        } else if (response.isNetworkError) {
          msg = 'Network unreachable — is the Laravel Octane server running on this host?';
        }
        setError(msg);
        setLoading(false);
        return null; // settle (keep last snapshot); error banner shows the reason
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load Octane status');
        setLoading(false);
        return null;
      });

  const task = usePersistentTask<OctaneStatus>('laravel.octane-tasks', {
    intervalMs: refreshIntervalSec * 1000,
    poll: fetchOctaneStatus,
    reattach: fetchOctaneStatus,
  });
  const octaneStatus = task.data;

  // Initial load: one immediate fetch pushed into the shared session (idempotent
  // — if a session is already live from a prior visit/reload, reuse its data).
  useEffect(() => {
    if (octaneStatus) return;
    setLoading(true);
    setError(null);
    fetchOctaneStatus().then((s) => { if (s) task.set(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The shared header auto-refresh toggle drives the persistent poll loop
  // on/off. Changing the interval while running restarts the loop so the new
  // cadence takes effect.
  useEffect(() => {
    if (autoRefresh) {
      if (task.running) task.end();
      task.begin();
    } else if (task.running) {
      task.end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshIntervalSec]);

  // Manual refresh from the shared header = one immediate fetch pushed into
  // the shared session.
  useEffect(() => {
    if (refreshToken === 0) return;
    setLoading(true);
    setError(null);
    fetchOctaneStatus().then((s) => { if (s) task.set(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const loadOctaneStatus = () => {
    setLoading(true);
    setError(null);
    fetchOctaneStatus().then((s) => { if (s) task.set(s); });
  };

  const runVerify = async () => {
    setVerifying(true);
    try {
      const response = await api.serverManager.verifyOctaneTasksInit();
      if (response.success && response.data) {
        setVerifyResult(response.data);
      } else {
        setVerifyResult({
          success: false,
          issues: [response.error || 'Verification request failed'],
          summary: {
            total_discovered: 0,
            total_registered: 0,
            total_running: 0,
            timer_running: false,
            timer_uptime: null,
            total_ticks: 0,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setVerifyResult({
        success: false,
        issues: [err.message || 'Verification request failed'],
        summary: {
          total_discovered: 0,
          total_registered: 0,
          total_running: 0,
          timer_running: false,
          timer_uptime: null,
          total_ticks: 0,
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setVerifying(false);
    }
  };

  const openTaskDetail = async (row: TaskStatus) => {
    setSelectedTask(row);
    setTaskDetail(null);
    setDetailLoading(true);
    try {
      const response = await api.serverManager.getOctaneTaskDetail(row.name);
      if (response.success && response.data) {
        setTaskDetail(response.data as TaskStatus);
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

  const getFilteredTasks = (): TaskStatus[] => {
    if (!octaneStatus) return [];

    let tasks: TaskStatus[];
    switch (filter) {
      case 'enabled':
        tasks = octaneStatus.tasks.filter(t => t.enabled);
        break;
      case 'running':
        tasks = octaneStatus.tasks.filter(t => t.running);
        break;
      case 'error':
        tasks = octaneStatus.tasks.filter(t => t.status === 'error' || t.status === 'running_with_errors');
        break;
      case 'disabled':
        tasks = octaneStatus.tasks.filter(t => !t.enabled);
        break;
      default:
        tasks = octaneStatus.tasks;
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      tasks = tasks.filter(
        t => t.name.toLowerCase().includes(q) || t.class.toLowerCase().includes(q)
      );
    }
    return tasks;
  };

  if (error && !octaneStatus) {
    return (
      <div className={`${commonClasses.card} p-6 flex items-center justify-center`}>
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-2 font-semibold">Failed to load Octane status</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={loadOctaneStatus}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} inline-flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Transient error banner (keep last snapshot visible) */}
      {error && octaneStatus && (
        <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Verification Banner */}
      {verifyResult && (
        <div
          className={`rounded-lg border p-4 ${
            verifyResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {verifyResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              )}
              <div>
                <div
                  className={`font-semibold ${
                    verifyResult.success
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {verifyResult.success
                    ? 'All Octane timer tasks are properly initialized'
                    : `Verification found ${verifyResult.issues.length} issue${verifyResult.issues.length === 1 ? '' : 's'}`}
                </div>
                {!verifyResult.success && (
                  <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                    {verifyResult.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Verified at {verifyResult.timestamp}
                </div>
              </div>
            </div>
            <button
              onClick={() => setVerifyResult(null)}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors shrink-0"
              aria-label="Dismiss verification result"
            >
              <XCircle className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      {loading && !octaneStatus ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : octaneStatus ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatCard
              icon={octaneStatus.summary.timer_running ? Zap : AlertTriangle}
              iconClass={octaneStatus.summary.timer_running ? 'text-green-500' : 'text-red-500'}
              label="Timer"
              value={octaneStatus.summary.timer_running ? 'Running' : 'Stopped'}
              valueClass={`!text-lg ${octaneStatus.summary.timer_running ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            />
            <StatCard
              icon={Layers}
              iconClass="text-blue-500"
              label="Discovered"
              value={octaneStatus.summary.total_discovered}
              valueClass="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={Settings}
              iconClass="text-indigo-500"
              label="Registered"
              value={octaneStatus.summary.total_registered}
              valueClass="text-indigo-600 dark:text-indigo-400"
            />
            <StatCard
              icon={PlayCircle}
              iconClass="text-green-500"
              label="Running"
              value={octaneStatus.summary.total_running}
              valueClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={TrendingUp}
              iconClass="text-purple-500"
              label="Total Ticks"
              value={octaneStatus.summary.total_ticks.toLocaleString()}
              valueClass="text-purple-600 dark:text-purple-400"
            />
            <StatCard
              icon={Clock}
              iconClass="text-cyan-500"
              label="Uptime"
              value={formatUptime(octaneStatus.summary.timer_uptime)}
              valueClass="!text-sm text-cyan-600 dark:text-cyan-400"
            />
            <StatCard
              icon={Activity}
              iconClass="text-emerald-500"
              label="Heartbeat"
              value={octaneStatus.heartbeat.status || 'Unknown'}
              valueClass={`!text-lg ${octaneStatus.heartbeat.is_fresh ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              sub={
                octaneStatus.heartbeat.seconds_ago !== undefined ? (
                  <span className="text-slate-500">{octaneStatus.heartbeat.seconds_ago}s ago</span>
                ) : undefined
              }
            />
          </div>

          {/* Filter + Search + Verify */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">Filter:</span>
            <div className="flex gap-2">
              {['all', 'enabled', 'running', 'error', 'disabled'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or class..."
                className="pl-9 pr-3 py-1.5 text-sm w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={runVerify}
              disabled={verifying}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} !px-3 !py-1.5 text-sm flex items-center gap-2`}
              title="Run backend initialization verification (/octane-tasks/verify)"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Verify
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {getFilteredTasks().length} / {octaneStatus.tasks.length} tasks
            </span>
          </div>

          {/* Tasks List */}
          <div className={`${commonClasses.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Task Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Class</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Interval</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Runs</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Errors</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Last Run</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {getFilteredTasks().map((row) => (
                    <tr
                      key={row.name}
                      onClick={() => openTaskDetail(row)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(row.status)}
                          <StatusBadge status={row.status} kind="scheduler" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{row.name}</span>
                          {queueRoleByName[row.name] && (
                            <RoleBadge role={queueRoleByName[row.name]} lang={lang} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {row.enabled && (
                            <span className="px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              Enabled
                            </span>
                          )}
                          {row.registered && (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                              Registered
                            </span>
                          )}
                          {row.running && (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                              Running
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">
                        {row.class}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 font-mono">
                          {row.interval}s
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-mono">
                        {row.runtime?.run_count || 0}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {row.runtime && row.runtime.error_count > 0 ? (
                          <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-mono">
                            {row.runtime.error_count}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {formatLastRunAgo(row.runtime?.last_run_ago)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-mono text-slate-600 dark:text-slate-400">
                        {formatDuration(row.runtime?.last_duration ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {getFilteredTasks().length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No tasks found with current filter</p>
              </div>
            )}
          </div>

          {/* Task Detail Modal */}
          {selectedTask && (() => {
            const detail = taskDetail || selectedTask;
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
                    Loading live task detail…
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                        {detail.name}
                        {queueRoleByName[detail.name] && (
                          <RoleBadge role={queueRoleByName[detail.name]} lang={lang} />
                        )}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                        {detail.class}
                      </p>
                      {taskDetail && !detailLoading && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                          <Info className="w-3 h-3" /> Live data
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
                    {/* Status */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Status</div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(detail.status)}
                        <StatusBadge status={detail.status} kind="scheduler" size="sm" />
                      </div>
                    </div>

                    {/* Configuration */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Configuration</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Interval</div>
                          <div className="text-lg font-bold font-mono">{detail.interval}s</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Enabled</div>
                          <div className="text-lg font-bold">{detail.enabled ? 'Yes' : 'No'}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Registered</div>
                          <div className="text-lg font-bold">{detail.registered ? 'Yes' : 'No'}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Running</div>
                          <div className="text-lg font-bold">{detail.running ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Runtime Statistics */}
                    {detail.runtime && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Runtime Statistics</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Run Count</div>
                            <div className="text-2xl font-bold font-mono">{detail.runtime.run_count}</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Error Count</div>
                            <div className={`text-2xl font-bold font-mono ${detail.runtime.error_count > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                              {detail.runtime.error_count}
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Last Run</div>
                            <div className="text-sm font-medium">{formatLastRunAgo(detail.runtime.last_run_ago)}</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Last Duration</div>
                            <div className="text-sm font-medium font-mono">
                              {formatDuration(detail.runtime.last_duration)}
                            </div>
                          </div>
                        </div>

                        {detail.runtime.last_error && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Last Error</div>
                            <div className="text-sm text-red-700 dark:text-red-300 font-mono">
                              {detail.runtime.last_error}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </Portal>
            );
          })()}

          {/* Last Updated */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            Last updated: {octaneStatus.timestamp}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default SchedulerPanel;
