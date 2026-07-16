import React, { useState } from 'react';
import { Play, Pause, Square, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import type { ElementTheme } from '../../WfNewTypes';

interface WfBookReaderPlayBarProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  playing: boolean;
  paused: boolean;
  chapterTitle: string;
  verseRef: string;
  activePos: number;
  chapterCount: number;
  onPlayPause: () => void;
  onStop: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onJumpChapter: (n: number) => void;
}

export const WfBookReaderPlayBar: React.FC<WfBookReaderPlayBarProps> = ({
  activeTheme, trans, playing, paused, chapterTitle, verseRef, activePos, chapterCount,
  onPlayPause, onStop, onPrevChapter, onNextChapter, onJumpChapter,
}) => {
  const [jumpVal, setJumpVal] = useState('');

  const submitJump = () => {
    const n = parseInt(jumpVal, 10);
    if (!Number.isFinite(n) || n < 1) return;
    onJumpChapter(n);
    setJumpVal('');
  };

  return (
    <div className="sticky bottom-0 z-20 -mx-1 px-1 pb-1 pt-2 bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-transparent">
      <div className={`rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl p-3 sm:p-4 ${activeTheme.cardClass}`}>
        <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-zinc-500 uppercase truncate">{chapterTitle}</p>
            <p className="text-sm font-medium text-zinc-100 truncate">
              {verseRef ? trans('reader.nowPlaying', { ref: verseRef }) : trans('reader.ready')}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={1}
              max={chapterCount || 9999}
              value={jumpVal}
              onChange={(e) => setJumpVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitJump(); }}
              placeholder={trans('reader.jumpPlaceholder')}
              className="w-14 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[11px] font-mono text-zinc-300 outline-none"
              aria-label={trans('reader.jumpToChapter')}
            />
            <button type="button" onClick={submitJump} className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-amber-200 cursor-pointer" title={trans('reader.jumpToChapter')}>
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <button type="button" onClick={onPrevChapter} disabled={activePos <= 0} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer" aria-label={trans('reader.prevChapter')}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={onPlayPause} className={`p-3.5 rounded-2xl border cursor-pointer shadow-lg ${activeTheme.accentBg}`} aria-label={playing && !paused ? trans('reader.pause') : trans('reader.play')}>
            {playing && !paused ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          <button type="button" onClick={onStop} disabled={!playing} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer" aria-label={trans('reader.stop')}>
            <Square className="w-4 h-4" />
          </button>
          <button type="button" onClick={onNextChapter} disabled={activePos < 0 || activePos >= chapterCount - 1} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer" aria-label={trans('reader.nextChapter')}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
