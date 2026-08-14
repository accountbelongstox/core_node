import React, { useState } from 'react';
import {
  Play, Pause, Square, ChevronLeft, ChevronRight, SkipForward, SkipBack,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
/**
 * WordNewBookReaderPlayBar — the reader's floating read-aloud console, docked at
 * the bottom of the reader page (sticky bottom-6, mirroring the practice
 * arena's docked console position). Button set mirrors the shelf practice
 * control panel: previous page / previous sentence / play-pause / stop /
 * next sentence / next page, plus the reader's own chapter arrows and chapter
 * jump. The header line also shows the READING PROGRESS (current position /
 * total sentences of the loaded page + %) and TODAY'S READ COUNT (local day
 * counter, best-effort).
 */
interface WordNewBookReaderPlayBarProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  playing: boolean;
  paused: boolean;
  chapterTitle: string;
  verseRef: string;
  activePos: number;
  chapterCount: number;
  /** "pos/total · pct%" for the loaded page; empty when nothing is active. */
  progressText: string;
  /** Sentences read today (local day counter). */
  todayCount: number;
  canPrevPage: boolean;
  canNextPage: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onPrevSentence: () => void;
  onNextSentence: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onJumpChapter: (n: number) => void;
}

export const WordNewBookReaderPlayBar: React.FC<WordNewBookReaderPlayBarProps> = ({
  activeTheme, trans, playing, paused, chapterTitle, verseRef, activePos, chapterCount,
  progressText, todayCount, canPrevPage, canNextPage,
  onPlayPause, onStop, onPrevSentence, onNextSentence, onPrevPage, onNextPage,
  onPrevChapter, onNextChapter, onJumpChapter,
}) => {
  const [jumpVal, setJumpVal] = useState('');

  const submitJump = () => {
    const n = parseInt(jumpVal, 10);
    if (!Number.isFinite(n) || n < 1) return;
    onJumpChapter(n);
    setJumpVal('');
  };

  const stepBtn = 'p-2 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer';

  return (
    <div className="sticky bottom-6 z-20 -mx-1 px-1 pb-1 pt-2 bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-transparent">
      <div className={`rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl p-3 sm:p-4 ${activeTheme.cardClass}`}>
        <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-zinc-500 uppercase truncate">{chapterTitle}</p>
            <p className="text-sm font-medium text-zinc-100 truncate">
              {verseRef ? trans('reader.nowPlaying', { ref: verseRef }) : trans('reader.ready')}
            </p>
            {/* Reading progress (position / total sentences of this page + %)
                and today's read count — best-effort, never blocks playback. */}
            <p className="text-[10px] font-mono text-zinc-500 truncate">
              {progressText && <span>{progressText}</span>}
              {progressText && <span className="mx-1.5 text-zinc-700">·</span>}
              <span>{trans('reader.todayRead', { count: todayCount })}</span>
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

        <div className="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2">
          <button type="button" onClick={onPrevChapter} disabled={activePos <= 0} className={stepBtn} aria-label={trans('reader.prevChapter')}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={onPrevPage} disabled={!canPrevPage} className={stepBtn} aria-label={trans('reader.prevPage')} title={trans('reader.prevPage')}>
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={onPrevSentence} disabled={!playing} className={stepBtn} aria-label={trans('reader.prevSentence')} title={trans('reader.prevSentence')}>
            <SkipBack className="w-4 h-4" />
          </button>
          <button type="button" onClick={onPlayPause} className={`p-3.5 rounded-2xl border cursor-pointer shadow-lg ${activeTheme.accentBg}`} aria-label={playing && !paused ? trans('reader.pause') : trans('reader.play')}>
            {playing && !paused ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          <button type="button" onClick={onStop} disabled={!playing} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer" aria-label={trans('reader.stop')}>
            <Square className="w-4 h-4" />
          </button>
          <button type="button" onClick={onNextSentence} disabled={!playing} className={stepBtn} aria-label={trans('reader.nextSentence')} title={trans('reader.nextSentence')}>
            <SkipForward className="w-4 h-4" />
          </button>
          <button type="button" onClick={onNextPage} disabled={!canNextPage} className={stepBtn} aria-label={trans('reader.nextPage')} title={trans('reader.nextPage')}>
            <ChevronsRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={onNextChapter} disabled={activePos < 0 || activePos >= chapterCount - 1} className={stepBtn} aria-label={trans('reader.nextChapter')}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
