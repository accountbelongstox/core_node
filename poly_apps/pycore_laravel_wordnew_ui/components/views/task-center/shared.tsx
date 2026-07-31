/**
 * Task Center — shared presentational primitives + formatters.
 *
 * Single source of truth for BOTH task-layer vocabularies:
 *   - QUEUE statuses  (global_tasks 7-state lifecycle, + worker statuses)
 *   - SCHEDULER statuses (Octane timer task states)
 * plus the scheduler⇄queue RoleBadge (producer/consumer/maintainer), the
 * StatCard used across all tabs, the queue ProgressBar and the time/duration
 * formatters lifted (deduped) from the former OctaneTasks/GlobalTasks views.
 */
import React from 'react';
import {
  LucideIcon,
  Sparkles,
} from 'lucide-react';
import { Language } from '../../../types';
import { TRANSLATIONS } from '../../../constants';
import { StatusBadge as CommonStatusBadge } from '../../common/StatusBadge';
import { StatCard as CommonStatCard } from '../../common/StatCard';
import type { TaskCenterQueueRole } from '@/apps/laravel-manager/api';
import {
  GLOBAL_TASK_CAPABILITIES,
  GLOBAL_TASK_CAPABILITIES_BY_ROLE,
  GLOBAL_TASK_CAPABILITY_LABELS,
  GLOBAL_TASK_LIVE_STATUSES,
  GLOBAL_TASK_STATUSES,
  GLOBAL_TASK_STATUSES_BY_ROLE,
  GLOBAL_TASK_TYPE_CATALOG,
} from '@/apps/laravel-manager/integrations/pycore';

// ==================== Status vocabularies ====================

/** Full status vocabulary of the `global_tasks` substrate (incl. cancelled). */
export const QUEUE_TASK_STATUSES = GLOBAL_TASK_STATUSES;

export type QueueTaskStatus = (typeof QUEUE_TASK_STATUSES)[number];

export const CANCELLABLE_STATUSES: string[] = GLOBAL_TASK_LIVE_STATUSES;

/** Queue statuses: pending=blue, assigned=indigo, processing=amber,
 *  completed=green, completed_demo=teal, failed=red, cancelled=gray,
 *  timeout=orange, reclaimed=yellow. */
const QUEUE_STATUS_BADGE: Record<string, string> = {
  [GLOBAL_TASK_STATUSES_BY_ROLE.pending]: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  [GLOBAL_TASK_STATUSES_BY_ROLE.assigned]: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  [GLOBAL_TASK_STATUSES_BY_ROLE.processing]: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  [GLOBAL_TASK_STATUSES_BY_ROLE.completed]: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  [GLOBAL_TASK_STATUSES_BY_ROLE.completed_demo]: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  [GLOBAL_TASK_STATUSES_BY_ROLE.failed]: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  [GLOBAL_TASK_STATUSES_BY_ROLE.cancelled]: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
};

/** Octane scheduler timer-task statuses. */
const SCHEDULER_STATUS_BADGE: Record<string, string> = {
  running: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  running_with_errors: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  waiting: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  registered: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  disabled: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
  not_registered: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

/** Worker liveness statuses. */
const WORKER_STATUS_BADGE: Record<string, string> = {
  online: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  busy: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  offline: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
};

const FALLBACK_BADGE = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';

export type StatusKind = 'queue' | 'scheduler' | 'worker';

export const statusBadgeClass = (status: string, kind: StatusKind = 'queue'): string => {
  const map =
    kind === 'scheduler' ? SCHEDULER_STATUS_BADGE : kind === 'worker' ? WORKER_STATUS_BADGE : QUEUE_STATUS_BADGE;
  return map[status] || FALLBACK_BADGE;
};

/** Pill badge for any queue / scheduler / worker status string. */
interface StatusBadgeProps {
  status: string;
  kind?: StatusKind;
  size?: 'xs' | 'sm';
}

export const StatusBadge = ({ status, kind = 'queue', size = 'xs' }: StatusBadgeProps) => (
  <CommonStatusBadge
    status={status}
    withDot={false}
    appearanceClassName={statusBadgeClass(status, kind)}
    className={`${size === 'sm' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'} rounded`}
  />
);

// ==================== Role badge (scheduler ⇄ queue) ====================

/** producer=blue 生产 / consumer=green 消费 / maintainer=purple 维护. */
const ROLE_BADGE: Record<TaskCenterQueueRole, string> = {
  producer: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  consumer: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800',
  maintainer: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
};

export const RoleBadge: React.FC<{ role: TaskCenterQueueRole; lang: Language }> = ({ role, lang }) => {
  const label = (TRANSLATIONS[lang].taskCenter.roles as Record<string, string>)[role] || role;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${ROLE_BADGE[role] || FALLBACK_BADGE}`}>
      {label}
    </span>
  );
};

// ==================== Task-type vocabulary (canonical) ====================

/** Canonical presentation for every global_tasks `task_type` the unified queue
 *  emits. Each entry: friendly label, a distinct badge color (same Tailwind
 *  light/dark pill style the status badges use), and a Lucide icon. */
interface TaskTypeMeta {
  label: string;
  color: string;
  icon: string;
}

export const TASK_TYPE_META: Record<string, TaskTypeMeta> = Object.fromEntries(
  GLOBAL_TASK_TYPE_CATALOG.map((definition) => [definition.key, {
    label: definition.label,
    color: definition.ui.color,
    icon: definition.ui.icon,
  }]),
);

/** The canonical task types in catalog order (for filter chip sets). */
export const TASK_TYPE_KEYS = Object.keys(TASK_TYPE_META);

export const taskTypeMeta = (taskType: string | null | undefined): TaskTypeMeta => {
  const key = (taskType || '').trim();
  return (
    TASK_TYPE_META[key] || {
      label: key || 'Unknown',
      color: '#64748b',
      icon: '📦',
    }
  );
};

/** Pill badge (icon + friendly label) for any task_type string. */
export const TaskTypeBadge: React.FC<{ taskType: string | null | undefined; size?: 'xs' | 'sm' }> = ({
  taskType,
  size = 'xs',
}) => {
  const meta = taskTypeMeta(taskType);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
      style={{ color: meta.color, borderColor: `${meta.color}66`, backgroundColor: `${meta.color}18` }}
      title={taskType || undefined}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
};

// ==================== Capability vocabulary (canonical) ====================

/** The 7 fast-lane capabilities + the NULL → 'any' (first-idle-wins) marker.
 *  'ai_translate' is shown as 'AI Translate' — deliberately distinct from the
 *  plain 'translate' (google) capability. */
interface CapabilityMeta {
  label: string;
  color: string;
}

export const CAPABILITY_META: Record<string, CapabilityMeta> = Object.fromEntries(
  GLOBAL_TASK_CAPABILITIES.map((capability) => {
    const taskType = GLOBAL_TASK_TYPE_CATALOG.find((definition) => definition.capability === capability);
    return [capability, {
      label: GLOBAL_TASK_CAPABILITY_LABELS[capability] || capability,
      color: taskType?.ui.color || '#64748b',
    }];
  }),
);

/** NULL / unset capability = first-idle-wins across all advertising workers. */
const CAPABILITY_ANY: CapabilityMeta = {
  label: 'any',
  color: '#64748b',
};

export const capabilityMeta = (cap: string | null | undefined): CapabilityMeta => {
  const key = (cap || '').trim();
  if (!key) return CAPABILITY_ANY;
  return CAPABILITY_META[key] || { label: key, color: '#64748b' };
};

/** Pill badge for a fast-lane capability (or 'any' when null/unset). */
export const CapabilityBadge: React.FC<{ capability: string | null | undefined; size?: 'xs' | 'sm' }> = ({
  capability,
  size = 'xs',
}) => {
  const meta = capabilityMeta(capability);
  const isAiTranslate = (capability || '').trim() === GLOBAL_TASK_CAPABILITIES_BY_ROLE.ai_translate;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      } border`}
      style={{ color: meta.color, borderColor: `${meta.color}66`, backgroundColor: `${meta.color}18` }}
      title={`capability: ${capability || 'any'}`}
    >
      {isAiTranslate && <Sparkles className={size === 'sm' ? 'w-4 h-4' : 'w-3 h-3'} />}
      {meta.label}
    </span>
  );
};

// ==================== StatCard ====================

export const StatCard: React.FC<{
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  sub?: React.ReactNode;
}> = ({ icon: Icon, iconClass, label, value, valueClass = '', sub }) => (
  <CommonStatCard
    icon={Icon}
    iconPosition="left"
    iconClassName={iconClass}
    label={label}
    value={value}
    valueClassName={valueClass}
    sub={sub}
    className="p-4"
  />
);

// ==================== ProgressBar (queue tasks) ====================

export const clampProgress = (progress: number): number => {
  const n = Number(progress);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

export const ProgressBar: React.FC<{ progress: number; status: string }> = ({ progress, status }) => {
  const pct = clampProgress(progress);
  const barColor =
    status === GLOBAL_TASK_STATUSES_BY_ROLE.failed
      ? 'bg-red-500'
      : status === GLOBAL_TASK_STATUSES_BY_ROLE.completed
          || status === GLOBAL_TASK_STATUSES_BY_ROLE.completed_demo
        ? 'bg-green-500'
        : 'bg-indigo-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-9 text-right">
        {Math.round(pct)}%
      </span>
    </div>
  );
};

// ==================== Formatters (deduped from the two old views) ====================

/** Uptime in seconds → "Hh Mm Ss". */
export const formatUptime = (seconds: number | null): string => {
  if (seconds === null || seconds === undefined) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
};

/** Backend (OctaneTimerService) reports last_duration as a float in SECONDS
 *  (microtime(true) delta), not milliseconds. */
export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return 'N/A';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(2)}s`;
};

/** Backend reports last_run_ago as integer SECONDS since the task last ran
 *  (or null if it has never run). */
export const formatLastRunAgo = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return 'Never';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m ago`;
};

/** ISO datetime → locale string (— when null/invalid). */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** ISO datetime → relative "Xs / Xm Ys / Xh Ym / Xd" (labels injected for i18n). */
export const formatRelativeTime = (
  iso: string | null | undefined,
  labels: { never: string; just_now: string }
): string => {
  if (!iso) return labels.never;
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 10) return labels.just_now;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d`;
};

export const shortId = (id: string): string => (id.length > 10 ? `${id.slice(0, 10)}…` : id);

export const RESULT_PREVIEW_MAX = 4000;

/** Stringify a payload/result preview with truncation. */
export const formatResultPreview = (
  result: any,
  labels: { no_result: string; result_truncated: string }
): string => {
  if (result === null || result === undefined) return labels.no_result;
  let text: string;
  if (typeof result === 'string') {
    text = result;
  } else {
    try {
      text = JSON.stringify(result, null, 2);
    } catch {
      text = String(result);
    }
  }
  if (text.length > RESULT_PREVIEW_MAX) {
    return `${text.slice(0, RESULT_PREVIEW_MAX)}\n… ${labels.result_truncated}`;
  }
  return text;
};

// ==================== Shared snapshot shape for the queue/workers tabs ====================
// Both QueuePanel and WorkersPanel run on the SAME persistent task key
// ('laravel.global-tasks') so navigation between them stays warm — they must
// agree on this snapshot shape (it is the pre-unification GlobalTasks shape).
import type {
  GlobalTaskItem,
  GlobalTaskStats,
  GlobalWorkerInfo,
  GlobalWorkerStats,
} from '@/apps/laravel-manager/api';

export interface GlobalTasksSnapshot {
  stats: GlobalTaskStats | null;
  tasks: GlobalTaskItem[];
  totalTasks: number;
  workers: GlobalWorkerInfo[];
  workerStats: GlobalWorkerStats | null;
  timestamp: string;
}
