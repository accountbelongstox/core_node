import React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Home, LoaderCircle, Pause, Play, Plus, SkipBack, SkipForward, Square, Trash2 } from 'lucide-react';
import type { DailyReadingPlayer } from './useDailyReadingPlayer';
import {
  createDailyReadingStepId,
  DAILY_READING_PLAYBACK_LIMITS,
  type DailyReadingPlaybackStep,
} from './DailyReadingPlaybackModel';
import { WordNewDailyReadingWordGroupsPanel } from './WordNewDailyReadingWordGroupsPanel';
import { WordNewDailyReadingPlaybackWordsPanel } from './WordNewDailyReadingPlaybackWordsPanel';
import { WordNewDailyReadingArticleView } from './WordNewDailyReadingArticleView';
import { WordNewDailyReadingRateInput } from './WordNewDailyReadingRateInput';
import { WordNewDailyReadingEnglishResourceBar } from './WordNewDailyReadingEnglishResourceBar';
import { countSentenceWordsAddedToTargetGroup } from '../../services/WordNewSentenceWordTable';
import { useAutoCollapseWhilePlaying } from '../../hooks/useAutoCollapseWhilePlaying';
import { WordNewDailyReadingResourcePreview } from './WordNewDailyReadingResourcePreview';

interface Props {
  player: DailyReadingPlayer;
  trans: (k: string, r?: Record<string, string | number>) => string;
  /** Stop playback and navigate back to the wordnew home tab. */
  onGoHome?: () => void;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const WordNewDailyReadingPlayerOverlay: React.FC<Props> = ({ player, trans, onGoHome }) => {
  const { open, playing, list, index, current, currentTime, duration } = player;
  const {
    collapsed: panelCollapsed,
    toggle: togglePanel,
    noteInteraction: notePanelInteraction,
  } = useAutoCollapseWhilePlaying(playing);
  if (!open || !current) return null;
  const pct = Number.isFinite(duration) && duration > 0
    ? Math.min(100, (currentTime / duration) * 100)
    : 0;
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-950/70">
      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-2 sm:px-6">
        <article className="mx-auto min-w-0 max-w-2xl space-y-2">
          {player.activeStepType === 'words' && (
            <div className="sticky top-4 z-10">
              <WordNewDailyReadingPlaybackWordsPanel
                words={player.activeWords}
                activeWord={player.activeWord}
                activeWordIndex={player.activeWordIndex}
                trans={trans}
              />
            </div>
          )}
          {current.article_en && (
            <WordNewDailyReadingArticleView
              articleId={current.id}
              articleEn={current.article_en}
              referenceCn={current.reference_cn}
              articleWords={player.articleWords}
              resourceStatus={player.resourceStatus}
              currentTime={currentTime}
              duration={duration}
              activeStepType={player.activeStepType}
              activeSentenceLanguage={player.activeSentenceLanguage}
              bilingual={player.bilingual}
              underline={player.underlineCurrentSentence}
              hideEnglishResourceBar={panelCollapsed}
              trans={trans}
            />
          )}
          <WordNewDailyReadingWordGroupsPanel
            trans={trans}
            refreshToken={player.wordProgressVersion}
            sessionReads={player.sessionReadTotal}
            sessionNewWords={countSentenceWordsAddedToTargetGroup(player.articleWords)}
          />
        </article>
      </div>

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[160] w-[94%] max-w-lg">
        <div
          className="rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 p-2.5 space-y-2 max-h-[62vh] overflow-y-auto"
          onPointerDownCapture={notePanelInteraction}
          onKeyDownCapture={notePanelInteraction}
        >
          {panelCollapsed && (
            <WordNewDailyReadingEnglishResourceBar
              sentence={current.article_en ?? ''}
              words={player.articleWords}
              status={player.resourceStatus}
              trans={trans}
            />
          )}

          {!panelCollapsed && player.activeStepType !== 'words' && (
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
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={player.prev}
                disabled={index === 0 && player.playbackMode !== 'repeat-all'}
                className="p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title={trans('home.dailyReading.prev')}
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={player.toggle}
                disabled={player.transportState === 'loading'}
                className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-60 disabled:hover:scale-100 transition-transform"
                title={trans(player.transportState === 'loading'
                  ? 'home.dailyReading.preparing'
                  : playing
                    ? 'home.dailyReading.pause'
                    : player.paused
                      ? 'home.dailyReading.resume'
                      : 'home.dailyReading.play')}
              >
                {player.transportState === 'loading'
                  ? <LoaderCircle className="w-5 h-5 animate-spin" />
                  : playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={player.next}
                disabled={index >= list.length - 1 && player.playbackMode === 'sequential'}
                className="p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title={trans('home.dailyReading.next')}
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <WordNewDailyReadingResourcePreview
                articleId={current.id}
                settings={player}
                trans={trans}
              />
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                {index + 1} / {list.length}
              </span>
              <button
                type="button"
                onClick={togglePanel}
                className="p-2 rounded-xl border border-white/10 text-zinc-500 hover:text-indigo-300 transition-colors"
                title={trans(panelCollapsed
                  ? 'home.dailyReading.expandPlayer'
                  : 'home.dailyReading.collapsePlayer')}
              >
                {panelCollapsed
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {onGoHome && (
                <button
                  type="button"
                  onClick={() => { player.stop(); onGoHome(); }}
                  className="p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors"
                  title={trans('home.dailyReading.backHome')}
                >
                  <Home className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={player.stop}
                className="p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                title={trans('home.dailyReading.stop')}
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          </div>
          {!panelCollapsed && (<>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
            <label className="flex items-center justify-between gap-2">
              <span>{trans('home.dailyReading.playbackOrder')}</span>
              <select
                value={player.playbackMode}
                onChange={(event) => player.updateSettings({ playbackMode: event.target.value as typeof player.playbackMode })}
                className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
              >
                <option value="sequential">{trans('home.dailyReading.sequential')}</option>
                <option value="repeat-all">{trans('home.dailyReading.repeatAll')}</option>
                <option value="repeat-one">{trans('home.dailyReading.repeatOne')}</option>
                <option value="shuffle">{trans('home.dailyReading.shuffle')}</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{trans('home.dailyReading.underlineCurrentSentence')}</span>
              <input
                type="checkbox"
                checked={player.underlineCurrentSentence}
                onChange={(event) => player.updateSettings({ underlineCurrentSentence: event.target.checked })}
                aria-label={trans('home.dailyReading.underlineCurrentSentence')}
                className="accent-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{trans('home.dailyReading.bilingual')}</span>
              <input
                type="checkbox"
                checked={player.bilingual}
                onChange={(event) => player.updateSettings({ bilingual: event.target.checked })}
                aria-label={trans('home.dailyReading.bilingual')}
                className="accent-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{trans('home.dailyReading.sentenceSpeed')}</span>
              <WordNewDailyReadingRateInput
                value={player.sentenceRate}
                onChange={(rate) => player.updateSettings({ sentenceRate: rate })}
                ariaLabel={trans('home.dailyReading.sentenceSpeed')}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{trans('home.dailyReading.wordSpeed')}</span>
              <WordNewDailyReadingRateInput
                value={player.wordRate}
                onChange={(rate) => player.updateSettings({ wordRate: rate })}
                ariaLabel={trans('home.dailyReading.wordSpeed')}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{trans('home.dailyReading.words')}</span>
              <select
                value={player.wordMode}
                onChange={(event) => player.updateSettings({ wordMode: event.target.value as typeof player.wordMode })}
                className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
              >
                <option value="new">{trans('home.dailyReading.newOnly')}</option>
                <option value="all">{trans('home.dailyReading.allWords')}</option>
                <option value="off">{trans('home.dailyReading.off')}</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{trans('home.dailyReading.wordOrder')}</span>
              <select
                value={player.wordOrder}
                onChange={(event) => player.updateSettings({ wordOrder: event.target.value as typeof player.wordOrder })}
                disabled={player.wordMode === 'off'}
                className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300 disabled:opacity-40"
              >
                <option value="sentence">{trans('home.dailyReading.sentenceOrder')}</option>
                <option value="shuffle">{trans('home.dailyReading.shuffle')}</option>
                <option value="alpha">{trans('home.dailyReading.alphaOrder')}</option>
              </select>
            </label>
            {player.wordMode === 'new' && (
              <label className="flex items-center justify-between gap-2">
                <span>{trans('home.dailyReading.newOnlyMaxReadCount')}</span>
                <input
                  type="number"
                  min={0}
                  max={DAILY_READING_PLAYBACK_LIMITS.maxNewReadCount}
                  value={player.newOnlyMaxReadCount}
                  onChange={(event) => player.updateSettings({ newOnlyMaxReadCount: Number(event.target.value) })}
                  aria-label={trans('home.dailyReading.newOnlyMaxReadCount')}
                  className="w-14 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
                />
              </label>
            )}
          </div>
          <div className="space-y-1.5 text-[11px] text-zinc-500">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{trans('home.dailyReading.playbackModel')}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => player.updateSettings({
                    playbackPattern: [
                      ...player.playbackPattern,
                      { id: createDailyReadingStepId(), type: 'sentence', lang: 'en', times: 1 },
                    ],
                  })}
                  disabled={player.playbackPattern.length >= DAILY_READING_PLAYBACK_LIMITS.maxSteps}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/10 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 disabled:opacity-30 transition-colors"
                  title={trans('home.dailyReading.addSentenceStep')}
                >
                  <Plus className="w-3 h-3" /> {trans('home.dailyReading.sentenceStep')}
                </button>
                <button
                  type="button"
                  onClick={() => player.updateSettings({
                    playbackPattern: [
                      ...player.playbackPattern,
                      { id: createDailyReadingStepId(), type: 'words', times: 1 },
                    ],
                  })}
                  disabled={player.playbackPattern.length >= DAILY_READING_PLAYBACK_LIMITS.maxSteps}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/10 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 disabled:opacity-30 transition-colors"
                  title={trans('home.dailyReading.addWordsStep')}
                >
                  <Plus className="w-3 h-3" /> {trans('home.dailyReading.wordsStep')}
                </button>
              </div>
            </div>
            {player.playbackPattern.map((step, stepIndex) => {
              const move = (delta: number) => {
                const target = stepIndex + delta;
                if (target < 0 || target >= player.playbackPattern.length) return;
                const nextPattern = [...player.playbackPattern];
                [nextPattern[stepIndex], nextPattern[target]] = [nextPattern[target], nextPattern[stepIndex]];
                player.updateSettings({ playbackPattern: nextPattern });
              };
              const replaceStep = (replacement: DailyReadingPlaybackStep) => {
                const nextPattern = player.playbackPattern.map((currentStep, currentIndex) => (
                  currentIndex === stepIndex ? replacement : currentStep
                ));
                player.updateSettings({ playbackPattern: nextPattern });
              };
              return (
                <div
                  key={step.id}
                  aria-current={player.activeStepId === step.id ? 'step' : undefined}
                  className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 ${
                    player.activeStepId === step.id ? 'bg-indigo-500/10 ring-1 ring-indigo-500/20' : ''
                  }`}
                >
                  <select
                    value={step.type}
                    onChange={(event) => replaceStep(event.target.value === 'words'
                      ? { id: step.id, type: 'words', times: step.times }
                      : { id: step.id, type: 'sentence', lang: 'en', times: step.times })}
                    className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
                  >
                    <option value="sentence">{trans('home.dailyReading.sentenceStep')}</option>
                    <option value="words">{trans('home.dailyReading.wordsStep')}</option>
                  </select>
                  {step.type === 'sentence' && (
                    <select
                      value={step.lang}
                      onChange={(event) => replaceStep({
                        ...step,
                        lang: event.target.value === 'cn' ? 'cn' : 'en',
                      })}
                      className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
                    >
                      <option value="en">{trans('home.dailyReading.english')}</option>
                      <option value="cn">{trans('home.dailyReading.chinese')}</option>
                    </select>
                  )}
                  <span>×</span>
                  <input
                    type="number"
                    min={1}
                    max={DAILY_READING_PLAYBACK_LIMITS.maxStepRepeats}
                    value={step.times}
                    onChange={(event) => replaceStep({
                      ...step,
                      times: Number(event.target.value),
                    })}
                    aria-label={trans('home.dailyReading.repeats')}
                    className="w-14 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
                  />
                  <div className="flex-1" />
                  <button type="button" onClick={() => move(-1)} disabled={stepIndex === 0}
                    className="p-1 rounded-md text-zinc-500 hover:text-indigo-300 disabled:opacity-30" title={trans('home.dailyReading.moveUp')}>
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => move(1)} disabled={stepIndex >= player.playbackPattern.length - 1}
                    className="p-1 rounded-md text-zinc-500 hover:text-indigo-300 disabled:opacity-30" title={trans('home.dailyReading.moveDown')}>
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => player.updateSettings({
                      playbackPattern: player.playbackPattern.filter((_, currentIndex) => currentIndex !== stepIndex),
                    })}
                    disabled={player.playbackPattern.length <= 1}
                    className="p-1 rounded-md text-zinc-500 hover:text-rose-300 disabled:opacity-30" title={trans('home.dailyReading.removeStep')}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
};
