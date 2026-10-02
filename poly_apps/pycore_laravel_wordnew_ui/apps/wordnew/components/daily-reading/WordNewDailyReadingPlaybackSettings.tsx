import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import { NumberInput } from '@/shared/ui/NumberInput';
import { SelectField } from '@/shared/ui/SelectField';
import { SettingRow } from '@/shared/ui/SettingRow';
import { Switch } from '@/shared/ui/Switch';
import type { DailyReadingPlayer } from './useDailyReadingPlayer';
import {
  createDailyReadingStepId,
  DAILY_READING_PLAYBACK_LIMITS,
  type DailyReadingPlaybackStep,
} from './DailyReadingPlaybackModel';
import { WordNewDailyReadingRateInput } from './WordNewDailyReadingRateInput';

type Trans = (k: string, r?: Record<string, string | number>) => string;
type PlaybackMode = DailyReadingPlayer['playbackMode'];
type WordMode = DailyReadingPlayer['wordMode'];
type WordOrder = DailyReadingPlayer['wordOrder'];

interface Props {
  player: DailyReadingPlayer;
  trans: Trans;
}

const STEP_ICON_BTN = 'p-1 rounded-md text-zinc-500 hover:text-indigo-300 disabled:opacity-30';

export const WordNewDailyReadingPlaybackSettings: React.FC<Props> = ({ player, trans }) => {
  const pattern = player.playbackPattern;
  const patternFull = pattern.length >= DAILY_READING_PLAYBACK_LIMITS.maxSteps;
  const setPattern = (next: DailyReadingPlaybackStep[]): void => player.updateSettings({ playbackPattern: next });
  const addStep = (step: DailyReadingPlaybackStep): void => setPattern([...pattern, step]);

  const playbackModes: Array<{ value: PlaybackMode; label: string }> = [
    { value: 'sequential', label: trans('home.dailyReading.sequential') },
    { value: 'repeat-all', label: trans('home.dailyReading.repeatAll') },
    { value: 'repeat-one', label: trans('home.dailyReading.repeatOne') },
    { value: 'shuffle', label: trans('home.dailyReading.shuffle') },
  ];
  const wordModes: Array<{ value: WordMode; label: string }> = [
    { value: 'new', label: trans('home.dailyReading.newOnly') },
    { value: 'all', label: trans('home.dailyReading.allWords') },
    { value: 'off', label: trans('home.dailyReading.off') },
  ];
  const wordOrders: Array<{ value: WordOrder; label: string }> = [
    { value: 'sentence', label: trans('home.dailyReading.sentenceOrder') },
    { value: 'shuffle', label: trans('home.dailyReading.shuffle') },
    { value: 'alpha', label: trans('home.dailyReading.alphaOrder') },
  ];
  const stepTypes = [
    { value: 'sentence', label: trans('home.dailyReading.sentenceStep') },
    { value: 'words', label: trans('home.dailyReading.wordsStep') },
  ];
  const stepLanguages = [
    { value: 'en', label: trans('home.dailyReading.english') },
    { value: 'cn', label: trans('home.dailyReading.chinese') },
  ];

  const moveStep = (stepIndex: number, delta: number): void => {
    const target = stepIndex + delta;
    if (target < 0 || target >= pattern.length) return;
    const next = [...pattern];
    [next[stepIndex], next[target]] = [next[target], next[stepIndex]];
    setPattern(next);
  };
  const replaceStep = (stepIndex: number, replacement: DailyReadingPlaybackStep): void => {
    setPattern(pattern.map((current, index) => (index === stepIndex ? replacement : current)));
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 text-[11px] text-zinc-500">
        <SelectField variant="compact" label={trans('home.dailyReading.playbackOrder')} value={player.playbackMode} options={playbackModes} onChange={(playbackMode) => player.updateSettings({ playbackMode })} />
        <SettingRow label={trans('home.dailyReading.underlineCurrentSentence')}>
          <Switch on={player.underlineCurrentSentence} label={trans('home.dailyReading.underlineCurrentSentence')} onChange={(underlineCurrentSentence) => player.updateSettings({ underlineCurrentSentence })} />
        </SettingRow>
        <SettingRow label={trans('home.dailyReading.bilingual')}>
          <Switch on={player.bilingual} label={trans('home.dailyReading.bilingual')} onChange={(bilingual) => player.updateSettings({ bilingual })} />
        </SettingRow>
        <SettingRow label={trans('home.dailyReading.sentenceSpeed')}>
          <WordNewDailyReadingRateInput value={player.sentenceRate} onChange={(rate) => player.updateSettings({ sentenceRate: rate })} ariaLabel={trans('home.dailyReading.sentenceSpeed')} />
        </SettingRow>
        <SettingRow label={trans('home.dailyReading.wordSpeed')}>
          <WordNewDailyReadingRateInput value={player.wordRate} onChange={(rate) => player.updateSettings({ wordRate: rate })} ariaLabel={trans('home.dailyReading.wordSpeed')} />
        </SettingRow>
        <SelectField variant="compact" label={trans('home.dailyReading.words')} value={player.wordMode} options={wordModes} onChange={(wordMode) => player.updateSettings({ wordMode })} />
        <SelectField variant="compact" label={trans('home.dailyReading.wordOrder')} value={player.wordOrder} options={wordOrders} disabled={player.wordMode === 'off'} onChange={(wordOrder) => player.updateSettings({ wordOrder })} />
        {player.wordMode === 'new' && (
          <SettingRow label={trans('home.dailyReading.newOnlyMaxReadCount')}>
            <NumberInput
              value={player.newOnlyMaxReadCount}
              min={0}
              max={DAILY_READING_PLAYBACK_LIMITS.maxNewReadCount}
              step={1}
              label={trans('home.dailyReading.newOnlyMaxReadCount')}
              className="w-14 text-right"
              onChange={(newOnlyMaxReadCount) => player.updateSettings({ newOnlyMaxReadCount })}
            />
          </SettingRow>
        )}
      </div>

      <div className="space-y-1.5 text-[11px] text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{trans('home.dailyReading.playbackModel')}</span>
          <div className="flex items-center gap-1">
            <ChipButton
              onClick={() => addStep({ id: createDailyReadingStepId(), type: 'sentence', lang: 'en', times: 1 })}
              disabled={patternFull}
              className="px-2 py-0.5"
              title={trans('home.dailyReading.addSentenceStep')}
            >
              <Plus className="w-3 h-3" /> {trans('home.dailyReading.sentenceStep')}
            </ChipButton>
            <ChipButton
              onClick={() => addStep({ id: createDailyReadingStepId(), type: 'words', times: 1 })}
              disabled={patternFull}
              className="px-2 py-0.5"
              title={trans('home.dailyReading.addWordsStep')}
            >
              <Plus className="w-3 h-3" /> {trans('home.dailyReading.wordsStep')}
            </ChipButton>
          </div>
        </div>
        {pattern.map((step, stepIndex) => (
          <div
            key={step.id}
            aria-current={player.activeStepId === step.id ? 'step' : undefined}
            className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 ${player.activeStepId === step.id ? 'bg-indigo-500/10 ring-1 ring-indigo-500/20' : ''}`}
          >
            <SelectField
              variant="compact"
              value={step.type}
              options={stepTypes}
              onChange={(type) => replaceStep(stepIndex, type === 'words'
                ? { id: step.id, type: 'words', times: step.times }
                : { id: step.id, type: 'sentence', lang: 'en', times: step.times })}
            />
            {step.type === 'sentence' && (
              <SelectField
                variant="compact"
                value={step.lang}
                options={stepLanguages}
                onChange={(lang) => replaceStep(stepIndex, { ...step, lang: lang === 'cn' ? 'cn' : 'en' })}
              />
            )}
            <span>×</span>
            <NumberInput
              value={step.times}
              min={1}
              max={DAILY_READING_PLAYBACK_LIMITS.maxStepRepeats}
              step={1}
              label={trans('home.dailyReading.repeats')}
              className="w-14 text-right"
              onChange={(times) => replaceStep(stepIndex, { ...step, times })}
            />
            <div className="flex-1" />
            <button type="button" onClick={() => moveStep(stepIndex, -1)} disabled={stepIndex === 0} className={STEP_ICON_BTN} title={trans('home.dailyReading.moveUp')}>
              <ArrowUp className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => moveStep(stepIndex, 1)} disabled={stepIndex >= pattern.length - 1} className={STEP_ICON_BTN} title={trans('home.dailyReading.moveDown')}>
              <ArrowDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setPattern(pattern.filter((_, index) => index !== stepIndex))}
              disabled={pattern.length <= 1}
              className="p-1 rounded-md text-zinc-500 hover:text-rose-300 disabled:opacity-30"
              title={trans('home.dailyReading.removeStep')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};
