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
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { wfNewApi } from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { useWfNewSettings } from '../useWfNewSettings';
import { NumberInput } from '@/shared/ui/NumberInput';
import { studyT } from './study/WfNewStudyLocales';

/** Valid goal range — matches the backend preference validation (1..500). */
const MIN_GOAL = 1;
const MAX_GOAL = 500;

const clampGoal = (n: number): number => Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(n)));

/** Write the goal to the local store, then push it (best-effort) to the roamed account preferences. */
export const commitDailyGoal = (n: number): number => {
  const next = clampGoal(n);
  wfNewSettings.setField('dailyGoal', next);
  void wfNewApi.updatePreferences({ daily_goal: next }).catch(() => {});
  return next;
};

interface WfNewDailyGoalEditorProps {
  lang: string;
  className?: string;
  /** Icon instead of the text label (label moves to the tooltip). */
  compact?: boolean;
}

export const WfNewDailyGoalEditor: React.FC<WfNewDailyGoalEditorProps> = ({ lang, className, compact = false }) => {
  // Subscribed store value — every mounted editor instance re-renders on any
  // commit (local store is the single source of truth, see the header).
  const { dailyGoal: stored } = useWfNewSettings();
  const goal = clampGoal(Number(stored) || 20);

  const rockerClass =
    'w-7 h-7 rounded-lg bg-slate-900/5 border border-slate-900/10 text-slate-600 hover:bg-slate-900/10 dark:bg-white/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10 flex items-center justify-center transition-colors shrink-0';
  const label = studyT(lang, 'study.stats.dailyGoal');

  return (
    <div className={`flex items-center justify-between ${compact ? 'gap-1.5' : 'gap-3 py-2'} ${className ?? ''}`} title={compact ? label : undefined}>
      {compact
        ? <Target className="w-3.5 h-3.5 text-fuchsia-500 dark:text-fuchsia-400 shrink-0" aria-label={label} />
        : <span className="text-xs text-zinc-400">{label}</span>}
      <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
        <button
          type="button"
          onClick={() => commitDailyGoal(goal - 1)}
          className={rockerClass}
          title={studyT(lang, 'study.recite.prev')}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <NumberInput
          value={goal}
          min={MIN_GOAL}
          max={MAX_GOAL}
          step={1}
          label={label}
          onChange={commitDailyGoal}
          className={`${compact ? 'w-11' : 'w-16'} text-center font-bold`}
        />
        <button
          type="button"
          onClick={() => commitDailyGoal(goal + 1)}
          className={rockerClass}
          title={studyT(lang, 'study.recite.next')}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
