import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Layers, Volume2 } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { NavRow } from '@/shared/ui/NavRow';
import { useWfNewSetting } from '../useWfNewSettings';
import { commitDailyGoal } from '../components/WfNewDailyGoalEditor';
import { StepperSettingRow, SwitchSettingRow, type NumberSettingKey, type BooleanSettingKey } from '../components/settings/WfNewSettingRows';
import type { Translate } from '../components/settings/WfNewSettingChoices';

/**
 * WfNewLearningModel — the Learning Model settings sub-page.
 *
 * Daily study target + the word-memorization mode (Walkman audio loop, default,
 * or Cards) and, for Walkman, the playback sub-area. Every control is bound to
 * the shared WfNewSettingsStore. Opens the Review Settings sub-page via onOpenReview.
 */
interface WfNewLearningModelProps {
  activeTheme: ElementTheme;
  trans: Translate;
  onOpenReview: () => void;
}

interface StepperDef {
  key: NumberSettingKey;
  labelKey: string;
  hintKey?: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

interface SwitchDef {
  key: BooleanSettingKey;
  labelKey: string;
}

type WalkmanRow = { kind: 'stepper'; def: StepperDef } | { kind: 'switch'; def: SwitchDef };

const DAILY_GOAL = { min: 5, max: 200, step: 5 };

const WALKMAN_ROWS: readonly WalkmanRow[] = [
  { kind: 'stepper', def: { key: 'wmPlayCount', labelKey: 'lm.playCount', min: 1, max: 9, step: 1, suffix: '×' } },
  { kind: 'stepper', def: { key: 'wmReplayCount', labelKey: 'lm.replayCount', min: 0, max: 9, step: 1, suffix: '×' } },
  { kind: 'switch', def: { key: 'wmReadWord', labelKey: 'lm.readWord' } },
  { kind: 'switch', def: { key: 'wmReadExplanation', labelKey: 'lm.readExplanation' } },
  { kind: 'stepper', def: { key: 'wmPlaybackSpeed', labelKey: 'lm.playbackSpeed', min: 0.5, max: 2, step: 0.1, suffix: '×' } },
  { kind: 'stepper', def: { key: 'wmPlayInterval', labelKey: 'lm.playInterval', hintKey: 'lm.secondsUnit', min: 0, max: 10, step: 0.5, suffix: 's' } },
  { kind: 'stepper', def: { key: 'wmReplayGapWords', labelKey: 'lm.replayGapWords', hintKey: 'lm.replayGapHint', min: 0, max: 50, step: 1 } },
  { kind: 'stepper', def: { key: 'wmReplaySpeed', labelKey: 'lm.replaySpeed', min: 0.5, max: 2, step: 0.1, suffix: '×' } },
  { kind: 'stepper', def: { key: 'wmReplayInterval', labelKey: 'lm.replayInterval', hintKey: 'lm.secondsUnit', min: 0, max: 10, step: 0.5, suffix: 's' } },
];

const MODES = [
  { id: 'walkman', Icon: Headphones, labelKey: 'lm.modeWalkman', descKey: 'lm.modeWalkmanDesc' },
  { id: 'cards', Icon: Layers, labelKey: 'lm.modeCards', descKey: 'lm.modeCardsDesc' },
] as const;

export const WfNewLearningModel: React.FC<WfNewLearningModelProps> = ({ activeTheme, trans, onOpenReview }) => {
  const [mode, setMode] = useWfNewSetting('memorizeMode');
  const cardClass = `rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className={`p-6 ${cardClass}`}>
        <StepperSettingRow
          settingKey="dailyGoal"
          label={trans('lm.dailyWords')}
          hint={trans('onb.wordsPerDay')}
          {...DAILY_GOAL}
          onCommit={commitDailyGoal}
        />
      </div>

      <div className={`p-6 ${cardClass} space-y-3`}>
        <h3 className="text-sm font-black text-slate-100">{trans('lm.mode')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map(({ id, Icon, labelKey, descKey }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  active ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-sm"><Icon className="w-5 h-5" /><span>{trans(labelKey)}</span></div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-1">{trans(descKey)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'walkman' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-indigo-500/15 shadow-lg`}
        >
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-white/5 pb-3 mb-1">
            <Volume2 className="w-4 h-4 text-indigo-400" />
            {trans('lm.walkmanSettings')}
          </h3>
          <div className="divide-y divide-white/5">
            {WALKMAN_ROWS.map((row) => (row.kind === 'stepper' ? (
              <StepperSettingRow
                key={row.def.key}
                settingKey={row.def.key}
                label={trans(row.def.labelKey)}
                hint={row.def.hintKey ? trans(row.def.hintKey) : undefined}
                min={row.def.min}
                max={row.def.max}
                step={row.def.step}
                suffix={row.def.suffix}
              />
            ) : (
              <SwitchSettingRow key={row.def.key} settingKey={row.def.key} label={trans(row.def.labelKey)} />
            )))}
          </div>
        </motion.div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        <NavRow variant="row" label={trans('rev.title')} hint={trans('rev.sub')} onClick={onOpenReview} />
      </div>
    </div>
  );
};
