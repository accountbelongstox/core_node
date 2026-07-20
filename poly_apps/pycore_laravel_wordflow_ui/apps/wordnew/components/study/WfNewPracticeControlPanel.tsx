/**
 * WfNewPracticeControlPanel — the floating transport bar for the practice
 * sequential-reading (listening/"Sound") mode. Presentational only: it renders a
 * bottom-centered pill (sitting just above the app's bottom dock) and drives the
 * recite controller + practice pager handed in via props.
 *
 * Buttons: previous page, previous word, play/pause, [stop — when `onStop` is
 * given], next word, next page, and a large-font toggle. Page moves jump the
 * play cursor back to word 0 of the new page; the page arrows disable at the
 * first page / when no further page remains. `docked` pins the pill to the
 * app bottom-menu position (used by the fullscreen arena overlay, which covers
 * the dock so the console takes its place).
 *
 * The pill also shows the CURRENT PAGE / TOTAL PAGES between the page arrows,
 * and — when `onToggleStats` is given (the arena) — a progress button that
 * opens the floating stats popup (today's read count + today's goal progress,
 * whole-library progress %, read/remaining/review counts, full-pass count,
 * quick page jump, one-tap study settings — see WfNewArenaStatsPopup).
 */
import React from 'react';
import { ChevronsLeft, ChevronsRight, SkipBack, SkipForward, Play, Pause, Square, Type, BarChart3 } from 'lucide-react';

interface WfNewPracticeControlPanelProps {
  trans: (k: string, r?: Record<string, string | number>) => string;
  // Recite handle (from useWfNewReciteController) — only the fields used here.
  recite: {
    isPlaying: boolean;
    toggle: () => void;
    prev: () => void;
    next: () => void;
    setIndex: (i: number) => void;
  };
  // Practice pager handle (from useWfNewPracticePager) — page nav + bounds.
  pager: {
    page: number;
    totalPages: number;
    hasMore: boolean;
    prevPage: () => void;
    nextPage: () => void;
  };
  largeFont: boolean;
  onToggleLargeFont: () => void;
  // Full stop (ends the playback session; distinct from pause). When provided
  // the pill docks at the app-bottom-menu position (`docked`) — the arena
  // overlay covers the dock, so the console takes its place.
  onStop?: () => void;
  docked?: boolean;
  // Arena progress popup toggle (stats + page jump + study settings).
  onToggleStats?: () => void;
  statsOpen?: boolean;
}

const ICON_BTN =
  'w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5';

export const WfNewPracticeControlPanel: React.FC<WfNewPracticeControlPanelProps> = ({
  trans,
  recite,
  pager,
  largeFont,
  onToggleLargeFont,
  onStop,
  docked = false,
  onToggleStats,
  statsOpen = false,
}) => {
  const canPrevPage = pager.page > 1;
  const canNextPage = pager.hasMore;

  const goPrevPage = () => {
    if (!canPrevPage) return;
    pager.prevPage();
    recite.setIndex(0);
  };
  const goNextPage = () => {
    if (!canNextPage) return;
    pager.nextPage();
    recite.setIndex(0);
  };

  return (
    <div className={`fixed ${docked ? 'bottom-6' : 'bottom-28'} left-1/2 -translate-x-1/2 z-40 pointer-events-none`}>
      <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-2 rounded-full border border-white/10 bg-slate-950/85 backdrop-blur-2xl shadow-2xl">
        <button
          type="button"
          onClick={goPrevPage}
          disabled={!canPrevPage}
          className={ICON_BTN}
          title={trans('practice.ctrl.prevPage')}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        {/* Current page / total pages. */}
        <span className="text-[10px] font-mono text-zinc-400 px-1 whitespace-nowrap select-none">
          {pager.page}/{pager.totalPages}
        </span>
        <button
          type="button"
          onClick={() => recite.prev()}
          className={ICON_BTN}
          title={trans('practice.ctrl.prevWord')}
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => recite.toggle()}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
          title={trans(recite.isPlaying ? 'practice.ctrl.pause' : 'practice.ctrl.play')}
        >
          {recite.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        {onStop && (
          <button
            type="button"
            onClick={onStop}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 transition-all"
            title={trans('practice.ctrl.stop')}
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        )}
        <button
          type="button"
          onClick={() => recite.next()}
          className={ICON_BTN}
          title={trans('practice.ctrl.nextWord')}
        >
          <SkipForward className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={goNextPage}
          disabled={!canNextPage}
          className={ICON_BTN}
          title={trans('practice.ctrl.nextPage')}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>

        <span className="w-px h-6 bg-white/10 mx-0.5" />

        <button
          type="button"
          onClick={onToggleLargeFont}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            largeFont
              ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
              : 'bg-white/5 hover:bg-white/10 text-zinc-300'
          }`}
          title={trans('practice.ctrl.largeFont')}
          aria-pressed={largeFont}
        >
          <Type className="w-4 h-4" />
        </button>

        {onToggleStats && (
          <button
            type="button"
            onClick={onToggleStats}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              statsOpen
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                : 'bg-white/5 hover:bg-white/10 text-zinc-300'
            }`}
            title={trans('practice.ctrl.stats')}
            aria-pressed={statsOpen}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
