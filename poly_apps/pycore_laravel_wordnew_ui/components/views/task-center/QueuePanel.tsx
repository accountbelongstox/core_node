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
import { Language } from '../../../apps/laravel-manager/uiTypes';
import { api } from '@/apps/laravel-manager/api';
import type {
  GlobalTaskItem,
  GlobalTaskDetailBundle,
  GlobalTaskEvent,
  TaskDetailStreamHandle,
} from '@/apps/laravel-manager/api';
import { useTaskCenterState } from './TaskCenterState';
import { TRANSLATIONS } from '../../../constants';
import {
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  Search,
  Info,
  Layers,
  ListChecks,
  Ban,
  PlayCircle,
  UserCheck,
  FlaskConical,
  Zap,
  ArrowUpToLine,
  Radio,
} from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { AlertBox, EmptyState, InlineSpinner, LoadingBlock } from '../../common';
import Portal from '../../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';
import {
  StatCard,
  StatusBadge,
  ProgressBar,
  TaskTypeBadge,
  CapabilityBadge,
  TASK_TYPE_KEYS,
  taskTypeMeta,
  QUEUE_TASK_STATUSES,
  CANCELLABLE_STATUSES,
  formatDateTime,
  formatResultPreview,
  shortId,
  type GlobalTasksSnapshot,
} from './shared';
import MissingSentenceAudioPanel from './MissingSentenceAudioPanel';
import {
  GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE,
  GLOBAL_TASK_PRIORITIES,
  GLOBAL_TASK_STATUSES_BY_ROLE,
} from '@/apps/laravel-manager/integrations/pycore';

interface QueuePanelProps {
  lang: Language;
}

type TaskStatusFilter = 'all' | (typeof QUEUE_TASK_STATUSES)[number];
type TaskSortMode = 'default' | 'priority_desc' | 'priority_asc';

/** Pull a media URL of the given kind out of an arbitrary task result object. */
const extractMediaUrl = (result: any, kind: 'image' | 'audio'): string | null => {
  if (!result || typeof result !== 'object') return null;
  const direct =
    kind === 'image'
      ? result.image_url || result.imageUrl || result.cover_url || result.url
      : result.audio_url || result.audioUrl || (result.audio && (result.audio.url || result.audio)) || result.url;
  const candidate = typeof direct === 'string' ? direct : null;
  if (!candidate) return null;
  const lower = candidate.toLowerCase();
  if (kind === 'image' && /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(lower)) return candidate;
  if (kind === 'audio' && /\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(lower)) return candidate;
  // Field name was explicit (image_url/audio_url) → trust it even without an extension.
  if (kind === 'image' && (result.image_url || result.imageUrl || result.cover_url)) return candidate;
  if (kind === 'audio' && (result.audio_url || result.audioUrl || result.audio)) return candidate;
  return null;
};

/** Inline media preview (image / audio) for a completed task result, when present. */
const renderResultMedia = (result: any): React.ReactNode => {
  const imageUrl = extractMediaUrl(result, 'image');
  const audioUrl = extractMediaUrl(result, 'audio');
  if (!imageUrl && !audioUrl) return null;
  return (
    <div className="mb-2 space-y-2">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="result"
          className="max-h-48 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
          loading="lazy"
        />
      )}
      {audioUrl && (
        <audio controls src={audioUrl} className="w-full">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
};

const QueuePanel: React.FC<QueuePanelProps> = ({
  lang,
}) => {
  const { globalTasks: snapshot, loading, error, refreshNow, promoteTask } = useTaskCenterState();
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  // Client-side task_type filter ('all' = every type). The list endpoint is
  // server-filtered by STATUS only, so type filtering is applied locally.
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<TaskSortMode>('default');
  const [fastOnly, setFastOnly] = useState(false);
  const [selectedTask, setSelectedTask] = useState<GlobalTaskItem | null>(null);
  // Live drilldown bundle (task + event timeline + phase + metadata) streamed
  // over SSE for the open modal.
  const [detailBundle, setDetailBundle] = useState<GlobalTaskDetailBundle | null>(null);
  const [streamLive, setStreamLive] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The active SSE subscription for the open detail modal (closed on close/unmount).
  const streamRef = useRef<TaskDetailStreamHandle | null>(null);

  const t = TRANSLATIONS[lang].globalTasks;

  // The list is server-filtered by status, so a filter change must refetch.
  // Now we fetch all tasks in the shared store, so we filter client-side.

  const handleCancelTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setCancellingId(taskId);
    setNotice(null);
    try {
      const response = await api.serverManager.cancelGlobalTask(taskId);
      if (response.success) {
        setNotice(`${t.cancelled_ok}: ${shortId(taskId)}`);
        refreshNow();
      } else {
        setNotice(`${t.cancel_failed}: ${response.error || ''}`.trim());
      }
    } catch (err: any) {
      setNotice(`${t.cancel_failed}: ${err?.message || ''}`.trim());
    } finally {
      setCancellingId(null);
    }
  };

  // Tear down any live stream when the component unmounts.
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
    };
  }, []);

  const openTaskDetail = async (row: GlobalTaskItem) => {
    // Drop any previous subscription before opening a new task.
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setSelectedTask(row);
    setDetailBundle(null);
    setStreamLive(false);
    setDetailLoading(true);

    // One-shot detail fetch (works even if SSE is unavailable), then upgrade to
    // a live SSE subscription that pushes the initial bundle + each transition.
    try {
      const response = await api.serverManager.getTaskDetail(row.task_id);
      if (response.success && response.data && response.data.task) {
        setDetailBundle(response.data.task ? response.data : null);
      }
    } catch {
      // Fall back silently to the row snapshot already in selectedTask.
    } finally {
      setDetailLoading(false);
    }

    streamRef.current = api.serverManager.subscribeTaskDetail(row.task_id, {
      onInitial: (bundle) => {
        setDetailBundle(bundle);
        setStreamLive(true);
        setDetailLoading(false);
      },
      onEvent: (event) => {
        // Append the new transition to the timeline and refetch the task fields
        // (status/progress/result) so the modal stays truthful on terminal moves.
        setDetailBundle((prev) =>
          prev ? { ...prev, events: appendEvent(prev.events, event) } : prev
        );
        void refreshDetailTask(row.task_id);
      },
      onClose: () => setStreamLive(false),
      onError: () => setStreamLive(false),
    });
  };

  // Merge a streamed event into the timeline (de-dupe by id).
  const appendEvent = (events: GlobalTaskEvent[], next: GlobalTaskEvent): GlobalTaskEvent[] => {
    const nextId = next._id ?? next.id;
    if (events.some((e) => (e._id ?? e.id) === nextId)) return events;
    return [...events, next];
  };

  // Re-pull the task half of the bundle (the SSE event carries only the
  // transition, not the refreshed task fields/result).
  const refreshDetailTask = async (taskId: string) => {
    try {
      const response = await api.serverManager.getTaskDetail(taskId);
      if (response.success && response.data && response.data.task) {
        setDetailBundle((prev) =>
          prev ? { ...response.data!, events: prev.events } : response.data!
        );
      }
    } catch {
      // Keep the last good bundle.
    }
  };

  const closeTaskDetail = () => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setSelectedTask(null);
    setDetailBundle(null);
    setStreamLive(false);
    setDetailLoading(false);
  };

  const handleBump = async (taskId: string) => {
    setBumpingId(taskId);
    setNotice(null);
    try {
      const response = await api.serverManager.bumpTaskPriority(taskId, 100);
      if (response.success && response.data) {
        setNotice(`${t.detail.bumped_ok} ${response.data.priority}: ${shortId(taskId)}`);
        promoteTask(taskId, response.data.priority);
        void refreshDetailTask(taskId);
      } else {
        setNotice(`${t.detail.bump_failed}: ${response.error || ''}`.trim());
      }
    } catch (err: any) {
      setNotice(`${t.detail.bump_failed}: ${err?.message || ''}`.trim());
    } finally {
      setBumpingId(null);
    }
  };

  const previewLabels = { no_result: t.detail.no_result, result_truncated: t.detail.result_truncated };

  // Read priority/fast-tier off a row tolerantly — the list endpoint may omit
  // them on an older backend (they are optional on the row shape).
  const rowPriority = (row: GlobalTaskItem): number =>
    typeof (row as any).priority === 'number' ? (row as any).priority : 0;
  const rowIsFast = (row: GlobalTaskItem): boolean =>
    (row as any).is_fast_tier === true ||
    (row as any).execution_type === GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE.remote_fast ||
    rowPriority(row) >= GLOBAL_TASK_PRIORITIES.fast;

  const getFilteredTasks = (): GlobalTaskItem[] => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    let rows = snapshot.tasks;
    if (q) {
      rows = rows.filter(
        (row) =>
          (row.app_name || '').toLowerCase().includes(q) ||
          (row.task_type || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((row) => row.status === statusFilter);
    }
    if (fastOnly) {
      rows = rows.filter(rowIsFast);
    }
    if (typeFilter !== 'all') {
      rows = rows.filter((row) => (row.task_type || '') === typeFilter);
    }
    if (sortMode !== 'default') {
      // Copy before sorting so the shared snapshot array is never mutated.
      rows = [...rows].sort((a, b) =>
        sortMode === 'priority_desc'
          ? rowPriority(b) - rowPriority(a)
          : rowPriority(a) - rowPriority(b)
      );
    }
    return rows;
  };

  const statusFilterLabel = (s: TaskStatusFilter): string => {
    if (s === 'all') return 'All';
    return (t.stats as Record<string, string>)[s] || s;
  };

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

  const stats = snapshot?.stats;

  return (
    <div className="flex flex-col gap-4">
      <MissingSentenceAudioPanel lang={lang} refreshToken={0} />

      {/* Transient error / action notice banners */}
      {error && snapshot && <AlertBox variant="error">{error}</AlertBox>}
      {notice && (
        <AlertBox variant="info" icon={false}>
          <div className="flex items-center justify-between gap-2 w-full">
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
        </AlertBox>
      )}

      {loading && !snapshot ? (
        <LoadingBlock label="" className="py-16" />
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
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                >
                  {statusFilterLabel(f)}
                </button>
              ))}
            </div>
            {/* Fast-lane only toggle */}
            <button
              onClick={() => setFastOnly((v) => !v)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${fastOnly
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              title={t.fast_only}
            >
              <Zap className="w-3 h-3" />
              {t.fast_only}
            </button>

            {/* Priority sort */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.sort}</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as TaskSortMode)}
                className="py-1 pl-2 pr-6 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="default">{t.sort_default}</option>
                <option value="priority_desc">{t.sort_priority_desc}</option>
                <option value="priority_asc">{t.sort_priority_asc}</option>
              </select>
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

          {/* Task-type filter chips — every canonical task_type + All */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${typeFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
            >
              All types
            </button>
            {TASK_TYPE_KEYS.map((tt) => {
              const meta = taskTypeMeta(tt);
              const Icon = meta.icon;
              const active = typeFilter === tt;
              return (
                <button
                  key={tt}
                  onClick={() => setTypeFilter(active ? 'all' : tt)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${active ? 'bg-indigo-600 text-white' : meta.badge + ' hover:opacity-80'
                    }`}
                  title={tt}
                >
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </button>
              );
            })}
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
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col items-start gap-1">
                          <TaskTypeBadge taskType={row.task_type} />
                          <CapabilityBadge capability={(row as any).capability ?? null} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 font-mono">
                            {row.execution_type}
                          </span>
                          {rowIsFast(row) && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              title={t.detail.fast_tier}
                            >
                              <Zap className="w-2.5 h-2.5" />
                              {rowPriority(row) || 100}
                            </span>
                          )}
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
                              <InlineSpinner size={12} />
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
              <EmptyState icon={ListChecks} message={t.no_tasks} className="py-12" />
            )}
          </div>

          {/* Task Detail Modal — LIVE SSE drilldown */}
          {selectedTask && (() => {
            const taskData = detailBundle?.task;
            const phase = detailBundle?.current_phase;
            const meta = detailBundle?.metadata;
            const events = detailBundle?.events ?? [];

            // Merge the live bundle over the row snapshot so the modal renders
            // immediately, then sharpens once the stream's initial frame lands.
            const status = taskData?.status ?? selectedTask.status;
            const progress = taskData?.progress ?? selectedTask.progress;
            const priority = taskData?.priority;
            const capability = taskData?.capability ?? null;
            const executionType = taskData?.execution_type ?? selectedTask.execution_type;
            const isFastTier = taskData?.is_fast_tier ?? rowIsFast(selectedTask);
            const canBump = status === GLOBAL_TASK_STATUSES_BY_ROLE.pending;

            return (
              <Portal>
                <div
                  className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}
                  onClick={closeTaskDetail}
                >
                  <div
                    className={`${commonClasses.card} max-w-2xl w-full max-h-[85vh] overflow-y-auto`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {detailLoading && !detailBundle && (
                      <div className="flex items-center gap-2 px-6 py-2 text-xs text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-700">
                        <InlineSpinner size={14} />
                        {t.detail.loading}
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="min-w-0">
                          <h3 className="text-xl font-bold mb-1">{t.detail.title}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono break-all">
                            {selectedTask.task_id}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${streamLive
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}
                            >
                              <Radio className={`w-3 h-3 ${streamLive ? 'animate-pulse' : ''}`} />
                              {streamLive ? t.detail.live_stream : t.detail.stream_offline}
                            </span>
                            {isFastTier && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                <Zap className="w-3 h-3" />
                                {t.detail.fast_tier}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {canBump && (
                            <button
                              onClick={() => handleBump(selectedTask.task_id)}
                              disabled={bumpingId === selectedTask.task_id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
                              title={t.detail.bump}
                            >
                              {bumpingId === selectedTask.task_id ? (
                                <InlineSpinner size={14} />
                              ) : (
                                <ArrowUpToLine className="w-3.5 h-3.5" />
                              )}
                              {bumpingId === selectedTask.task_id ? t.detail.bumping : t.detail.bump}
                            </button>
                          )}
                          <button
                            onClick={closeTaskDetail}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Status + Progress */}
                        <div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t.detail.status}</div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={status} kind="queue" size="sm" />
                            <div className="flex-1"><ProgressBar progress={progress} status={status} /></div>
                          </div>
                        </div>

                        {/* Core fields */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.app_name}</div>
                            <div className="text-sm font-bold">{taskData?.app_name ?? selectedTask.app_name}</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.task_type}</div>
                            <div className="mt-1">
                              <TaskTypeBadge taskType={taskData?.task_type ?? selectedTask.task_type} size="sm" />
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.lane}</div>
                            <div className="text-sm font-bold font-mono">{executionType}</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.capability}</div>
                            <div className="mt-1">
                              <CapabilityBadge capability={capability} size="sm" />
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.assigned_to}</div>
                            <div className="text-sm font-bold font-mono break-all">{(taskData?.assigned_to ?? selectedTask.assigned_to) || '—'}</div>
                          </div>
                          {priority !== undefined && (
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                              <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.priority}</div>
                              <div className="text-sm font-bold">{priority}</div>
                            </div>
                          )}
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.created_at}</div>
                            <div className="text-sm font-medium">{formatDateTime(taskData?.created_at ?? selectedTask.created_at)}</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.updated_at}</div>
                            <div className="text-sm font-medium">{formatDateTime(taskData?.updated_at)}</div>
                          </div>
                          {meta && (
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                              <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.retries}</div>
                              <div className="text-sm font-bold">
                                {meta.total_attempts} / {meta.max_retries ?? '—'}
                                {meta.estimated_timeout_in_seconds ? ` · ${meta.estimated_timeout_in_seconds}s` : ''}
                              </div>
                            </div>
                          )}
                          {taskData?.completed_at && (
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                              <div className="text-xs text-slate-500 dark:text-slate-400">{t.detail.completed_at}</div>
                              <div className="text-sm font-medium">{formatDateTime(taskData.completed_at)}</div>
                            </div>
                          )}
                        </div>

                        {/* Current phase (live) */}
                        {phase && (phase.phase || phase.worker_id) && (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-3 text-sm">
                            <PlayCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300">{t.detail.phase}:</span>
                            <span className="font-mono">{phase.phase || '—'}</span>
                            {phase.worker_id && (
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">@ {shortId(phase.worker_id)}</span>
                            )}
                            {phase.elapsed_seconds != null && (
                              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                                {t.detail.elapsed} {phase.elapsed_seconds}s
                              </span>
                            )}
                          </div>
                        )}

                        {/* Event timeline */}
                        <div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t.detail.timeline}</div>
                          {events.length === 0 ? (
                            <div className="text-xs text-slate-400 italic">{t.detail.no_events}</div>
                          ) : (
                            <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-3">
                              {events.map((ev) => (
                                <li key={String(ev._id ?? ev.id)} className="ml-4">
                                  <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-indigo-400 dark:bg-indigo-500 border-2 border-white dark:border-slate-900" />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge status={ev.event} kind="queue" />
                                    {ev.worker_id && (
                                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{shortId(ev.worker_id)}</span>
                                    )}
                                    {ev.attempt != null && (
                                      <span className="text-xs text-slate-400">{t.detail.attempt} {ev.attempt}</span>
                                    )}
                                    <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">{formatDateTime(ev.created_at)}</span>
                                  </div>
                                  {ev.detail !== undefined && ev.detail !== null && ev.detail !== '' && (
                                    <pre className="mt-1 p-2 bg-slate-50 dark:bg-slate-800 rounded text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                                      {formatResultPreview(ev.detail, previewLabels)}
                                    </pre>
                                  )}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>

                        {/* Payload */}
                        {taskData?.payload !== undefined && taskData?.payload !== null && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t.detail.payload}</div>
                            <pre className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                              {formatResultPreview(taskData.payload, previewLabels)}
                            </pre>
                          </div>
                        )}

                        {/* Error */}
                        {taskData?.error && (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">{t.detail.error}</div>
                            <div className="text-sm text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                              {taskData.error}
                            </div>
                          </div>
                        )}

                        {/* Result (truncated) + inline media */}
                        <div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t.detail.result}</div>
                          {renderResultMedia(taskData?.result)}
                          <pre className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                            {formatResultPreview(taskData?.result, previewLabels)}
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
