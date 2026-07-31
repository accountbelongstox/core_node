/**
 * Queue Center — task detail modals (pycore-manager).
 *
 * Mirrors pycore_laravel_wordnew_ui task-center/QueuePanel detail UX:
 *   - PcLocalTaskDetailModal  — pyctl TaskManager records (Task Queue tab)
 *   - PcGlobalTaskDetailModal — Laravel global_tasks rows (Translation Queue tab)
 *   - PcQueueItemDetailModal  — voice-subtitle queue row (Queue Manager tab)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { XCircle, Loader2, Info } from 'lucide-react';
import Portal from '../../../components/shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { LocalTaskDetail, PycoreGlobalTaskDetail, QueueItem } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import { extractTaskContentSummary, mergeTaskContentSources } from '../utils/pcTaskContent';
import { PcBlobAudio } from './PcBlobMedia';
import {
  isLaravelGlobalTaskId,
  isSentenceQueueJobId,
  mergeTaskResultSources,
  resolveRemoteTaskId,
  resolveTaskWorker,
} from '../utils/pcTaskResult';
import { extractAudioPath, PcTaskAudioPreview } from './PcTaskAudioPreview';
import { extractEngine, extractSynthCommand, PcTaskSynthInfo } from './PcTaskSynthInfo';
import { useTopicDrivenRefresh } from '../hooks/useTopicDrivenRefresh';

const PREVIEW_MAX = 4000;

export function formatJsonPreview(value: unknown): string {
  if (value === null || value === undefined) return '—';
  let text: string;
  if (typeof value === 'string') text = value;
  else {
    try { text = JSON.stringify(value, null, 2); }
    catch { text = String(value); }
  }
  if (text.length > PREVIEW_MAX) {
    return `${text.slice(0, PREVIEW_MAX)}\n… (truncated)`;
  }
  return text;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function statusCls(status: string): string {
  if (status === 'completed') return 'bg-emerald-500/15 text-emerald-500';
  if (status === 'failed') return 'bg-rose-500/15 text-rose-500';
  if (status === 'processing') return 'bg-sky-500/15 text-sky-500';
  if (status === 'pending') return 'bg-slate-500/15 text-slate-400';
  return 'bg-slate-500/15 text-slate-400';
}

function ProgressBar({ progress, status }: { progress: number; status: string }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const bar = status === 'failed' ? 'bg-rose-500'
    : status === 'completed' ? 'bg-emerald-500' : 'bg-sky-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 w-9 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

function ModalShell({
  title, subtitle, loading, live, onClose, children,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  live?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Portal>
      <div
        className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}
        onClick={onClose}
      >
        <div
          className="pc-glass max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {loading && (
            <div className="flex items-center gap-2 px-6 py-2 text-xs text-sky-500 border-b border-slate-200/40 dark:border-white/5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading live detail…
            </div>
          )}
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
                {subtitle && (
                  <p className="text-xs font-mono text-slate-500 break-all mt-0.5">{subtitle}</p>
                )}
                {live && !loading && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
                    <Info className="w-3 h-3" /> Live
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-200/40 dark:hover:bg-white/5 transition shrink-0"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function FieldGrid({ fields }: { fields: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(({ label, value }) => (
        <div key={label} className="rounded-xl p-3 bg-slate-100/60 dark:bg-white/5 border border-slate-200/40 dark:border-white/5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">{label}</div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 break-all">{value}</div>
        </div>
      ))}
    </div>
  );
}

function TaskContentBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">{label}</div>
      <p className="p-3 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
        {text}
      </p>
    </div>
  );
}
function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">{label}</div>
      <pre className="p-3 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
        {formatJsonPreview(value)}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local TaskManager detail (Task Queue tab)
// ---------------------------------------------------------------------------

interface LocalProps {
  task: LocalTaskDetail | null;
  /** Optional linked Laravel global task (remote_translation). */
  remoteTask?: PycoreGlobalTaskDetail | null;
  remoteError?: string | null;
  laravelReachable?: boolean | null;
  loading?: boolean;
  remoteLoading?: boolean;
  onClose: () => void;
}

export const PcLocalTaskDetailModal: React.FC<LocalProps> = ({
  task, remoteTask, remoteError, laravelReachable, loading, remoteLoading, onClose,
}) => {
  const [liveTask, setLiveTask] = useState<LocalTaskDetail | null>(task);

  useEffect(() => {
    setLiveTask(task);
  }, [task]);

  const refreshLiveTask = useCallback(async () => {
    if (!liveTask || liveTask.status !== 'processing') return;
    try {
      const r = await pycoreApi.getLocalTaskDetail(liveTask.task_id);
      if (r?.success && r.task) setLiveTask(r.task);
    } catch {
      // keep last snapshot
    }
  }, [liveTask]);

  useEffect(() => { void refreshLiveTask(); }, [refreshLiveTask]);
  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.operationChanged],
    refreshLiveTask,
    { fallbackMs: liveTask?.status === 'processing' ? 15_000 : 0, enabled: liveTask?.status === 'processing' },
  );

  if (!liveTask) return null;
  const merged = mergeTaskResultSources(
    liveTask.input_data as Record<string, unknown> | undefined,
    liveTask.result as Record<string, unknown> | undefined,
  );
  const remoteJobId = resolveRemoteTaskId(
    liveTask.input_data as Record<string, unknown> | undefined,
    liveTask.result as Record<string, unknown> | undefined,
  );
  const laravelRemoteId = isLaravelGlobalTaskId(remoteJobId) ? remoteJobId : null;
  const sentenceJobId = isSentenceQueueJobId(remoteJobId) ? remoteJobId : null;
  const taskWorker = resolveTaskWorker(
    liveTask.input_data as Record<string, unknown> | undefined,
    liveTask.result as Record<string, unknown> | undefined,
  );
  const remotePayload = remoteTask?.payload && typeof remoteTask.payload === 'object'
    ? remoteTask.payload as Record<string, unknown>
    : null;
  const taskContent = mergeTaskContentSources(liveTask.input_data, remotePayload);
  const audioPath = extractAudioPath(merged);
  const engine = extractEngine(merged);
  const synthCommand = extractSynthCommand(merged);
  const isProcessing = liveTask.status === 'processing';

  return (
    <ModalShell
      title="Task detail"
      subtitle={liveTask.task_id}
      loading={loading}
      live={!!liveTask && !loading}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Status</div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${statusCls(liveTask.status)}`}>
              {liveTask.status}
            </span>
            <div className="flex-1"><ProgressBar progress={liveTask.progress} status={liveTask.status} /></div>
          </div>
        </div>

        <FieldGrid fields={[
          { label: 'Type', value: liveTask.task_type },
          { label: 'Created', value: formatDateTime(liveTask.created_at) },
          { label: 'Updated', value: formatDateTime(liveTask.updated_at) },
          ...(liveTask.estimated_time != null
            ? [{ label: 'Est. time', value: `${liveTask.estimated_time}s` }]
            : []),
          ...(laravelRemoteId ? [{ label: 'Laravel task ID', value: laravelRemoteId }] : []),
          ...(sentenceJobId != null ? [{ label: 'Sentence queue job', value: String(sentenceJobId) }] : []),
          ...(taskWorker ? [{ label: 'Worker', value: taskWorker }] : []),
        ]} />

        <TaskContentBlock label="Task content" text={taskContent} />

        {(engine || synthCommand || isProcessing) && (
          <PcTaskSynthInfo engine={engine} synthCommand={synthCommand} processing={isProcessing} />
        )}

        {audioPath && (
          <PcTaskAudioPreview audioPath={audioPath} label="Generated audio" />
        )}

        <JsonBlock label="Input (raw)" value={liveTask.input_data} />

        {liveTask.error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-rose-500 mb-1">Error</div>
            <div className="text-sm font-mono text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-all">{liveTask.error}</div>
          </div>
        )}

        <JsonBlock label="Result" value={liveTask.result ?? '—'} />

        {laravelRemoteId && (
          <div className="pt-2 border-t border-slate-200/40 dark:border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Laravel global task</span>
              {remoteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />}
            </div>
            {remoteTask ? (
              <>
                <FieldGrid fields={[
                  { label: 'App', value: remoteTask.app_name },
                  { label: 'Task type', value: remoteTask.task_type },
                  { label: 'Execution', value: remoteTask.execution_type },
                  { label: 'Assigned to', value: remoteTask.assigned_to || '—' },
                ]} />
                <JsonBlock label="Payload" value={remoteTask.payload} />
                <JsonBlock label="Remote result" value={remoteTask.result ?? '—'} />
                {remoteTask.error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm font-mono text-rose-600 dark:text-rose-400">
                    {remoteTask.error}
                  </div>
                )}
              </>
            ) : !remoteLoading && (
              <div className="text-xs text-slate-500 space-y-1">
                <p>{remoteError || 'Remote task detail unavailable.'}</p>
                {laravelReachable === false && (
                  <p className="text-amber-600 dark:text-amber-400">
                    Laravel unreachable — check LARAVEL_WORKER_API_URL / laravel_api endpoints in pycore.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {sentenceJobId != null && !laravelRemoteId && (
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-200/40 dark:border-white/5">
            Sentence-library queue job #{String(sentenceJobId)} — not a Laravel <code className="font-mono">global_tasks</code> row.
            See the Sentence Audio tab for queue status.
          </p>
        )}
      </div>
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Laravel global_tasks detail (Translation Queue tab)
// ---------------------------------------------------------------------------

interface GlobalProps {
  task: PycoreGlobalTaskDetail | null;
  loading?: boolean;
  onClose: () => void;
}

export const PcGlobalTaskDetailModal: React.FC<GlobalProps> = ({ task, loading, onClose }) => {
  if (!task) return null;
  const payload = task.payload && typeof task.payload === 'object'
    ? task.payload as Record<string, unknown>
    : null;
  const taskContent = extractTaskContentSummary(payload);

  return (
    <ModalShell
      title="Translation task detail"
      subtitle={task.task_id}
      loading={loading}
      live={!!task && !loading}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Status</div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${statusCls(task.status)}`}>
              {task.status}
            </span>
            <div className="flex-1"><ProgressBar progress={task.progress} status={task.status} /></div>
          </div>
        </div>

        <FieldGrid fields={[
          { label: 'App', value: task.app_name },
          { label: 'Task type', value: task.task_type },
          { label: 'Execution', value: task.execution_type },
          { label: 'Assigned to', value: task.assigned_to || '—' },
          { label: 'Created', value: formatDateTime(task.created_at) },
          { label: 'Updated', value: formatDateTime(task.updated_at) },
          ...(task.priority !== undefined ? [{ label: 'Priority', value: String(task.priority) }] : []),
          ...(task.retry_count !== undefined
            ? [{ label: 'Retries', value: `${task.retry_count} / ${task.max_retries ?? '—'}` }]
            : []),
          ...(task.completed_at ? [{ label: 'Completed', value: formatDateTime(task.completed_at) }] : []),
        ]} />

        {taskContent !== '—' && (
          <TaskContentBlock label="Task content" text={taskContent} />
        )}

        {task.payload !== undefined && task.payload !== null && (
          <JsonBlock label="Payload (raw)" value={task.payload} />
        )}

        {task.error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-rose-500 mb-1">Error</div>
            <div className="text-sm font-mono text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-all">{task.error}</div>
          </div>
        )}

        <JsonBlock label="Result" value={task.result ?? '—'} />
      </div>
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Voice-subtitle queue item detail (Queue Manager tab)
// ---------------------------------------------------------------------------

interface QueueItemProps {
  item: QueueItem | null;
  isCurrent?: boolean;
  onClose: () => void;
}

export const PcQueueItemDetailModal: React.FC<QueueItemProps> = ({ item, isCurrent, onClose }) => {
  if (!item) return null;

  return (
    <ModalShell
      title="Queue item detail"
      subtitle={`#${item.index}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <FieldGrid fields={[
          { label: 'Index', value: String(item.index) },
          { label: 'Category', value: item.category },
          { label: 'Status', value: item.status.toUpperCase() },
          { label: 'Play count', value: String(item.playCount) },
          { label: 'Created', value: item.created ? formatDateTime(item.created) : '—' },
          ...(isCurrent ? [{ label: 'Position', value: 'Current (playing next)' }] : []),
          ...(item.metadata?.lang ? [{ label: 'Language', value: item.metadata.lang }] : []),
          ...(item.metadata?.ai ? [{ label: 'AI source', value: item.metadata.ai }] : []),
        ]} />

        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Text / content</div>
          <p className="p-3 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
            {item.text || '—'}
          </p>
        </div>

        {item.audioUrl && (
          <div>
            <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Audio</div>
            <PcBlobAudio controls className="w-full" path={item.audioUrl} />
          </div>
        )}

        {item.metadata && Object.keys(item.metadata).length > 0 && (
          <JsonBlock label="Metadata" value={item.metadata} />
        )}
      </div>
    </ModalShell>
  );
};
