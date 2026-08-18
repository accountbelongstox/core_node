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
import React from 'react';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { useTaskCenterState } from './TaskCenterState';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';
import {
  Activity,
  RefreshCw,
  XCircle,
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
import { commonClasses } from '@/shared/styles/theme';
import { AlertBox, EmptyState, LoadingBlock } from '../../common';
import {
  StatCard,
  StatusBadge,
  formatRelativeTime,
  shortId,
} from './shared';

interface WorkersPanelProps {
  lang: Language;
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
}) => {
  const { globalTasks: snapshot, loading, error, refreshNow } = useTaskCenterState();

  const t = TRANSLATIONS[lang].globalTasks;
  const tc = TRANSLATIONS[lang].taskCenter.workers_panel;

  if (error && !snapshot) {
    return (
      <AlertBox variant="error" className="flex-col items-stretch text-center">
        <p className="font-semibold">{t.load_failed}</p>
        <p className="text-xs opacity-80 mt-1">{error}</p>
        <button
          onClick={refreshNow}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} inline-flex items-center gap-2 mx-auto mt-3`}
        >
          <RefreshCw className="w-4 h-4" />
          {t.retry}
        </button>
      </AlertBox>
    );
  }

  const workerStats = snapshot?.workerStats;
  const relativeLabels = { never: t.never, just_now: t.just_now };

  return (
    <div className="flex flex-col gap-4">
      {error && snapshot && <AlertBox variant="error">{error}</AlertBox>}

      {loading && !snapshot ? (
        <LoadingBlock label="" className="py-16" />
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
                            className={`mt-1 inline-flex items-center gap-1.5 text-xs ${hint.key === 'generic'
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
              <EmptyState icon={Users} message={t.workers.no_workers} className="py-8" />
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
