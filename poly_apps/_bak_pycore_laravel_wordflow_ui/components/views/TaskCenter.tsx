/**
 * Task Center — ONE management page over BOTH task layers.
 *
 * Replaces the former OctaneTasks + GlobalTasks views with a single tabbed
 * page: overview (the scheduler ⇄ queue relationship guide, fed by the
 * /api/task-center/overview aggregate), scheduler (Octane timer tasks),
 * queue (global_tasks) and workers. The header owns ONE set of refresh
 * controls shared by every tab: auto-refresh drives each panel's own
 * persistent poll session; the manual button bumps `refreshToken` so the
 * active panel re-fetches immediately.
 *
 * Persistent task keys: the shell polls 'laravel.task-center' (overview
 * aggregate); SchedulerPanel keeps 'laravel.octane-tasks' and QueuePanel /
 * WorkersPanel share 'laravel.global-tasks', so leaving and returning to any
 * tab stays warm.
 */
import React, { useState, useEffect } from 'react';
import { Language } from '../../types';
import { api } from '../../core/api';
import type { TaskCenterOverview } from '../../core/api/modules/ServerManagerAPI';
import { usePersistentTask } from '../../core/tasks/usePersistentTask';
import { TRANSLATIONS } from '../../constants';
import {
  LayoutDashboard,
  Timer,
  Database,
  Cpu,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import OverviewPanel, { TaskCenterTab } from './task-center/OverviewPanel';
import SchedulerPanel from './task-center/SchedulerPanel';
import QueuePanel from './task-center/QueuePanel';
import WorkersPanel from './task-center/WorkersPanel';

interface TaskCenterProps {
  lang?: Language;
  /** Deep-link target tab (old 'octane' / 'global-tasks' slugs land here). */
  initialTab?: TaskCenterTab;
}

const TAB_ICONS: Record<TaskCenterTab, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  scheduler: Timer,
  queue: Database,
  workers: Cpu,
};

const TAB_ORDER: TaskCenterTab[] = ['overview', 'scheduler', 'queue', 'workers'];

const TaskCenter: React.FC<TaskCenterProps> = ({ lang = 'en', initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<TaskCenterTab>(initialTab);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(5);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = TRANSLATIONS[lang].taskCenter;

  // Aggregate overview poll — powers the header chips + the overview tab and
  // annotates scheduler rows with queue roles. Same persistent-session pattern
  // as the panels: errors settle to null (keep last snapshot, show banner).
  const fetchOverview = (): Promise<TaskCenterOverview | null> =>
    api.serverManager.getTaskCenterOverview()
      .then((response) => {
        if (response.success && response.data) {
          setError(null);
          setLoading(false);
          return response.data;
        }
        setError(response.error || t.load_failed);
        setLoading(false);
        return null;
      })
      .catch((err: any) => {
        setError(err?.message || t.load_failed);
        setLoading(false);
        return null;
      });

  const task = usePersistentTask<TaskCenterOverview>('laravel.task-center', {
    intervalMs: refreshIntervalSec * 1000,
    poll: fetchOverview,
    reattach: fetchOverview,
  });
  const overview = task.data;

  // Initial load (idempotent — reuse a live session's data after navigation).
  useEffect(() => {
    if (overview) return;
    setLoading(true);
    fetchOverview().then((snapshot) => {
      if (snapshot) task.set(snapshot);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh toggle / interval drive the persistent poll loop on/off.
  useEffect(() => {
    if (autoRefresh) {
      if (task.running) task.end();
      task.begin();
    } else if (task.running) {
      task.end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshIntervalSec]);

  // Manual refresh: refetch the aggregate AND signal the active panel.
  const refreshNow = () => {
    setLoading(true);
    fetchOverview().then((snapshot) => {
      if (snapshot) task.set(snapshot);
    });
    setRefreshToken((token) => token + 1);
  };

  const chips: React.ReactNode[] = [];
  if (overview) {
    chips.push(
      <span
        key="scheduler"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          overview.scheduler.running
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${overview.scheduler.running ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
        />
        {overview.scheduler.running ? t.chips.scheduler_running : t.chips.scheduler_stopped}
      </span>,
      <span
        key="pending"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
      >
        <span className="font-mono font-bold">{overview.queue.stats.pending}</span>
        {t.chips.queue_pending}
      </span>,
      <span
        key="workers"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
      >
        <span className="font-mono font-bold">{overview.workers.stats.online}</span>
        {t.chips.workers_online}
      </span>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* ===== Header: title + live chips + unified refresh controls ===== */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="mr-auto">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-500" />
            {t.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">{chips}</div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            {t.auto_refresh}
          </label>
          <select
            value={refreshIntervalSec}
            onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
            className={`${commonClasses.input} text-xs py-1 px-2 w-auto`}
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
          </select>
          <button
            onClick={refreshNow}
            disabled={loading}
            className={`${commonClasses.buttonPrimary} text-xs px-3 py-1.5 flex items-center gap-1.5`}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t.refresh}
          </button>
        </div>
      </div>

      {/* Error banner (overview aggregate) */}
      {error && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={refreshNow} className="text-xs underline">
            {t.retry}
          </button>
        </div>
      )}

      {/* ===== Tab bar ===== */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-700">
        {TAB_ORDER.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                active
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.tabs[tab]}
            </button>
          );
        })}
      </div>

      {/* ===== Active tab panel ===== */}
      {activeTab === 'overview' && (
        <OverviewPanel lang={lang} overview={overview} loading={loading} onNavigate={setActiveTab} />
      )}
      {activeTab === 'scheduler' && (
        <SchedulerPanel
          lang={lang}
          autoRefresh={autoRefresh}
          refreshIntervalSec={refreshIntervalSec}
          refreshToken={refreshToken}
          overview={overview}
        />
      )}
      {activeTab === 'queue' && (
        <QueuePanel
          lang={lang}
          autoRefresh={autoRefresh}
          refreshIntervalSec={refreshIntervalSec}
          refreshToken={refreshToken}
        />
      )}
      {activeTab === 'workers' && (
        <WorkersPanel
          lang={lang}
          autoRefresh={autoRefresh}
          refreshIntervalSec={refreshIntervalSec}
          refreshToken={refreshToken}
        />
      )}

      {/* Last updated */}
      {overview && (
        <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
          {t.last_updated} {new Date(overview.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default TaskCenter;
