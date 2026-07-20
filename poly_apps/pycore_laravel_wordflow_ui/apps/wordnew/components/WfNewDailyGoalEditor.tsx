/**
 * WfNewDailyGoalEditor — the shared daily-goal editor (label + ◀ rocker +
 * numeric input + ▶ rocker), reused by the study settings sheet and the home
 * dashboard so the goal is edited the SAME way everywhere.
 *
 * SINGLE SOURCE OF TRUTH: the value is read from (and every commit written to)
 * the persisted wfNewSettings store; the component subscribes through
 * useWfNewSettings, so ALL mounted instances stay in sync automatically.
 *
 * ROAMING: the daily goal is a GLOBAL per-user value — every commit ALSO
 * pushes it, best-effort, to the backend account preferences
 * (PUT /user/preferences, daily_goal validated 1..500) so it roams across
 * devices; the login/onboarding paths pull it back down. A failed push is
 * ignored — the local store value stays and the next pull re-syncs.
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { wfNewApi } from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { useWfNewSettings } from '../useWfNewSettings';
import { studyT } from './study/WfNewStudyLocales';

/** Valid goal range — matches the backend preference validation (1..500). */
const MIN_GOAL = 1;
const MAX_GOAL = 500;

const clampGoal = (n: number): number => Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(n)));

interface WfNewDailyGoalEditorProps {
  lang: string;
  className?: string;
}

export const WfNewDailyGoalEditor: React.FC<WfNewDailyGoalEditorProps> = ({ lang, className }) => {
  // Subscribed store value — every mounted editor instance re-renders on any
  // commit (local store is the single source of truth, see the header).
  const { dailyGoal: stored } = useWfNewSettings();
  const goal = clampGoal(Number(stored) || 20);

  // Write the local store first (all instances sync through it), then push the
  // same value to the roamed backend preferences (best-effort, see header).
  const commit = (n: number) => {
    const next = clampGoal(n);
    wfNewSettings.setField('dailyGoal', next);
    void wfNewApi.updatePreferences({ daily_goal: next }).catch(() => {});
  };

  const rockerClass =
    'w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 flex items-center justify-center transition-colors';

  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${className ?? ''}`}>
      <span className="text-xs text-zinc-400">{studyT(lang, 'study.stats.dailyGoal')}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => commit(goal - 1)}
          className={rockerClass}
          title={studyT(lang, 'study.recite.prev')}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          min={MIN_GOAL}
          max={MAX_GOAL}
          step={1}
          value={goal}
          inputMode="numeric"
          pattern="[0-9]*"
          onKeyDown={(e) => {
            if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
          }}
          onChange={(e) => {
            // Typing commits on change, clamped to the valid range; junk input
            // (empty / non-numeric) is ignored and snaps back to the store value.
            const v = parseInt(e.target.value, 10);
            if (Number.isFinite(v)) commit(v);
          }}
          className="w-16 text-center bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50"
        />
        <button
          type="button"
          onClick={() => commit(goal + 1)}
          className={rockerClass}
          title={studyT(lang, 'study.recite.next')}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
