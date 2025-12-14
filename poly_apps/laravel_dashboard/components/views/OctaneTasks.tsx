
import React, { useState, useEffect } from 'react';
import { Language, AsyncState, OctaneTasksStatus, OctaneTask } from '../../types';
import { api } from '../../core/api';
import { TRANSLATIONS } from '../../constants';
import { 
  Timer, 
  Activity, 
  Layers, 
  PlayCircle, 
  Clock, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  PauseCircle,
  Settings
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface OctaneTasksProps {
  lang?: Language;
}

const OctaneTasks: React.FC<OctaneTasksProps> = ({ lang = 'en' }) => {
  const [status, setStatus] = useState<AsyncState<OctaneTasksStatus>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [tasks, setTasks] = useState<AsyncState<OctaneTask[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [filter, setFilter] = useState<'all' | 'idle' | 'running' | 'completed' | 'failed'>('all');

  const t = TRANSLATIONS[lang].octane;

  useEffect(() => {
    loadStatus();
    loadTasks();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadStatus();
      loadTasks();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const loadStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManager.getOctaneTasksStatus();
      if (response.success && response.data) {
        setStatus({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to load status');
      }
    } catch (error: any) {
      setStatus({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const loadTasks = async () => {
    setTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      // Note: This would need a new endpoint to get all tasks
      // For now, we'll use mock data structure
      setTasks({
        data: [],
        loading: false,
        error: null,
        status: 'success'
      });
    } catch (error: any) {
      setTasks({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const getStatusBadge = (taskStatus: string) => {
    const statusClasses = {
      idle: commonClasses.badgeInfo,
      running: commonClasses.badgeInfo,
      completed: commonClasses.badgeSuccess,
      failed: commonClasses.badgeError,
      disabled: commonClasses.badgeWarning
    };
    return statusClasses[taskStatus as keyof typeof statusClasses] || commonClasses.badge;
  };

  const filteredTasks = tasks.data?.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  }) || [];

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span>Auto Refresh</span>
            </label>
            <button
              onClick={() => {
                loadStatus();
                loadTasks();
              }}
              disabled={status.loading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
            >
              <RefreshCw className={`w-4 h-4 ${status.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Status Overview Cards */}
      {status.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className={`${commonClasses.card} p-4 ${
            status.data.timer_running ? 'border-l-4 border-emerald-500' : 'border-l-4 border-slate-300'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <Activity className={`w-6 h-6 ${
                status.data.timer_running ? 'text-emerald-500' : 'text-slate-400'
              }`} />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.timer_status}</p>
                <p className="text-lg font-bold">
                  {status.data.timer_running ? 'Running' : 'Stopped'}
                </p>
              </div>
            </div>
            {status.data.timer_running && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>Active</span>
              </div>
            )}
          </div>

          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-6 h-6 text-indigo-500" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.total_tasks}</p>
                <p className="text-lg font-bold">{status.data.total_tasks}</p>
              </div>
            </div>
          </div>

          <div className={`${commonClasses.card} p-4 border-l-4 border-blue-500`}>
            <div className="flex items-center gap-3 mb-2">
              <PlayCircle className="w-6 h-6 text-blue-500" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.running_tasks}</p>
                <p className="text-lg font-bold">{status.data.running_tasks}</p>
              </div>
            </div>
          </div>

          <div className={`${commonClasses.card} p-4 border-l-4 border-emerald-500`}>
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.completed_tasks}</p>
                <p className="text-lg font-bold">{formatNumber(status.data.completed_tasks)}</p>
              </div>
            </div>
          </div>

          <div className={`${commonClasses.card} p-4 border-l-4 border-red-500`}>
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.failed_tasks}</p>
                <p className="text-lg font-bold">{status.data.failed_tasks}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional Stats */}
      {status.data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-slate-400" />
              <p className="text-sm font-medium">Total Ticks</p>
            </div>
            <p className="text-2xl font-bold">{formatNumber(status.data.total_ticks)}</p>
          </div>

          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Timer className="w-5 h-5 text-slate-400" />
              <p className="text-sm font-medium">Uptime</p>
            </div>
            <p className="text-2xl font-bold">{formatDuration(status.data.uptime)}</p>
          </div>

          <div className={`${commonClasses.card} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-slate-400" />
              <p className="text-sm font-medium">Last Tick</p>
            </div>
            <p className="text-sm">
              {status.data.last_tick_at 
                ? new Date(status.data.last_tick_at).toLocaleString()
                : 'Never'}
            </p>
            {status.data.next_tick_at && (
              <p className="text-xs text-slate-500 mt-1">
                Next: {new Date(status.data.next_tick_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <div className="flex gap-2">
            {(['all', 'idle', 'running', 'completed', 'failed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  filter === f
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {tasks.loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}

        {tasks.error && (
          <div className={`${commonClasses.card} p-6 text-center`}>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 dark:text-red-400">{tasks.error}</p>
          </div>
        )}

        {tasks.data && filteredTasks.length === 0 && (
          <div className={`${commonClasses.card} p-12 text-center`}>
            <PauseCircle className="w-16 h-16 text-slate-400 mx-auto mb-4 opacity-50" />
            <p className="text-slate-500">No tasks found</p>
            <p className="text-sm text-slate-400 mt-2">
              {filter === 'all' 
                ? 'No tasks are configured yet'
                : `No ${filter} tasks found`}
            </p>
          </div>
        )}

        {tasks.data && filteredTasks.length > 0 && (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.name}
                className={`${commonClasses.card} p-4 ${commonClasses.cardHover}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{task.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(task.status)}`}>
                        {task.status}
                      </span>
                      {!task.enabled && (
                        <span className={`px-2 py-1 rounded text-xs ${commonClasses.badgeWarning}`}>
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mb-2">
                      {task.class}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Schedule: {task.schedule}</span>
                      </div>
                      {task.last_run_at && (
                        <div className="flex items-center gap-1">
                          <span>Last: {new Date(task.last_run_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Run Count</p>
                    <p className="text-sm font-semibold">{formatNumber(task.run_count)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Success Rate</p>
                    <p className="text-sm font-semibold">
                      {task.run_count > 0 
                        ? ((task.success_count / task.run_count) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Duration</p>
                    <p className="text-sm font-semibold">
                      {task.average_duration ? `${task.average_duration}ms` : 'N/A'}
                    </p>
                  </div>
                </div>

                {task.last_error && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    {task.last_error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OctaneTasks;
