/**
 * Task Center — SCHEDULER tab (Octane timer layer).
 *
 * Full port of the former components/views/OctaneTasks.tsx as a tab panel:
 * summary cards, heartbeat status, filter chips, search, task table, detail
 * modal (Portal + OVERLAY_*), verify button — all behavior preserved. The
 * header refresh controls live in TaskCenter and reach panels through
 * TaskCenterState (autoRefresh / refreshIntervalSec / refreshToken).
 *
 * NEW vs the old view: rows whose task name has a queue_role in the aggregate
 * overview (passed down as prop) are annotated with the shared RoleBadge —
 * the visible join between the scheduler layer and the queue layer.
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { api } from '@/apps/laravel-manager/api';
import type {
  TaskCenterQueueRole,
} from '@/apps/laravel-manager/api';
import { useTaskCenterState } from './TaskCenterState';
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
} from 'lucide-react';
import { commonClasses } from '@/shared/styles/theme';
import { AlertBox, EmptyState, InlineSpinner, LoadingBlock } from '../../common';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
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

const SCHEDULER_FILTER_LABEL_KEYS: Record<string, string> = {
  enabled: 'uiTask.scheduler.enabled',
  running: 'uiTask.scheduler.running',
  error: 'uiTask.scheduler.filter_error',
  disabled: 'uiTask.scheduler.filter_disabled',
};

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
}) => {
  const { t: tr } = useTranslation();
  const { octaneTasks: octaneStatus, overview, loading, error, refreshNow } = useTaskCenterState();
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

  const runVerify = async () => {
    setVerifying(true);
    try {
      const response = await api.serverManager.verifyOctaneTasksInit();
      if (response.success && response.data) {
        setVerifyResult(response.data);
      } else {
        setVerifyResult({
          success: false,
          issues: [response.error || tr('uiTask.scheduler.verify_failed')],
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
        issues: [err.message || tr('uiTask.scheduler.verify_failed')],
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
        tasks = octaneStatus.tasks.filter((t: TaskStatus) => t.enabled);
        break;
      case 'running':
        tasks = octaneStatus.tasks.filter((t: TaskStatus) => t.running);
        break;
      case 'error':
        tasks = octaneStatus.tasks.filter((t: TaskStatus) => t.status === 'error' || t.status === 'running_with_errors');
        break;
      case 'disabled':
        tasks = octaneStatus.tasks.filter((t: TaskStatus) => !t.enabled);
        break;
      default:
        tasks = octaneStatus.tasks;
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      tasks = tasks.filter(
        (t: TaskStatus) => t.name.toLowerCase().includes(q) || t.class.toLowerCase().includes(q)
      );
    }
    return tasks;
  };

  if (error && !octaneStatus) {
    return (
      <AlertBox variant="error" className="flex-col items-stretch text-center">
        <p className="font-semibold">{tr('uiTask.scheduler.load_failed')}</p>
        <p className="text-xs opacity-80 mt-1">{error}</p>
        <button
          onClick={refreshNow}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} inline-flex items-center gap-2 mx-auto mt-3`}
        >
          <RefreshCw className="w-4 h-4" />
          {tr('taskCenter.retry')}
        </button>
      </AlertBox>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Transient error banner (keep last snapshot visible) */}
      {error && octaneStatus && <AlertBox variant="error">{error}</AlertBox>}

      {/* Verification Banner */}
      {verifyResult && (
        <AlertBox variant={verifyResult.success ? 'success' : 'error'} icon={false} className="p-4">
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex items-start gap-3">
              {verifyResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              )}
              <div>
                <div
                  className={`font-semibold ${verifyResult.success
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                    }`}
                >
                  {verifyResult.success
                    ? tr('uiTask.scheduler.verify_ok')
                    : tr(
                        verifyResult.issues.length === 1
                          ? 'uiTask.scheduler.verify_issue_one'
                          : 'uiTask.scheduler.verify_issue_many',
                        { count: verifyResult.issues.length },
                      )}
                </div>
                {!verifyResult.success && (
                  <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                    {verifyResult.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {tr('uiTask.scheduler.verified_at', { time: verifyResult.timestamp })}
                </div>
              </div>
            </div>
            <button
              onClick={() => setVerifyResult(null)}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors shrink-0"
              aria-label={tr('uiTask.scheduler.dismiss_verify')}
            >
              <XCircle className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </AlertBox>
      )}

      {loading && !octaneStatus ? (
        <LoadingBlock label="" className="py-16" />
      ) : octaneStatus ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatCard
              icon={octaneStatus.summary.timer_running ? Zap : AlertTriangle}
              iconClass={octaneStatus.summary.timer_running ? 'text-green-500' : 'text-red-500'}
              label={tr('uiTask.scheduler.timer')}
              value={octaneStatus.summary.timer_running ? tr('uiTask.scheduler.running') : tr('uiTask.scheduler.stopped')}
              valueClass={`!text-lg ${octaneStatus.summary.timer_running ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            />
            <StatCard
              icon={Layers}
              iconClass="text-blue-500"
              label={tr('uiTask.scheduler.discovered')}
              value={octaneStatus.summary.total_discovered}
              valueClass="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={Settings}
              iconClass="text-indigo-500"
              label={tr('uiTask.scheduler.registered')}
              value={octaneStatus.summary.total_registered}
              valueClass="text-indigo-600 dark:text-indigo-400"
            />
            <StatCard
              icon={PlayCircle}
              iconClass="text-green-500"
              label={tr('uiTask.scheduler.running')}
              value={octaneStatus.summary.total_running}
              valueClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={TrendingUp}
              iconClass="text-purple-500"
              label={tr('uiTask.scheduler.total_ticks')}
              value={octaneStatus.summary.total_ticks.toLocaleString()}
              valueClass="text-purple-600 dark:text-purple-400"
            />
            <StatCard
              icon={Clock}
              iconClass="text-cyan-500"
              label={tr('uiTask.scheduler.uptime')}
              value={formatUptime(octaneStatus.summary.timer_uptime)}
              valueClass="!text-sm text-cyan-600 dark:text-cyan-400"
            />
            <StatCard
              icon={Activity}
              iconClass="text-emerald-500"
              label={tr('uiTask.scheduler.heartbeat')}
              value={octaneStatus.heartbeat.status || tr('uiTask.shared.unknown')}
              valueClass={`!text-lg ${octaneStatus.heartbeat.is_fresh ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              sub={
                octaneStatus.heartbeat.seconds_ago !== undefined ? (
                  <span className="text-slate-500">{tr('uiTask.shared.ago_s', { s: octaneStatus.heartbeat.seconds_ago })}</span>
                ) : undefined
              }
            />
          </div>

          {/* Filter + Search + Verify */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">{tr('globalTasks.filter')}</span>
            <div className="flex gap-2">
              {['all', 'enabled', 'running', 'error', 'disabled'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                >
                  {f === 'all' ? tr('mcp.common.all') : tr(SCHEDULER_FILTER_LABEL_KEYS[f])}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('uiTask.scheduler.search_placeholder')}
                className="pl-9 pr-3 py-1.5 text-sm w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={runVerify}
              disabled={verifying}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} !px-3 !py-1.5 text-sm flex items-center gap-2`}
              title={tr('uiTask.scheduler.verify_title')}
            >
              {verifying ? <InlineSpinner /> : <ShieldCheck className="w-4 h-4" />}
              {tr('uiTask.scheduler.verify')}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {tr('uiTask.scheduler.tasks_count', { shown: getFilteredTasks().length, total: octaneStatus.tasks.length })}
            </span>
          </div>

          {/* Tasks List */}
          <div className={`${commonClasses.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('globalTasks.columns.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.col_task_name')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.col_class')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.col_interval')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.col_runs')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.col_errors')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.col_last_run')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.col_duration')}</th>
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
                              {tr('uiTask.scheduler.enabled')}
                            </span>
                          )}
                          {row.registered && (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                              {tr('uiTask.scheduler.registered')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 break-all">
                          {row.class}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-mono">
                        {row.interval}ms
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-mono text-slate-600 dark:text-slate-400">
                        {row.runtime?.run_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {row.runtime?.error_count ? (
                          <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-mono">
                            {row.runtime.error_count}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          {formatLastRunAgo(row.runtime?.last_run_ago)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-mono text-slate-600 dark:text-slate-400">
                        {formatDuration(row.runtime?.last_duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {octaneStatus.tasks.length === 0 && (
              <EmptyState icon={Layers} message={tr('uiTask.scheduler.empty')} className="py-8" />
            )}
          </div>

          {/* Last Updated */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            {tr('taskCenter.last_updated')} {octaneStatus.timestamp}
          </div>
        </>
      ) : null}

      {/* Task Detail Modal */}
      {selectedTask && (
        <Portal>
          <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
            <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={closeTaskDetail} />
            <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedTask.status)}
                  <h3 className="text-lg font-semibold">{selectedTask.name}</h3>
                  <StatusBadge status={selectedTask.status} kind="scheduler" />
                </div>
                <button
                  onClick={closeTaskDetail}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tr('uiTask.scheduler.col_class')}</div>
                      <div className="text-sm font-mono break-all">{selectedTask.class}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tr('uiTask.scheduler.col_interval')}</div>
                      <div className="text-sm font-mono">{selectedTask.interval}ms</div>
                    </div>
                  </div>

                  {/* Runtime Stats */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      {tr('uiTask.scheduler.runtime_stats')}
                    </h4>
                    {detailLoading ? (
                      <div className="py-8 flex justify-center">
                        <InlineSpinner />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{tr('uiTask.scheduler.col_runs')}</div>
                          <div className="text-lg font-mono">{taskDetail?.runtime?.run_count ?? selectedTask.runtime?.run_count ?? 0}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{tr('uiTask.scheduler.col_errors')}</div>
                          <div className={`text-lg font-mono ${(taskDetail?.runtime?.error_count ?? selectedTask.runtime?.error_count ?? 0) > 0 ? 'text-red-500' : ''}`}>
                            {taskDetail?.runtime?.error_count ?? selectedTask.runtime?.error_count ?? 0}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{tr('uiTask.scheduler.col_last_run')}</div>
                          <div className="text-sm mt-1">{formatLastRunAgo(taskDetail?.runtime?.last_run_ago ?? selectedTask.runtime?.last_run_ago)}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{tr('uiTask.scheduler.col_duration')}</div>
                          <div className="text-sm font-mono mt-1">{formatDuration(taskDetail?.runtime?.last_duration ?? selectedTask.runtime?.last_duration)}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Last Error */}
                  {(taskDetail?.runtime?.last_error || selectedTask.runtime?.last_error) && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-500">
                        <AlertTriangle className="w-4 h-4" />
                        {tr('uiTask.scheduler.last_error')}
                      </h4>
                      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-sm font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                        {taskDetail?.runtime?.last_error || selectedTask.runtime?.last_error}
                      </div>
                    </div>
                  )}

                  {/* Config State */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-500" />
                      {tr('uiTask.scheduler.config_state')}
                    </h4>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        {selectedTask.enabled ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-sm text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.enabled')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedTask.registered ? (
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-sm text-slate-600 dark:text-slate-400">{tr('uiTask.scheduler.registered')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

export default SchedulerPanel;
