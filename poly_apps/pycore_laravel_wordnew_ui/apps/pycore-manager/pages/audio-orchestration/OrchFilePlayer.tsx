/**
 * Inline player of one generated file: loads it on mount (the parent mounts it
 * on click, never on render) with a progress indicator, then shows a native
 * audio control (mp3) or a 16:9 video control (mp4).
 */
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { OrchTaskFile } from '@/apps/pycore-manager/api';
import { humanBytes } from '../vocabulary/vocabShared';
import { ORCH_L } from './orchShared';
import { orchFileIsVideo } from './orchTaskFileCache';
import { useOrchTaskFile } from './useOrchTaskFile';

const OrchFilePlayer: React.FC<{ taskId: string; file: OrchTaskFile }> = ({ taskId, file }) => {
  const { state, tooLarge, load } = useOrchTaskFile(taskId, file);

  useEffect(() => {
    if (!tooLarge) void load();
  }, [tooLarge, load]);

  if (tooLarge) return <p className="text-[11px] text-amber-400">{ORCH_L.fileTooLarge}</p>;
  if (state.status === 'error') return <p className="text-[11px] text-rose-400">{state.error}</p>;
  if (state.status !== 'ready') {
    const percent = state.total ? Math.min(100, Math.round((state.loaded / state.total) * 100)) : 0;
    return (
      <div className="space-y-1" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <p className="flex items-center gap-1.5 text-[11px] text-indigo-300">
          <Loader2 className="w-3 h-3 animate-spin" /> {ORCH_L.fileLoading} {percent}%
          {state.total > 0 && <span className="font-mono text-slate-500">({humanBytes(state.loaded)} / {humanBytes(state.total)})</span>}
        </p>
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }
  return orchFileIsVideo(file)
    ? <video controls autoPlay src={state.url} className="w-full max-w-2xl aspect-video rounded-lg bg-black" />
    : <audio controls autoPlay src={state.url} className="w-full max-w-2xl" />;
};

export default OrchFilePlayer;
