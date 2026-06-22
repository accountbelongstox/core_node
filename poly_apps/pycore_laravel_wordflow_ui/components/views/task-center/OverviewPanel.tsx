/**
 * Task Center — OVERVIEW tab: the scheduler ⇄ queue relationship guide.
 *
 * Renders the two-layer architecture as a left-to-right flow of three live
 * cards (Scheduler → Queue → Workers) with role-labeled arrow connectors and
 * a maintainer loop-back note, followed by the relations table (the
 * `relations[]` edges from /api/task-center/overview joined with each timer
 * task's live run stats) and the i18n explainer block. Pure flex/CSS — no
 * canvas. Row click on a relation jumps to the scheduler tab.
 */
import React from 'react';
import { Language } from '../../../types';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import type {
  TaskCenterOverview,
  TaskCenterSchedulerTask,
} from '../../../core/api/modules/ServerManagerAPI';
import {
  Timer,
  Database,
  Cpu,
  ArrowRight,
  ArrowDown,
  RotateCcw,
  CheckCircle,
  XCircle,
  Loader2,
  Languages,
  Chrome,
  Bot,
  Info,
} from 'lucide-react';
import { RoleBadge, StatusBadge, formatUptime, formatLastRunAgo } from './shared';
import CoverStatusCard from './CoverStatusCard';

export type TaskCenterTab = 'overview' | 'scheduler' | 'queue' | 'workers' | 'assist';

interface OverviewPanelProps {
  lang: Language;
  overview: TaskCenterOverview | null;
  loading: boolean;
  onNavigate: (tab: TaskCenterTab) => void;
}

/** Queue statuses shown as mini count chips on the queue card (order matters). */
const QUEUE_CHIP_STATUSES = [
  'pending',
  'assigned',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;

const LayerArrow: React.FC<{ labels: React.ReactNode }> = ({ labels }) => (
  <div className="flex lg:flex-col items-center justify-center gap-1 px-1 shrink-0">
    <div className="flex flex-col items-center gap-1">{labels}</div>
    <ArrowRight className="hidden lg:block w-6 h-6 text-slate-400 dark:text-slate-500" />
    <ArrowDown className="lg:hidden w-6 h-6 text-slate-400 dark:text-slate-500" />
  </div>
);

const OverviewPanel: React.FC<OverviewPanelProps> = ({ lang, overview, loading, onNavigate }) => {
  const t = TRANSLATIONS[lang].taskCenter;
  const to = t.overview;

  if (!overview) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{t.load_failed}</span>}
      </div>
    );
  }

  const { scheduler, queue, workers, relations } = overview;
  const schedulerByName = new Map<string, TaskCenterSchedulerTask>(
    scheduler.tasks.map((task) => [task.name, task])
  );
  const roleTimers = {
    producer: relations.filter((r) => r.role === 'producer'),
    consumer: relations.filter((r) => r.role === 'consumer'),
    maintainer: relations.filter((r) => r.role === 'maintainer'),
  };

  return (
    <div className="space-y-6">
      {/* ===== Two-layer flow diagram ===== */}
      <div className="flex flex-col lg:flex-row items-stretch gap-2">
        {/* Scheduler layer */}
        <button
          type="button"
          onClick={() => onNavigate('scheduler')}
          className={`${commonClasses.card} flex-1 p-4 text-left hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-700 transition`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Timer className="w-5 h-5 text-indigo-500" />
            <span className="font-bold">{to.scheduler_card}</span>
            <span
              className={`ml-auto inline-block w-2.5 h-2.5 rounded-full ${scheduler.running ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">{to.scheduler_card_sub}</div>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-mono font-bold">{scheduler.tasks.length}</span> {to.timer_tasks}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {scheduler.total_ticks.toLocaleString()} {to.ticks} · {to.uptime}{' '}
              {formatUptime(scheduler.uptime)}
            </div>
          </div>
        </button>

        <LayerArrow
          labels={
            <>
              {roleTimers.producer.length > 0 && <RoleBadge role="producer" lang={lang} />}
              {roleTimers.consumer.length > 0 && <RoleBadge role="consumer" lang={lang} />}
            </>
          }
        />

        {/* Queue layer */}
        <button
          type="button"
          onClick={() => onNavigate('queue')}
          className={`${commonClasses.card} flex-1 p-4 text-left hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-700 transition`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-blue-500" />
            <span className="font-bold">{to.queue_card}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">{to.queue_card_sub}</div>
          <div className="flex flex-wrap gap-1.5">
            {QUEUE_CHIP_STATUSES.map((status) => (
              <span key={status} className="inline-flex items-center gap-1">
                <StatusBadge status={status} kind="queue" />
                <span className="text-xs font-mono font-bold">
                  {(queue.stats as any)?.[status] ?? 0}
                </span>
              </span>
            ))}
          </div>
        </button>

        <LayerArrow
          labels={
            <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
              pull → result
            </span>
          }
        />

        {/* Workers / executors */}
        <button
          type="button"
          onClick={() => onNavigate('workers')}
          className={`${commonClasses.card} flex-1 p-4 text-left hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-700 transition`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-5 h-5 text-green-500" />
            <span className="font-bold">{to.workers_card}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">{to.workers_card_sub}</div>
          <div className="text-sm mb-2">
            <span className="text-green-600 dark:text-green-400 font-bold">{workers.stats.online}</span>
            {' / '}
            <span className="text-amber-600 dark:text-amber-400 font-bold">{workers.stats.busy}</span>
            {' / '}
            <span className="text-slate-500 font-bold">{workers.stats.offline}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">online / busy / offline</span>
          </div>
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-500" /> {to.known_workers.pycore}
            </div>
            <div className="flex items-center gap-1.5">
              <Chrome className="w-3.5 h-3.5 text-amber-500" /> {to.known_workers.chrome}
            </div>
            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-500" /> {to.known_workers.internal_ai}
            </div>
          </div>
        </button>
      </div>

      {/* Maintainer loop-back note */}
      <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2">
        <RotateCcw className="w-4 h-4 shrink-0" />
        <RoleBadge role="maintainer" lang={lang} />
        <span>{to.maintain_loop}</span>
      </div>

      {/* ===== Relations table ===== */}
      <div className={`${commonClasses.card} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-bold text-sm">
          {to.relations_title}
        </div>
        {relations.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">{to.no_relations}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2 font-medium">{to.relations_columns.timer}</th>
                  <th className="px-4 py-2 font-medium">{to.relations_columns.role}</th>
                  <th className="px-4 py-2 font-medium">{to.relations_columns.target}</th>
                  <th className="px-4 py-2 font-medium">{to.relations_columns.interval}</th>
                  <th className="px-4 py-2 font-medium">{to.relations_columns.runs}</th>
                  <th className="px-4 py-2 font-medium">{to.relations_columns.errors}</th>
                  <th className="px-4 py-2 font-medium">{to.relations_columns.registered}</th>
                </tr>
              </thead>
              <tbody>
                {relations.map((rel) => {
                  const live = schedulerByName.get(rel.timer);
                  return (
                    <tr
                      key={rel.timer}
                      onClick={() => onNavigate('scheduler')}
                      className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {rel.timer}
                        {rel.worker_id && (
                          <span className="block text-[10px] text-slate-400">→ {rel.worker_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <RoleBadge role={rel.role} lang={lang} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{rel.target}</td>
                      <td className="px-4 py-2.5 text-xs">{live ? `${live.interval}s` : '—'}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">
                        {live ? live.run_count : '—'}
                        {live && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            {formatLastRunAgo(live.last_run_ago)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono">
                        {live && live.error_count > 0 ? (
                          <span className="text-red-600 dark:text-red-400">{live.error_count}</span>
                        ) : (
                          live ? live.error_count : '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {rel.registered ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== Cover Generation & AI (management surface of the
                appqyv1_cover_generation timer task — own load/refresh,
                no polling) ===== */}
      <CoverStatusCard lang={lang} />

      {/* ===== Explainer ===== */}
      <div className={`${commonClasses.card} p-4`}>
        <div className="flex items-center gap-2 font-bold text-sm mb-2">
          <Info className="w-4 h-4 text-indigo-500" />
          {to.explainer_title}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{to.explainer}</p>
      </div>
    </div>
  );
};

export default OverviewPanel;
