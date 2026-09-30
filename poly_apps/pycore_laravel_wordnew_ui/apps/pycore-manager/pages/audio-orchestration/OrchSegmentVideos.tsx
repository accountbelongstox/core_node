/** Per-segment video render state (status, localized failure, output file) of an expanded task. */
import React from 'react';
import { FileVideo } from 'lucide-react';
import type { OrchSegment, OrchTaskFile, OrchVideoStatus } from '@/apps/pycore-manager/api';
import OrchTaskFileItem from './OrchTaskFileItem';
import { orchBaseName } from './orchVideoSettings';
import { ORCH_L, ORCH_VIDEO_STATUS_LABELS, orchVideoErrorText } from './orchShared';

const STATUS_CLASS: Record<OrchVideoStatus, string> = {
  rendering: 'bg-indigo-500/15 text-indigo-300',
  done: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-rose-500/15 text-rose-400',
  skipped: 'bg-amber-500/15 text-amber-300',
};
const PENDING_CLASS = 'bg-slate-500/15 text-slate-400';

const OrchSegmentVideos: React.FC<{
  taskId: string;
  segments: OrchSegment[];
  files: OrchTaskFile[];
  onOpenFolder: () => void;
}> = ({ taskId, segments, files, onOpenFolder }) => {
  const rows = segments.filter((segment) => segment.status === 'done' || segment.video_status);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-slate-400">{ORCH_L.segmentVideosTitle}</p>
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {rows.map((segment) => {
          const status = segment.video_status || null;
          const videoFile = segment.video_output ? files.find((file) => file.name === orchBaseName(segment.video_output || '')) : undefined;
          return (
            <div key={segment.index} className="space-y-0.5">
              <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-500">
                <FileVideo className="w-3 h-3 shrink-0" />
                segment_{String(segment.index).padStart(3, '0')}
                <span className={`rounded px-1.5 py-0.5 font-sans font-semibold ${status ? STATUS_CLASS[status] : PENDING_CLASS}`}>
                  {status ? ORCH_VIDEO_STATUS_LABELS[status] : ORCH_L.videoStatusPending}
                </span>
                {segment.video_error && <span className="font-sans text-rose-400">{orchVideoErrorText(segment.video_error)}</span>}
              </p>
              {videoFile && <OrchTaskFileItem taskId={taskId} file={videoFile} onOpenFolder={onOpenFolder} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrchSegmentVideos;
