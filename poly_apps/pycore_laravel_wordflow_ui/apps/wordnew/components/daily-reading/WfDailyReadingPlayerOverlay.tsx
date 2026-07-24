/** Fullscreen Daily Reading player overlay: hides the rest of the page behind
 * an opaque backdrop, shows the current article text for reading along, and
 * floats a bottom-center console (title, prev / play-pause / next, progress,
 * close) above everything. Driven by useDailyReadingPlayer. */
import React from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import type { DailyReadingPlayer } from './useDailyReadingPlayer';

interface Props {
  player: DailyReadingPlayer;
  trans: (k: string, r?: Record<string, string | number>) => string;
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const WfDailyReadingPlayerOverlay: React.FC<Props> = ({ player, trans }) => {
  const { open, playing, list, index, current, currentTime, duration } = player;
  if (!open || !current || typeof document === 'undefined') return null;
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const dateLabel = current.reading_date ?? current.created_at ?? '';

  return createPortal((
    <div className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-md flex flex-col">
      {/* Reading surface — the only page content visible while playing. */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-10 pb-48">
        <article className="max-w-2xl mx-auto space-y-5">
          <header className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-50 leading-snug">
              {current.title_en}
            </h2>
            {current.title_cn && (
              <p className="text-sm text-zinc-400">{current.title_cn}</p>
            )}
            {dateLabel && (
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                {new Date(dateLabel).toLocaleString()}
              </p>
            )}
          </header>
          {current.article_en && (
            <p className="text-base text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {current.article_en}
            </p>
          )}
          {current.reference_cn && (
            <p className="text-sm text-zinc-500 leading-relaxed whitespace-pre-wrap border-t border-white/5 pt-4">
              {current.reference_cn}
            </p>
          )}
        </article>
      </div>

      {/* Floating console — bottom-center card above the overlay backdrop. */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[160] w-[94%] max-w-xl">
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-zinc-100 truncate">{current.title_en}</div>
              {current.title_cn && (
                <div className="text-[11px] text-zinc-500 truncate">{current.title_cn}</div>
              )}
            </div>
            <span className="shrink-0 text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              {index + 1} / {list.length}
            </span>
          </div>

          {/* Time progress bar */}
          <div className="space-y-1">
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={player.prev}
                disabled={index === 0 && player.playbackMode !== 'repeat-all'}
                className="p-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title={trans('home.dailyReading.prev')}
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={player.toggle}
                className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-transform"
                title={trans(playing ? 'home.dailyReading.pause' : 'home.dailyReading.play')}
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={player.next}
                disabled={index >= list.length - 1 && player.playbackMode === 'sequential'}
                className="p-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title={trans('home.dailyReading.next')}
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={player.close}
              className="p-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
              title={trans('home.dailyReading.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
            <span>Playback order</span>
            <select
              value={player.playbackMode}
              onChange={(event) => player.updateSettings({ playbackMode: event.target.value as typeof player.playbackMode })}
              className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
            >
              <option value="sequential">Sequential</option>
              <option value="repeat-all">Repeat all</option>
              <option value="repeat-one">Repeat one</option>
              <option value="shuffle">Shuffle</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
            <label className="flex items-center justify-between gap-2">
              <span>Words</span>
              <select
                value={player.wordMode}
                onChange={(event) => player.updateSettings({ wordMode: event.target.value as typeof player.wordMode })}
                className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
              >
                <option value="new">New only</option>
                <option value="all">All words</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Word repeats</span>
              <input
                type="number"
                min={1}
                max={10}
                value={player.wordRepeats}
                onChange={(event) => player.updateSettings({ wordRepeats: Number(event.target.value) })}
                disabled={player.wordMode === 'off'}
                className="w-14 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300 disabled:opacity-40"
              />
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
            <span>Play sentence before words</span>
            <input
              type="checkbox"
              checked={player.sentenceFirst}
              disabled={player.wordMode === 'off'}
              onChange={(event) => player.updateSettings({ sentenceFirst: event.target.checked })}
            />
          </label>
        </div>
      </div>
    </div>
  ), document.body);
};
