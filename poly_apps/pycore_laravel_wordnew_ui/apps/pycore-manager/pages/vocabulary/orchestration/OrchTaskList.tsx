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
  type OrchTask,
  type OrchTaskFile,
  type OrchTaskSummary,
} from '@/apps/pycore-manager/api';
import { humanBytes, humanInt } from '../vocabShared';
import { ORCH_L } from './orchShared';

function statusBadgeClass(status: string | undefined, running: boolean | undefined): string {
  if (running || status === 'generating') return 'bg-indigo-500/15 text-indigo-400';
  if (status === 'done') return 'bg-emerald-500/15 text-emerald-400';
  if (status === 'failed') return 'bg-rose-500/15 text-rose-400';
  return 'bg-slate-500/15 text-slate-400';
}

const OrchTaskDetail: React.FC<{ taskId: string }> = ({ taskId }) => {
  const [detail, setDetail] = useState<OrchTask | null>(null);
  const [files, setFiles] = useState<OrchTaskFile[]>([]);
  const [outputDir, setOutputDir] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [task, fileList] = await Promise.all([
        pycoreApi.orchTaskGet(taskId),
        pycoreApi.orchTaskFiles(taskId),
      ]);
      if (cancelled) return;
      if (task.success) setDetail(task);
      if (fileList.success) {
        setFiles(fileList.files || []);
        setOutputDir(fileList.output_dir || '');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [taskId]);

  const events = detail?.events || [];

  return (
    <div className="mt-2 space-y-2 border-t border-slate-700/60 pt-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.files} ({files.length})</p>
        <button
          type="button"
          onClick={() => void pycoreApi.orchOpenOutput(taskId)}
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
  const remove = async (taskId: string) => {
    if (!window.confirm(ORCH_L.confirmDelete)) return;
    await pycoreApi.orchTaskDelete(taskId);
    onChanged();
  };

  const cancel = async (taskId: string) => {
    await pycoreApi.orchTaskCancel(taskId);
    onChanged();
  };

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-slate-200">{ORCH_L.tasksTitle}</h3>
      {tasks.length === 0 && <p className="text-xs text-slate-500">{ORCH_L.noTasks}</p>}
      <div className="space-y-2">
        {tasks.map((task) => {
          const progress = task.progress || {};
          const pct = task.segments_total
            ? Math.round(((task.segments_done || 0) / task.segments_total) * 100)
            : 0;
          const expanded = selectedTaskId === task.task_id;
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
                      ? `${task.segment_value} min`
                      : `${task.segment_value} ${ORCH_L.segments}`}
                    {' · '}{task.word_mode === 'new_only' ? ORCH_L.wordModeNewOnly : ORCH_L.wordModeAll}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(task.status, task.running)}`}>
                  {task.running ? ORCH_L.generating : (task.status || 'draft')}
                </span>
              </div>
              {(task.running || (task.segments_total || 0) > 0) && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] font-mono text-slate-500">
                    {task.segments_done || 0}/{task.segments_total || 0} {ORCH_L.segments}
                    {progress.item_total ? ` · ${progress.item_index || 0}/${progress.item_total} ${ORCH_L.items}` : ''}
                  </p>
                  {(task.running || progress.missing) && (
                    <p className="text-[10px] font-mono text-slate-500">
                      {ORCH_L.manifestCache} {humanInt(progress.cache_hits)}
                      {' · '}{ORCH_L.manifestLaravel} {humanInt(progress.laravel_hits)}
                      {' · '}{ORCH_L.manifestGenerated} {humanInt(progress.generated)}
                      {' · '}<span className={progress.missing ? 'text-amber-400' : ''}>{ORCH_L.manifestMissing} {humanInt(progress.missing)}</span>
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
              {expanded && <OrchTaskDetail taskId={task.task_id} />}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default OrchTaskList;
