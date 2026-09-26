/**
 * Orchestration task list: one row per task (multiple tasks per book allowed)
 * with live preparation-manifest counters (cache / Laravel / generated /
 * missing + current item), and an expandable detail showing the generated
 * files and the per-task generation log. Running tasks are polled by the
 * parent tab (VocabAudioOrchTab).
 */
import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FolderOpen, Loader2, Pencil, Play, Trash2, XCircle } from 'lucide-react';
import {
  pycoreApi,
  type OrchManifestCategory,
  type OrchTask,
  type OrchTaskFile,
  type OrchTaskSummary,
} from '@/apps/pycore-manager/api';
import { humanBytes, humanInt, VocabBanner } from '../vocabShared';
import OrchManifestPanel from './OrchManifestPanel';
import OrchTaskLaneProgress from './OrchTaskLaneProgress';
import { ORCH_L, orchErrorMessage } from './orchShared';

function statusBadgeClass(status: string | undefined, running: boolean | undefined): string {
  if (running || status === 'generating') return 'bg-indigo-500/15 text-indigo-400';
  if (status === 'done') return 'bg-emerald-500/15 text-emerald-400';
  if (status === 'failed') return 'bg-rose-500/15 text-rose-400';
  return 'bg-slate-500/15 text-slate-400';
}

const OrchTaskDetail: React.FC<{ taskId: string; running: boolean }> = ({ taskId, running }) => {
  const [detail, setDetail] = useState<OrchTask | null>(null);
  const [files, setFiles] = useState<OrchTaskFile[]>([]);
  const [outputDir, setOutputDir] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [task, fileList] = await Promise.all([
          pycoreApi.orchTaskGet(taskId),
          pycoreApi.orchTaskFiles(taskId),
        ]);
        if (cancelled) return;
        if (!task.success || !fileList.success) throw new Error(task.error || fileList.error || ORCH_L.loadFailed);
        setDetail(task);
        setFiles(fileList.files || []);
        setOutputDir(fileList.output_dir || '');
        setError(null);
      } catch (e) {
        if (!cancelled) setError(orchErrorMessage(e, ORCH_L.loadFailed));
      } finally {
        loading = false;
      }
    };
    const timer = running ? setInterval(() => void load(), 3000) : null;
    void load();
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [taskId, running]);

  const openFolder = async () => {
    try {
      const response = await pycoreApi.orchOpenOutput(taskId);
      if (!response.success) throw new Error(ORCH_L.actionFailed);
    } catch (e) {
      setError(orchErrorMessage(e));
    }
  };

  const events = detail?.events || [];

  return (
    <div className="mt-2 space-y-2 border-t border-slate-700/60 pt-2" onClick={(e) => e.stopPropagation()}>
      {error && <VocabBanner kind="error" message={error} />}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.files} ({files.length})</p>
        <button
          type="button"
          onClick={() => void openFolder()}
          className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-sky-500/50"
        >
          <FolderOpen className="w-3 h-3" /> {ORCH_L.openFolder}
        </button>
      </div>
      {outputDir && <p className="text-[10px] font-mono text-slate-500 break-all">{outputDir}</p>}
      {files.length === 0 && <p className="text-[11px] text-slate-500">{ORCH_L.noFiles}</p>}
      {files.map((file) => (
        <p key={file.name} className="text-[11px] font-mono text-slate-400">
          {file.name} · {humanBytes(file.bytes)} · {new Date(file.modified_at * 1000).toLocaleString()}
        </p>
      ))}
      <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.logTitle}</p>
      {events.length === 0 && <p className="text-[11px] text-slate-500">{ORCH_L.noLog}</p>}
      <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-950/60 border border-slate-800 p-2 space-y-0.5">
        {events.map((event, index) => (
          <p key={index} className="text-[10px] font-mono text-slate-500">
            {new Date(event.ts * 1000).toLocaleTimeString()} · {event.message}
          </p>
        ))}
      </div>
    </div>
  );
};

const OrchTaskList: React.FC<{
  tasks: OrchTaskSummary[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onGenerate: (taskId: string) => void;
  onChanged: () => void;
}> = ({ tasks, selectedTaskId, onSelect, onEdit, onGenerate, onChanged }) => {
  const [error, setError] = useState<string | null>(null);
  const [manifestView, setManifestView] = useState<{
    taskId: string;
    name: string;
    category: OrchManifestCategory;
    running: boolean;
  } | null>(null);
  const remove = async (taskId: string) => {
    if (!window.confirm(ORCH_L.confirmDelete)) return;
    setError(null);
    try {
      const response = await pycoreApi.orchTaskDelete(taskId);
      if (!response.success) throw new Error(response.error || ORCH_L.actionFailed);
      onChanged();
    } catch (e) {
      setError(orchErrorMessage(e));
    }
  };

  const cancel = async (taskId: string) => {
    setError(null);
    try {
      const response = await pycoreApi.orchTaskCancel(taskId);
      if (!response.success) throw new Error(response.error || ORCH_L.actionFailed);
      onChanged();
    } catch (e) {
      setError(orchErrorMessage(e));
    }
  };

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-slate-200">{ORCH_L.tasksTitle}</h3>
      {error && <VocabBanner kind="error" message={error} />}
      {tasks.length === 0 && <p className="text-xs text-slate-500">{ORCH_L.noTasks}</p>}
      <div className="space-y-2">
        {tasks.map((task) => {
          const progress = task.progress || {};
          const pct = task.segments_total
            ? Math.round(((task.segments_done || 0) / task.segments_total) * 100)
            : 0;
          const phaseLabel = progress.phase === 'sync' ? ORCH_L.syncing
            : progress.phase === 'manifest' ? ORCH_L.phaseManifest
            : progress.phase === 'resources' ? ORCH_L.phaseResources
            : progress.phase === 'assemble' ? ORCH_L.phaseAssemble
            : progress.phase === 'done' ? ORCH_L.phaseDone : '';
          const resourcePct = progress.resource_total
            ? Math.round(((progress.resource_index || 0) / progress.resource_total) * 100)
            : 0;
          const expanded = selectedTaskId === task.task_id;
          // Lanes where this task filled Part1 (missing words / sentences).
          const fillLanes = (['word_audio', 'sentence_audio'] as const).filter(
            (lane) => (progress.lanes?.[lane]?.total || 0) > 0,
          );
          return (
            <div
              key={task.task_id}
              onClick={() => onSelect(task.task_id)}
              className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                expanded
                  ? 'border-sky-500 bg-sky-500/5'
                  : 'border-slate-700/60 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">{task.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {task.book?.title || task.book?.source_key} · {task.segment_mode === 'minutes'
                      ? `${task.segment_value} ${ORCH_L.minutesUnit}`
                      : `${task.segment_value} ${ORCH_L.segments}`}
                    {' · '}{task.word_mode === 'new_only' ? ORCH_L.wordModeNewOnly : ORCH_L.wordModeAll}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(task.status, task.running)}`}>
                  {task.running ? ORCH_L.generating : ORCH_L[task.status as keyof typeof ORCH_L] || task.status || ORCH_L.draft}
                </span>
              </div>
              {(task.running || (task.segments_total || 0) > 0) && (
                <div className="mt-2 space-y-1">
                  {phaseLabel && (task.running || progress.phase === 'done') && (
                    <p className="text-[10px] font-mono text-indigo-300">{phaseLabel}</p>
                  )}
                  {task.running && progress.phase === 'resources' && (progress.resource_total || 0) > 0 && (
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${resourcePct}%` }} />
                    </div>
                  )}
                  {progress.phase === 'resources' && (progress.resource_total || 0) > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setManifestView({ taskId: task.task_id, name: task.name, category: 'all', running: Boolean(task.running) });
                      }}
                      className="text-[10px] font-mono text-slate-500 hover:text-sky-400 hover:underline underline-offset-2"
                    >
                      {progress.resource_index || 0}/{progress.resource_total || 0} {ORCH_L.items} · {ORCH_L.manifestScope}
                    </button>
                  )}
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] font-mono text-slate-500">
                    {task.segments_done || 0}/{task.segments_total || 0} {ORCH_L.segments}
                    {progress.item_total ? ` · ${progress.item_index || 0}/${progress.item_total} ${ORCH_L.items}` : ''}
                  </p>
                  {(task.running || progress.phase === 'done' || progress.missing || progress.sync_pending) && (
                    <p className="text-[10px] font-mono text-slate-500">
                      <span className="text-slate-600">{ORCH_L.manifestScope}: </span>
                      {([
                        ['cache', ORCH_L.manifestCache, progress.cache_hits],
                        ['laravel', ORCH_L.manifestLaravel, progress.laravel_hits],
                        ['generated', ORCH_L.manifestGenerated, progress.generated],
                        ['synced', ORCH_L.manifestSynced, progress.synced],
                      ] as Array<[OrchManifestCategory, string, number | undefined]>).map(([cat, label, value]) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManifestView({ taskId: task.task_id, name: task.name, category: cat, running: Boolean(task.running) });
                          }}
                          className="hover:text-sky-400 hover:underline underline-offset-2"
                        >
                          {label} {humanInt(value)}
                        </button>
                      )).reduce<React.ReactNode[]>((acc, node) => (acc.length ? [...acc, ' · ', node] : [node]), [])}
                      {progress.sync_pending ? ` · ${ORCH_L.syncingNow} ${humanInt(progress.sync_pending)}` : ''}
                      {' · '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setManifestView({ taskId: task.task_id, name: task.name, category: 'missing', running: Boolean(task.running) });
                        }}
                        className={`hover:text-sky-400 hover:underline underline-offset-2 ${progress.missing ? 'text-amber-400' : ''}`}
                      >
                        {ORCH_L.manifestMissing} {humanInt(progress.missing)}
                      </button>
                    </p>
                  )}
                  {task.running && progress.current_item && (
                    <p className="text-[10px] font-mono text-slate-400 truncate">{progress.current_item}</p>
                  )}
                  {progress.message && (
                    <p className="text-[10px] font-mono text-slate-500">{progress.message}</p>
                  )}
                </div>
              )}
              <OrchTaskLaneProgress
                taskId={task.task_id}
                active={fillLanes.length > 0 && Boolean(task.running || expanded)}
                compact={!expanded}
                lanes={[...fillLanes]}
              />
              {progress.output_dir && (
                <p className="mt-1 text-[10px] font-mono text-slate-500 break-all">
                  {ORCH_L.outputDir}: {progress.output_dir}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onEdit(task.task_id)}
                  disabled={task.running}
                  className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-sky-500/50 disabled:opacity-40"
                >
                  <Pencil className="w-3 h-3" /> {task.status === 'done' || task.status === 'failed' ? ORCH_L.regenerate : ORCH_L.edit}
                </button>
                {task.running ? (
                  <button
                    type="button"
                    onClick={() => void cancel(task.task_id)}
                    className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-amber-400 hover:border-amber-500/50"
                  >
                    <XCircle className="w-3 h-3" /> {ORCH_L.cancel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGenerate(task.task_id)}
                    className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-sky-500/50"
                  >
                    <Play className="w-3 h-3" /> {ORCH_L.generate}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(task.task_id)}
                  disabled={task.running}
                  className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-rose-400 hover:border-rose-500/50 disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" /> {ORCH_L.delete}
                </button>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expanded ? ORCH_L.hideDetails : ORCH_L.details}
                </span>
                {task.running && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              </div>
              {expanded && <OrchTaskDetail taskId={task.task_id} running={Boolean(task.running || task.status === 'generating')} />}
            </div>
          );
        })}
      </div>
      {manifestView && (
        <OrchManifestPanel
          open
          taskId={manifestView.taskId}
          taskName={manifestView.name}
          initialCategory={manifestView.category}
          running={manifestView.running}
          onClose={() => setManifestView(null)}
        />
      )}
    </section>
  );
};

export default OrchTaskList;
