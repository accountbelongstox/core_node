/**
 * Task Center — WORKERS tab (distributed worker nodes).
 *
 * The workers half of the former components/views/GlobalTasks.tsx, promoted
 * to its own tab: worker stat cards (from /api/worker/stats) + the workers
 * table, PLUS a "role hint" line under known workers so the operator can see
 * which physical end each node is:
 *   - worker_id starting 'pycore-translate' → pycore Google Translate worker
 *   - worker_id starting 'laravel-internal-ai' → AI self-filler (timer-driven)
 *   - anything else → generic external worker
 *
 * Shares the 'laravel.global-tasks' persistent key/snapshot with QueuePanel
 * (see shared.tsx GlobalTasksSnapshot) so tab switches stay warm.
 */
import React, { useState, useEffect } from 'react';
import { Language } from '../../../types';
import { api } from '../../../core/api';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import { TRANSLATIONS } from '../../../constants';
import {
  Activity,
  RefreshCw,
  XCircle,
  AlertCircle,
  Users,
  Server,
  Cpu,
  CheckCircle,
  Wifi,
  WifiOff,
  Loader2,
  Bot,
  Languages,
} from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import {
  StatCard,
  StatusBadge,
  formatRelativeTime,
  shortId,
  type GlobalTasksSnapshot,
} from './shared';

interface WorkersPanelProps {
  lang: Language;
  autoRefresh: boolean;
  refreshIntervalSec: number;
  /** Bumped by TaskCenter's manual-refresh button → one immediate fetch. */
  refreshToken: number;
}

/** Known worker-id prefixes → role hint i18n key + icon. */
const roleHintFor = (workerId: string): { key: 'pycore_translate' | 'internal_ai' | 'generic'; icon: React.ReactNode } => {
  if (workerId.startsWith('pycore-translate')) {
    return { key: 'pycore_translate', icon: <Languages className="w-3 h-3" /> };
  }
  if (workerId.startsWith('laravel-internal-ai')) {
    return { key: 'internal_ai', icon: <Bot className="w-3 h-3" /> };
  }
  return { key: 'generic', icon: <Server className="w-3 h-3" /> };
};

const WorkersPanel: React.FC<WorkersPanelProps> = ({
  lang,
  autoRefresh,
  refreshIntervalSec,
  refreshToken,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = TRANSLATIONS[lang].globalTasks;
  const tc = TRANSLATIONS[lang].taskCenter.workers_panel;

  // Same merged snapshot poll as QueuePanel (the two tabs share the session) —
  // here the WORKER LIST is the gating call; the task list degrades to empty.
  const fetchSnapshot = (): Promise<GlobalTasksSnapshot | null> =>
    Promise.all([
      api.serverManager.getGlobalTaskStats(),
      api.serverManager.getGlobalTaskList({ limit: 100 }),
      api.serverManager.getWorkerList(),
      api.serverManager.getWorkerStats(),
    ])
      .then(([statsRes, listRes, workersRes, workerStatsRes]) => {
        if (!workersRes.success || !workersRes.data) {
          let msg = workersRes.error || t.load_failed;
          if ((workersRes as any).isTimeout) {
            msg = t.timeout_hint;
          } else if ((workersRes as any).isNetworkError) {
            msg = t.network_hint;
          }
          setError(msg);
          setLoading(false);
          return null; // settle (keep last snapshot)
        }
        setError(null);
        setLoading(false);
        return {
          stats: statsRes.success && statsRes.data ? statsRes.data.stats : null,
          tasks:
            listRes.success && listRes.data && Array.isArray(listRes.data.tasks)
              ? listRes.data.tasks
              : [],
          totalTasks: listRes.success && listRes.data ? (listRes.data.total ?? 0) : 0,
          workers: Array.isArray(workersRes.data.workers) ? workersRes.data.workers : [],
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

  const task = usePersistentTask<GlobalTasksSnapshot>('laravel.global-tasks', {
    intervalMs: refreshIntervalSec * 1000,
    poll: fetchSnapshot,
    reattach: fetchSnapshot,
  });
  const snapshot = task.data;

  // Initial load (idempotent — reuse a live session's data when present).
  useEffect(() => {
    if (snapshot) return;
    setLoading(true);
    setError(null);
    fetchSnapshot().then((s) => { if (s) task.set(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared header auto-refresh toggle drives the persistent poll loop on/off.
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

  const loadSnapshot = () => {
    setLoading(true);
    setError(null);
    fetchSnapshot().then((s) => { if (s) task.set(s); });
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

  const workerStats = snapshot?.workerStats;
  const relativeLabels = { never: t.never, just_now: t.just_now };

  return (
    <div className="flex flex-col gap-4">
      {error && snapshot && (
        <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !snapshot ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : snapshot ? (
        <>
          {/* Worker stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              icon={Users}
              iconClass="text-cyan-500"
              label={tc.stats.total}
              value={workerStats ? workerStats.total : '—'}
              valueClass="text-cyan-600 dark:text-cyan-400"
            />
            <StatCard
              icon={Wifi}
              iconClass="text-green-500"
              label={tc.stats.online}
              value={workerStats ? workerStats.online : '—'}
              valueClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={Loader2}
              iconClass="text-amber-500"
              label={tc.stats.busy}
              value={workerStats ? workerStats.busy : '—'}
              valueClass="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={WifiOff}
              iconClass="text-slate-500"
              label={tc.stats.offline}
              value={workerStats ? workerStats.offline : '—'}
              valueClass="text-slate-600 dark:text-slate-400"
            />
            <StatCard
              icon={CheckCircle}
              iconClass="text-green-500"
              label={tc.stats.total_completed}
              value={workerStats ? workerStats.total_completed : '—'}
              valueClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={XCircle}
              iconClass="text-red-500"
              label={tc.stats.total_failed}
              value={workerStats ? workerStats.total_failed : '—'}
              valueClass="text-red-600 dark:text-red-400"
            />
          </div>

          {/* Workers table */}
          <div className={`${commonClasses.card} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-500" />
              <h2 className="text-sm font-semibold">{t.workers.title}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">({snapshot.workers.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.workers.columns.worker}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.workers.columns.status}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.workers.columns.processors}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{t.workers.columns.completed}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{t.workers.columns.failed}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.workers.columns.current_task}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">{t.workers.columns.last_heartbeat}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {snapshot.workers.map((worker) => {
                    const hint = roleHintFor(worker.worker_id);
                    return (
                      <tr key={worker.worker_id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{worker.worker_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono" title={worker.worker_id}>
                            {shortId(worker.worker_id)}
                            {worker.hostname ? ` · ${worker.hostname}` : ''}
                            {worker.platform ? ` · ${worker.platform}` : ''}
                          </div>
                          {/* Role hint: which physical end this node is */}
                          <div
                            className={`mt-1 inline-flex items-center gap-1.5 text-xs ${
                              hint.key === 'generic'
                                ? 'text-slate-400 dark:text-slate-500'
                                : 'text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            {hint.icon}
                            {(tc.role_hints as Record<string, string>)[hint.key]}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={worker.status} kind="worker" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(worker.processor_types || []).map((pt) => (
                              <span
                                key={pt}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 font-mono"
                              >
                                <Cpu className="w-3 h-3" />
                                {pt}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-mono text-green-600 dark:text-green-400">
                          {worker.completed_tasks}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {worker.failed_tasks > 0 ? (
                            <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-mono">
                              {worker.failed_tasks}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400" title={worker.current_task_id || undefined}>
                          {worker.current_task_id ? shortId(worker.current_task_id) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400" title={worker.last_heartbeat_at || undefined}>
                          <span className="inline-flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" />
                            {formatRelativeTime(worker.last_heartbeat_at, relativeLabels)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {snapshot.workers.length === 0 && (
              <div className="py-8 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t.workers.no_workers}</p>
              </div>
            )}
          </div>

          {/* Last Updated */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            {t.last_updated} {snapshot.timestamp}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default WorkersPanel;
