/**
 * One orchestration task row: source / output-mode / queue badges, progress
 * (phase, manifest counters, lanes, video counters), and the actions. Pycore's
 * queue starts tasks by itself, so the only manual start is the de-emphasized
 * Regenerate (a forced fresh run); Render videos re-renders a finished video
 * task from its stored audio.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileVideo, Loader2, Pencil, Play, RotateCcw, Trash2, XCircle } from 'lucide-react';
import {
  pycoreApi,
  type OrchManifestCategory,
  type OrchTaskFile,
  type OrchTaskSummary,
  type OrchVideoPreset,
} from '@/apps/pycore-manager/api';
import { humanInt } from '../vocabulary/vocabShared';
import OrchAutoGenerateSwitch from './OrchAutoGenerateSwitch';
import OrchFilePlayer from './OrchFilePlayer';
import OrchRunTiming from './OrchRunTiming';
import OrchTaskDetail from './OrchTaskDetail';
import OrchTaskLaneProgress from './OrchTaskLaneProgress';
import { OrchOutputBadge, OrchQueueChip, OrchVideoCounters } from './OrchTaskBadges';
import { OrchTaskOutputDelivery } from './OrchDeliveryStatus';
import { ORCH_L, ORCH_PHASE_LABELS, orchCodedMessage, orchErrorMessage } from './orchShared';
import { orchSourcePresentation, orchTaskOutputMode, orchTaskSource, orchTaskUsesBook } from './orchSources';
import { ORCH_QUIET_BUTTON_CLASS, ORCH_SMALL_BUTTON_CLASS } from './orchStyles';
import { orchFileIsVideo } from './orchTaskFileCache';
import { PC_AUDIO_LANES } from '../../utils/pcAudioLanes';

/** The file a quick Play starts: the first segment of the task's own output kind, else the other kind. */
function firstPlayableFile(files: OrchTaskFile[], wantsVideo: boolean): OrchTaskFile | null {
  const preferred = files.find((file) => orchFileIsVideo(file) === wantsVideo);
  return preferred || files[0] || null;
}

function statusBadgeClass(status: string | undefined, running: boolean | undefined): string {
  if (running || status === 'generating') return 'bg-indigo-500/15 text-indigo-400';
  if (status === 'done') return 'bg-emerald-500/15 text-emerald-400';
  if (status === 'failed') return 'bg-rose-500/15 text-rose-400';
  return 'bg-slate-500/15 text-slate-400';
}

const OrchTaskRow: React.FC<{
  task: OrchTaskSummary;
  expanded: boolean;
  presets: OrchVideoPreset[];
  activePresetId: string;
  onSelect: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onRegenerate: (taskId: string) => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
  onShowManifest: (task: OrchTaskSummary, category: OrchManifestCategory) => void;
}> = ({ task, expanded, presets, activePresetId, onSelect, onEdit, onRegenerate, onChanged, onError, onShowManifest }) => {
  const [quickFile, setQuickFile] = useState<OrchTaskFile | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const progress = task.progress || {};
  const pct = task.segments_total
    ? Math.round(((task.segments_done || 0) / task.segments_total) * 100)
    : 0;
  const phaseLabel = progress.phase ? ORCH_PHASE_LABELS[progress.phase] : '';
  const resourcePct = progress.resource_total
    ? Math.round(((progress.resource_index || 0) / progress.resource_total) * 100)
    : 0;
  const source = orchSourcePresentation(orchTaskSource(task));
  const usesBook = orchTaskUsesBook(task);
  const canRenderVideos = orchTaskOutputMode(task) === 'video' && task.status === 'done' && !task.running;
  const fillLanes = PC_AUDIO_LANES.filter(
    (lane) => (progress.lanes?.[lane]?.total || 0) > 0,
  );

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, fallback: string) => {
    onError(null);
    try {
      const response = await action();
      if (!response.success) throw response;
      onChanged();
    } catch (e) {
      onError(orchErrorMessage(e, fallback));
    }
  };

  const toggleQuickPlay = async () => {
    if (quickFile) {
      setQuickFile(null);
      return;
    }
    setQuickLoading(true);
    onError(null);
    try {
      const response = await pycoreApi.orchTaskFiles(task.task_id);
      if (!response.success) throw response;
      const file = firstPlayableFile(response.files || [], orchTaskOutputMode(task) === 'video');
      if (!file) onError(ORCH_L.fileNoPlayable);
      setQuickFile(file);
    } catch (e) {
      onError(orchErrorMessage(e, ORCH_L.loadFailed));
    } finally {
      setQuickLoading(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(ORCH_L.confirmDelete)) return;
    await run(() => pycoreApi.orchTaskDelete(task.task_id), ORCH_L.actionFailed);
  };

  return (
    <div
      onClick={() => onSelect(task.task_id)}
      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
        expanded ? 'border-sky-500 bg-sky-500/5' : 'border-slate-700/60 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-200">
            <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.badgeClass}`}>
              <source.Icon className="w-3 h-3" /> {source.label()}
            </span>
            <OrchOutputBadge task={task} />
            <span className="truncate">{task.name}</span>
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {usesBook ? (
              <>
                {task.book?.title || task.book?.source_key} · {task.segment_mode === 'minutes'
                  ? `${task.segment_value} ${ORCH_L.minutesUnit}`
                  : `${task.segment_value} ${ORCH_L.segments}`}
                {' · '}{task.word_mode === 'new_only' ? ORCH_L.wordModeNewOnly : ORCH_L.wordModeAll}
              </>
            ) : (task.created_at ? new Date(task.created_at * 1000).toLocaleString() : '')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <OrchQueueChip task={task} />
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(task.status, task.running)}`}>
            {task.running ? ORCH_L.generating : ORCH_L[task.status as keyof typeof ORCH_L] || task.status || ORCH_L.draft}
          </span>
        </div>
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
              onClick={(e) => { e.stopPropagation(); onShowManifest(task, 'all'); }}
              className="text-[10px] font-mono text-slate-500 hover:text-sky-400 hover:underline underline-offset-2"
            >
              {progress.resource_index || 0}/{progress.resource_total || 0} {ORCH_L.items} · {ORCH_L.manifestScope}
            </button>
          )}
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-[10px] font-mono text-slate-500">
            <span>
              {task.segments_done || 0}/{task.segments_total || 0} {ORCH_L.segments}
              {progress.item_total ? ` · ${progress.item_index || 0}/${progress.item_total} ${ORCH_L.items}` : ''}
            </span>
            <OrchVideoCounters task={task} />
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
                  onClick={(e) => { e.stopPropagation(); onShowManifest(task, cat); }}
                  className="hover:text-sky-400 hover:underline underline-offset-2"
                >
                  {label} {humanInt(value)}
                </button>
              )).reduce<React.ReactNode[]>((acc, node) => (acc.length ? [...acc, ' · ', node] : [node]), [])}
              {progress.sync_pending ? ` · ${ORCH_L.syncingNow} ${humanInt(progress.sync_pending)}` : ''}
              {' · '}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShowManifest(task, 'missing'); }}
                className={`hover:text-sky-400 hover:underline underline-offset-2 ${progress.missing ? 'text-amber-400' : ''}`}
              >
                {ORCH_L.manifestMissing} {humanInt(progress.missing)}
              </button>
            </p>
          )}
          <OrchTaskOutputDelivery counts={progress.output_delivery} />
          {task.running && progress.current_item && (
            <p className="text-[10px] font-mono text-slate-400 truncate">{progress.current_item}</p>
          )}
          {(progress.message_code || progress.message) && (
            <p className="text-[10px] font-mono text-slate-500">
              {orchCodedMessage(progress.message_code, progress.message_params, progress.message)}
            </p>
          )}
        </div>
      )}
      <OrchRunTiming task={task} />
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
      <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {usesBook && (
          <button type="button" onClick={() => onEdit(task.task_id)} disabled={task.running} className={ORCH_SMALL_BUTTON_CLASS}>
            <Pencil className="w-3 h-3" /> {ORCH_L.edit}
          </button>
        )}
        {task.status === 'done' && !task.running && (task.segments_done || 0) > 0 && (
          <button type="button" onClick={() => void toggleQuickPlay()} disabled={quickLoading} className={ORCH_SMALL_BUTTON_CLASS}>
            {quickLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} {quickFile ? ORCH_L.fileHidePlayer : ORCH_L.filePlay}
          </button>
        )}
        {canRenderVideos && (
          <button
            type="button"
            title={ORCH_L.renderVideosHint}
            onClick={() => void run(() => pycoreApi.orchTaskRenderVideo(task.task_id, true), ORCH_L.renderVideosFailed)}
            className={ORCH_SMALL_BUTTON_CLASS}
          >
            <FileVideo className="w-3 h-3" /> {ORCH_L.renderVideos}
          </button>
        )}
        {task.running ? (
          <button
            type="button"
            onClick={() => void run(() => pycoreApi.orchTaskCancel(task.task_id), ORCH_L.actionFailed)}
            className={`${ORCH_SMALL_BUTTON_CLASS} text-amber-400 hover:border-amber-500/50`}
          >
            <XCircle className="w-3 h-3" /> {ORCH_L.cancel}
          </button>
        ) : (
          <button
            type="button"
            title={ORCH_L.regenerateHint}
            onClick={() => onRegenerate(task.task_id)}
            className={ORCH_QUIET_BUTTON_CLASS}
          >
            <RotateCcw className="w-3 h-3" /> {ORCH_L.regenerate}
          </button>
        )}
        <button
          type="button"
          onClick={() => void remove()}
          disabled={task.running}
          className={`${ORCH_SMALL_BUTTON_CLASS} text-rose-400 hover:border-rose-500/50`}
        >
          <Trash2 className="w-3 h-3" /> {ORCH_L.delete}
        </button>
        <OrchAutoGenerateSwitch
          checked={task.auto_generate !== false}
          disabled={task.running}
          onChange={(checked) => void run(() => pycoreApi.orchTaskUpdate(task.task_id, { auto_generate: checked }), ORCH_L.saveFailed)}
        />
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? ORCH_L.hideDetails : ORCH_L.details}
        </span>
        {task.running && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
      </div>
      {quickFile && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <p className="mb-1 text-[10px] font-mono text-slate-500">{quickFile.name}</p>
          <OrchFilePlayer taskId={task.task_id} file={quickFile} />
        </div>
      )}
      {expanded && (
        <OrchTaskDetail
          taskId={task.task_id}
          running={Boolean(task.running || task.status === 'generating')}
          presets={presets}
          activePresetId={activePresetId}
          onChanged={onChanged}
        />
      )}
    </div>
  );
};

export default OrchTaskRow;
