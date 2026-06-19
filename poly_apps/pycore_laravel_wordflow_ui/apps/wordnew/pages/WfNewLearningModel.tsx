import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Headphones, Layers, Target, Volume2, Minus, Plus, ChevronRight } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { wfNewSettings } from '../WfNewSettingsStore';

/**
 * WfNewLearningModel — the Learning Model settings sub-page.
 *
 * Daily study target + the word-memorization mode (Walkman audio loop, default,
 * or Cards) and, for Walkman, the playback sub-area: play/replay counts, read
 * word/explanation toggles, playback & replay speed, play/replay intervals, and
 * the replay gap (how many words later a word is replayed). All persisted to the
 * shared WfNewSettingsStore. Opens the Review Settings sub-page via onOpenReview.
 */
interface WfNewLearningModelProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onBack: () => void;
  onOpenReview: () => void;
}

/** Compact number stepper persisted on change. */
const Stepper: React.FC<{
  value: number; min: number; max: number; step: number; suffix?: string;
  onChange: (v: number) => void;
}> = ({ value, min, max, step, suffix, onChange }) => {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="min-w-[48px] text-center text-xs font-black font-mono text-zinc-800 dark:text-slate-100">
        {value}{suffix}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/** Labelled row wrapper. */
const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <div className="min-w-0">
      <span className="text-xs font-bold text-zinc-800 dark:text-slate-200 block">{label}</span>
      {hint && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{hint}</span>}
    </div>
    {children}
  </div>
);

/** iOS-style toggle. */
const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    className={`relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0 ${on ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

export const WfNewLearningModel: React.FC<WfNewLearningModelProps> = ({ activeTheme, trans, onBack, onOpenReview }) => {
  const [dailyGoal, setDailyGoal] = useState<number>(() => wfNewSettings.get('dailyGoal'));
  const [mode, setMode] = useState<'walkman' | 'cards'>(() => wfNewSettings.get('memorizeMode'));
  const [playCount, setPlayCount] = useState<number>(() => wfNewSettings.get('wmPlayCount'));
  const [replayCount, setReplayCount] = useState<number>(() => wfNewSettings.get('wmReplayCount'));
  const [readWord, setReadWord] = useState<boolean>(() => wfNewSettings.get('wmReadWord'));
  const [readExpl, setReadExpl] = useState<boolean>(() => wfNewSettings.get('wmReadExplanation'));
  const [speed, setSpeed] = useState<number>(() => wfNewSettings.get('wmPlaybackSpeed'));
  const [playInterval, setPlayInterval] = useState<number>(() => wfNewSettings.get('wmPlayInterval'));
  const [replayGap, setReplayGap] = useState<number>(() => wfNewSettings.get('wmReplayGapWords'));
  const [replaySpeed, setReplaySpeed] = useState<number>(() => wfNewSettings.get('wmReplaySpeed'));
  const [replayInterval, setReplayInterval] = useState<number>(() => wfNewSettings.get('wmReplayInterval'));

  // Persist helper: set local state + store field together.
  const persist = <K extends Parameters<typeof wfNewSettings.setField>[0]>(setter: (v: any) => void, key: K) =>
    (v: any) => { setter(v); wfNewSettings.setField(key, v); };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            {trans('lm.title')}
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">{trans('lm.sub')}</p>
        </div>
      </div>

      {/* Daily target */}
      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg`}>
        <Row label={trans('lm.dailyWords')} hint={trans('onb.wordsPerDay')}>
          <Stepper value={dailyGoal} min={5} max={200} step={5} onChange={persist(setDailyGoal, 'dailyGoal')} />
        </Row>
      </div>

      {/* Memorization mode */}
      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg space-y-3`}>
        <h3 className="text-sm font-black text-slate-100">{trans('lm.mode')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { id: 'walkman', icon: <Headphones className="w-5 h-5" />, label: trans('lm.modeWalkman'), desc: trans('lm.modeWalkmanDesc') },
            { id: 'cards', icon: <Layers className="w-5 h-5" />, label: trans('lm.modeCards'), desc: trans('lm.modeCardsDesc') },
          ] as const).map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => persist(setMode, 'memorizeMode')(m.id)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  active ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-sm">{m.icon}<span>{m.label}</span></div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-1">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Walkman sub-area (only when Walkman is selected) */}
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
            <Row label={trans('lm.playCount')}>
              <Stepper value={playCount} min={1} max={9} step={1} suffix={'×'} onChange={persist(setPlayCount, 'wmPlayCount')} />
            </Row>
            <Row label={trans('lm.replayCount')}>
              <Stepper value={replayCount} min={0} max={9} step={1} suffix={'×'} onChange={persist(setReplayCount, 'wmReplayCount')} />
            </Row>
            <Row label={trans('lm.readWord')}>
              <Toggle on={readWord} onChange={persist(setReadWord, 'wmReadWord')} />
            </Row>
            <Row label={trans('lm.readExplanation')}>
              <Toggle on={readExpl} onChange={persist(setReadExpl, 'wmReadExplanation')} />
            </Row>
            <Row label={trans('lm.playbackSpeed')}>
              <Stepper value={speed} min={0.5} max={2} step={0.1} suffix={'×'} onChange={persist(setSpeed, 'wmPlaybackSpeed')} />
            </Row>
            <Row label={trans('lm.playInterval')} hint={trans('lm.secondsUnit')}>
              <Stepper value={playInterval} min={0} max={10} step={0.5} suffix={'s'} onChange={persist(setPlayInterval, 'wmPlayInterval')} />
            </Row>
            <Row label={trans('lm.replayGapWords')} hint={trans('lm.replayGapHint')}>
              <Stepper value={replayGap} min={0} max={50} step={1} onChange={persist(setReplayGap, 'wmReplayGapWords')} />
            </Row>
            <Row label={trans('lm.replaySpeed')}>
              <Stepper value={replaySpeed} min={0.5} max={2} step={0.1} suffix={'×'} onChange={persist(setReplaySpeed, 'wmReplaySpeed')} />
            </Row>
            <Row label={trans('lm.replayInterval')} hint={trans('lm.secondsUnit')}>
              <Stepper value={replayInterval} min={0} max={10} step={0.5} suffix={'s'} onChange={persist(setReplayInterval, 'wmReplayInterval')} />
            </Row>
          </div>
        </motion.div>
      )}

      {/* Review settings sub-page link */}
      <button
        type="button"
        onClick={onOpenReview}
        className={`w-full p-5 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg flex items-center justify-between cursor-pointer hover:border-white/10 transition-all`}
      >
        <div className="text-left">
          <span className="text-sm font-black text-slate-100 block">{trans('rev.title')}</span>
          <span className="text-[11px] text-zinc-500 font-mono">{trans('rev.sub')}</span>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-400" />
      </button>
    </div>
  );
};
