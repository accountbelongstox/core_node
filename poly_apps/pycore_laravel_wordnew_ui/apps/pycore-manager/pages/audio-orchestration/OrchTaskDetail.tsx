/**
 * Expanded part of an orchestration task row: the task's output settings
 * (output mode / video style, saved on change), the source-specific detail,
 * the generated files (audio and video, with kind icons), per-segment video
 * state, segment timing and the coded generation log. Live-refreshes while the
 * task runs.
 */
import React, { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import {
  pycoreApi,
  type OrchTask,
  type OrchTaskFile,
  type OrchVideoPreset,
} from '@/apps/pycore-manager/api';
import { VocabBanner } from '../vocabulary/vocabShared';
import OrchSegmentVideos from './OrchSegmentVideos';
import { OrchSegmentTiming } from './OrchRunTiming';
import OrchSourceDetail from './OrchSourceDetail';
import OrchTaskFileItem from './OrchTaskFileItem';
import OrchTaskOutputFields, { type OrchTaskOutputValue } from './OrchTaskOutputFields';
import { ORCH_L, orchCodedMessage, orchErrorMessage } from './orchShared';
import { orchTaskOutputMode } from './orchSources';
import { ORCH_SMALL_BUTTON_CLASS } from './orchStyles';

const DETAIL_POLL_MS = 3000;

const OrchTaskDetail: React.FC<{
  taskId: string;
  running: boolean;
  presets: OrchVideoPreset[];
  activePresetId: string;
  onChanged: () => void;
}> = ({ taskId, running, presets, activePresetId, onChanged }) => {
  const [detail, setDetail] = useState<OrchTask | null>(null);
  const [files, setFiles] = useState<OrchTaskFile[]>([]);
  const [outputDir, setOutputDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<OrchTaskOutputValue | null>(null);

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
    const timer = running ? setInterval(() => void load(), DETAIL_POLL_MS) : null;
    void load();
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [taskId, running, revision]);

  const openFolder = async () => {
    try {
      const response = await pycoreApi.orchOpenOutput(taskId);
      if (!response.success) throw new Error(ORCH_L.actionFailed);
    } catch (e) {
      setError(orchErrorMessage(e));
    }
  };

  const saveOutput = async (value: OrchTaskOutputValue) => {
    setPending(value);
    setError(null);
    try {
      const response = await pycoreApi.orchTaskUpdate(taskId, { output_mode: value.outputMode, video_preset: value.videoPreset });
      if (!response.success) throw response;
      setRevision((current) => current + 1);
      onChanged();
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.saveFailed));
    } finally {
      setPending(null);
    }
  };

  const events = detail?.events || [];
  const outputValue: OrchTaskOutputValue = pending || {
    outputMode: orchTaskOutputMode(detail),
    videoPreset: detail?.video_preset || '',
  };

  return (
    <div className="mt-2 space-y-2 border-t border-slate-700/60 pt-2" onClick={(e) => e.stopPropagation()}>
      {error && <VocabBanner kind="error" message={error} />}
      {detail && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.taskSettings}</p>
          <OrchTaskOutputFields
            value={outputValue}
            presets={presets}
            activePresetId={activePresetId}
            disabled={running || pending !== null}
            onChange={(value) => void saveOutput(value)}
          />
        </div>
      )}
      <OrchSourceDetail task={detail} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.files} ({files.length})</p>
        <button type="button" onClick={() => void openFolder()} className={ORCH_SMALL_BUTTON_CLASS}>
          <FolderOpen className="w-3 h-3" /> {ORCH_L.openFolder}
        </button>
      </div>
      {outputDir && <p className="text-[10px] font-mono text-slate-500 break-all">{outputDir}</p>}
      {files.length === 0 && <p className="text-[11px] text-slate-500">{ORCH_L.noFiles}</p>}
      {files.map((file) => (
        <OrchTaskFileItem key={file.name} taskId={taskId} file={file} onOpenFolder={() => void openFolder()} showModified />
      ))}
      <OrchSegmentVideos taskId={taskId} segments={detail?.segments || []} files={files} onOpenFolder={() => void openFolder()} />
      <OrchSegmentTiming segments={detail?.segments || []} />
      <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.logTitle}</p>
      {events.length === 0 && <p className="text-[11px] text-slate-500">{ORCH_L.noLog}</p>}
      <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-950/60 border border-slate-800 p-2 space-y-0.5">
        {events.map((event, index) => (
          <p key={index} className="text-[10px] font-mono text-slate-500">
            {new Date(event.ts * 1000).toLocaleTimeString()} · {orchCodedMessage(event.code, event.params, event.message)}
          </p>
        ))}
      </div>
    </div>
  );
};

export default OrchTaskDetail;
