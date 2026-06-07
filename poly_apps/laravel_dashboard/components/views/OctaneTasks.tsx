import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../../types';
import { api } from '../../core/api';
import { TRANSLATIONS } from '../../constants';
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
  Loader2
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface OctaneTasksProps {
  lang?: Language;
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

const OctaneTasks: React.FC<OctaneTasksProps> = ({ lang = 'en' }) => {
  const [octaneStatus, setOctaneStatus] = useState<OctaneStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'running' | 'error' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskStatus | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskStatus | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const t = TRANSLATIONS[lang].octane;

  // StrictMode-safe initial-load guard. React 18 StrictMode invokes mount
  // effects twice in development; without this ref the initial
  // /octane-tasks/status request would fire twice on every mount. Guarding
  // here (instead of in loadOctaneStatus) keeps the manual Refresh button and
  // the auto-refresh interval able to call loadOctaneStatus() freely.
  const didInitialLoadRef = useRef(false);

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    loadOctaneStatus();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadOctaneStatus();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const loadOctaneStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.serverManager.getOctaneTasksStatus();
      if (response.success && response.data) {
        setOctaneStatus(response.data);
      } else {
        const anyResp = response as any;
        let msg = response.error || 'Failed to load Octane status';
        if (anyResp.isTimeout) {
          msg = 'Request timed out — the Octane server did not respond in time.';
        } else if (anyResp.isNetworkError) {
          msg = 'Network unreachable — is the Laravel Octane server running on this host?';
        }
        throw new Error(msg);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load Octane status:', err);
    } finally {
      setLoading(false);
    }
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

  const openTaskDetail = async (task: TaskStatus) => {
    setSelectedTask(task);
    setTaskDetail(null);
    setDetailLoading(true);
    try {
      const response = await api.serverManager.getOctaneTaskDetail(task.name);
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'running_with_errors':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      case 'waiting':
      case 'registered':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'disabled':
        return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
      case 'not_registered':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
    }
  };

  const formatUptime = (seconds: number | null): string => {
    if (seconds === null) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // Backend (OctaneTimerService) reports last_duration as a float in SECONDS
  // (microtime(true) delta), not milliseconds.
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return 'N/A';
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    return `${seconds.toFixed(2)}s`;
  };

  // Backend reports last_run_ago as an integer number of SECONDS since the
  // task last ran (or null if it has never run).
  const formatLastRunAgo = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return 'Never';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m ago`;
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

  if (error) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Octane Timer Tasks</h1>
          <button
            onClick={loadOctaneStatus}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
        <div className={`${commonClasses.card} p-6 flex items-center justify-center`}>
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-2 font-semibold">Failed to load Octane status</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Octane Timer Tasks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor and manage background timer tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <input
              type="checkbox"
              id="auto-refresh-octane"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            <label htmlFor="auto-refresh-octane" className="text-xs text-slate-600 dark:text-slate-400">
              Auto-refresh
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              disabled={!autoRefresh}
              className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            >
              <option value="3">3s</option>
              <option value="5">5s</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
            </select>
          </div>
          <button
            onClick={runVerify}
            disabled={verifying}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            title="Run backend initialization verification (/octane-tasks/verify)"
          >
            {verifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            Verify
          </button>
          <button
            onClick={loadOctaneStatus}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Verification Banner */}
      {verifyResult && (
        <div
          className={`mb-4 rounded-lg border p-4 ${
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
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : octaneStatus ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-4">
            {/* Timer Status */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                {octaneStatus.summary.timer_running ? (
                  <Zap className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <div className="text-xs text-slate-600 dark:text-slate-400">Timer</div>
              </div>
              <div className={`text-lg font-bold ${octaneStatus.summary.timer_running ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {octaneStatus.summary.timer_running ? 'Running' : 'Stopped'}
              </div>
            </div>

            {/* Discovered */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-blue-500" />
                <div className="text-xs text-slate-600 dark:text-slate-400">Discovered</div>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {octaneStatus.summary.total_discovered}
              </div>
            </div>

            {/* Registered */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                <div className="text-xs text-slate-600 dark:text-slate-400">Registered</div>
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {octaneStatus.summary.total_registered}
              </div>
            </div>

            {/* Running */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <PlayCircle className="w-5 h-5 text-green-500" />
                <div className="text-xs text-slate-600 dark:text-slate-400">Running</div>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {octaneStatus.summary.total_running}
              </div>
            </div>

            {/* Total Ticks */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <div className="text-xs text-slate-600 dark:text-slate-400">Total Ticks</div>
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {octaneStatus.summary.total_ticks.toLocaleString()}
              </div>
            </div>

            {/* Uptime */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-cyan-500" />
                <div className="text-xs text-slate-600 dark:text-slate-400">Uptime</div>
              </div>
              <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                {formatUptime(octaneStatus.summary.timer_uptime)}
              </div>
            </div>

            {/* Heartbeat */}
            <div className={`${commonClasses.card} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <div className="text-xs text-slate-600 dark:text-slate-400">Heartbeat</div>
              </div>
              <div className={`text-lg font-bold ${octaneStatus.heartbeat.is_fresh ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {octaneStatus.heartbeat.status || 'Unknown'}
              </div>
              {octaneStatus.heartbeat.seconds_ago !== undefined && (
                <div className="text-xs text-slate-500 mt-1">
                  {octaneStatus.heartbeat.seconds_ago}s ago
                </div>
              )}
            </div>
          </div>

          {/* Filter + Search */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
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
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {getFilteredTasks().length} / {octaneStatus.tasks.length} tasks
            </span>
          </div>

          {/* Tasks List */}
          <div className="flex-1 overflow-auto">
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
                    {getFilteredTasks().map((task) => (
                      <tr
                        key={task.name}
                        onClick={() => openTaskDetail(task)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task.status)}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                              {task.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{task.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {task.enabled && (
                              <span className="px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Enabled
                              </span>
                            )}
                            {task.registered && (
                              <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                Registered
                              </span>
                            )}
                            {task.running && (
                              <span className="px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                Running
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">
                          {task.class}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 font-mono">
                            {task.interval}s
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-mono">
                          {task.runtime?.run_count || 0}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {task.runtime && task.runtime.error_count > 0 ? (
                            <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-mono">
                              {task.runtime.error_count}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {formatLastRunAgo(task.runtime?.last_run_ago)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-mono text-slate-600 dark:text-slate-400">
                          {formatDuration(task.runtime?.last_duration || null)}
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
          </div>

          {/* Task Detail Modal */}
          {selectedTask && (() => {
            const detail = taskDetail || selectedTask;
            return (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
                      <h3 className="text-xl font-bold mb-1">{detail.name}</h3>
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
                        <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(detail.status)}`}>
                          {detail.status}
                        </span>
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
            );
          })()}
        </>
      ) : null}

      {/* Last Updated */}
      {octaneStatus && (
        <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Last updated: {octaneStatus.timestamp}
        </div>
      )}
    </div>
  );
};

export default OctaneTasks;
