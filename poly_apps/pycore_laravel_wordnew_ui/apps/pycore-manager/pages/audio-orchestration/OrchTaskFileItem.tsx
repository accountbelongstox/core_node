/**
 * One generated file of a task: kind icon, name, size and the three actions
 * Play (inline player, loaded on click), Download (same file name) and Open
 * folder. A file above the browser buffer limit only offers Open folder.
 */
import React, { useState } from 'react';
import { Download, FileAudio, FileVideo, FolderOpen, Loader2, Play, X } from 'lucide-react';
import type { OrchTaskFile } from '@/apps/pycore-manager/api';
import { humanBytes } from '../vocabulary/vocabShared';
import OrchFilePlayer from './OrchFilePlayer';
import { ORCH_L } from './orchShared';
import { ORCH_SMALL_BUTTON_CLASS } from './orchStyles';
import { orchFileIsVideo } from './orchTaskFileCache';
import { useOrchTaskFile } from './useOrchTaskFile';

const OrchTaskFileItem: React.FC<{
  taskId: string;
  file: OrchTaskFile;
  onOpenFolder: () => void;
  /** Show the modified time next to the size (the plain file list does; segment rows do not). */
  showModified?: boolean;
}> = ({ taskId, file, onOpenFolder, showModified = false }) => {
  const [playing, setPlaying] = useState(false);
  const { state, tooLarge, download } = useOrchTaskFile(taskId, file);
  const video = orchFileIsVideo(file);
  const Icon = video ? FileVideo : FileAudio;
  const downloading = state.status === 'loading' && !playing;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-slate-400">
        <span title={video ? ORCH_L.fileKindVideo : ORCH_L.fileKindAudio} className="shrink-0">
          <Icon className={`w-3.5 h-3.5 ${video ? 'text-amber-300' : 'text-teal-300'}`} />
        </span>
        <span>{file.name}</span>
        <span className="text-slate-500">
          {humanBytes(file.bytes)}{showModified ? ` · ${new Date(file.modified_at * 1000).toLocaleString()}` : ''}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-sans" role="group" aria-label={ORCH_L.fileActions}>
          {!tooLarge && (
            <>
              <button type="button" onClick={() => setPlaying((value) => !value)} className={ORCH_SMALL_BUTTON_CLASS}>
                {playing ? <X className="w-3 h-3" /> : <Play className="w-3 h-3" />} {playing ? ORCH_L.fileHidePlayer : ORCH_L.filePlay}
              </button>
              <button type="button" onClick={() => void download()} disabled={downloading} className={ORCH_SMALL_BUTTON_CLASS}>
                {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} {ORCH_L.fileDownload}
              </button>
            </>
          )}
          <button type="button" onClick={onOpenFolder} className={ORCH_SMALL_BUTTON_CLASS}>
            <FolderOpen className="w-3 h-3" /> {ORCH_L.openFolder}
          </button>
        </span>
      </div>
      {tooLarge && <p className="text-[11px] text-amber-400">{ORCH_L.fileTooLarge}</p>}
      {downloading && state.total > 0 && (
        <p className="text-[10px] font-mono text-indigo-300">
          {ORCH_L.fileLoading} {Math.round((state.loaded / state.total) * 100)}%
        </p>
      )}
      {!playing && state.status === 'error' && !tooLarge && <p className="text-[11px] text-rose-400">{state.error}</p>}
      {playing && <OrchFilePlayer taskId={taskId} file={file} />}
    </div>
  );
};

export default OrchTaskFileItem;
