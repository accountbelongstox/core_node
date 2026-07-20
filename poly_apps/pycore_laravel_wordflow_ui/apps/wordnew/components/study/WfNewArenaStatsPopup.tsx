/**
 * WfNewArenaStatsPopup — the floating PROGRESS panel of the quiz arena, opened
 * from the playback console's stats button (it hovers just above the console,
 * inside the arena overlay). Everything the learner needs mid-playback:
 *
 *   - words read TODAY + today's progress toward the daily goal (%);
 *   - whole-LIBRARY progress (%), words already read, words still unread;
 *   - REVIEW state: whether any review words are pending right now, how many
 *     are still due, and how many have been reviewed (re-read) with its %;
 *   - FULL PASSES: how many complete cycles the whole library has been read
 *     through (min read-count across every word);
 *   - QUICK PAGE JUMP: tap any page chip to switch straight to that page
 *     (pager.goToPage + recite cursor reset, handled by the caller);
 *   - one-tap STUDY SETTINGS: opens the study settings sheet without leaving
 *     the arena.
 *
 * Presentational only — all numbers come from wfNewStudyProgress
 * (computeStats / computeLibraryStats) via the parent panel.
 */
import React from 'react';
import { X, Settings2 } from 'lucide-react';
import type { LibraryStats, StudyStats } from './WfNewStudyProgress';
import { studyT } from './WfNewStudyLocales';

interface WfNewArenaStatsPopupProps {
  lang: string;
  dailyGoal: number;
  session: StudyStats;
  library: LibraryStats;
  pager: { page: number; totalPages: number };
  onJumpPage: (page: number) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;

export const WfNewArenaStatsPopup: React.FC<WfNewArenaStatsPopupProps> = ({
  lang,
  dailyGoal,
  session,
  library,
  pager,
  onJumpPage,
  onOpenSettings,
  onClose,
}) => {
  const rows: Array<{ label: string; value: string }> = [
    { label: studyT(lang, 'study.arena.todayRead'), value: studyT(lang, 'study.stats.words', { n: session.dailyHandled }) },
    { label: studyT(lang, 'study.arena.todayProgress'), value: `${pct(session.dailyHandled, dailyGoal)}%` },
    { label: studyT(lang, 'study.arena.totalProgress'), value: `${pct(library.readWords, library.total)}%` },
    { label: studyT(lang, 'study.arena.read'), value: studyT(lang, 'study.stats.words', { n: library.readWords }) },
    { label: studyT(lang, 'study.arena.remaining'), value: studyT(lang, 'study.stats.words', { n: library.unreadRemaining }) },
    {
      label: studyT(lang, 'study.arena.hasReview'),
      value: studyT(lang, library.dueWords > 0 ? 'study.arena.yes' : 'study.arena.no'),
    },
    { label: studyT(lang, 'study.arena.dueReview'), value: studyT(lang, 'study.stats.words', { n: library.dueWords }) },
    {
      label: studyT(lang, 'study.arena.reviewed'),
      value: `${studyT(lang, 'study.stats.words', { n: library.reviewedWords })} · ${pct(library.reviewedWords, library.total)}%`,
    },
    { label: studyT(lang, 'study.arena.passes'), value: studyT(lang, 'study.arena.times', { n: library.fullPasses }) },
  ];

  const pages = Array.from({ length: pager.totalPages }, (_, i) => i + 1);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-md pointer-events-none">
      <div className="pointer-events-auto p-5 rounded-3xl border border-white/10 bg-slate-950/95 backdrop-blur-2xl shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">
            {studyT(lang, 'study.arena.stats')}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300"
              title={studyT(lang, 'study.settings.title')}
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300"
              title={studyT(lang, 'study.settings.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1">
              <span className="text-[10px] font-mono text-zinc-500 truncate">{r.label}</span>
              <span className="text-xs font-bold text-slate-200 whitespace-nowrap">{r.value}</span>
            </div>
          ))}
        </div>

        {pager.totalPages > 1 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              {studyT(lang, 'study.arena.jumpTo')}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onJumpPage(p)}
                  className={`min-w-8 h-8 px-2 rounded-lg text-[11px] font-mono transition-all ${
                    p === pager.page
                      ? 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
