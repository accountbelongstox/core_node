import { OVERLAY_Z } from '@/shared/styles/overlay';
import React from 'react';
import { ChevronDown, ChevronUp, Home, LoaderCircle, Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import type { DailyReadingPlayer } from './useDailyReadingPlayer';
import { WordNewDailyReadingWordGroupsPanel } from './WordNewDailyReadingWordGroupsPanel';
import { WordNewDailyReadingPlaybackWordsPanel } from './WordNewDailyReadingPlaybackWordsPanel';
import { WordNewDailyReadingArticleView } from './WordNewDailyReadingArticleView';
import { WordNewDailyReadingPlaybackSettings } from './WordNewDailyReadingPlaybackSettings';
import { WordNewDailyReadingEnglishResourceBar } from './WordNewDailyReadingEnglishResourceBar';
import { countSentenceWordsAddedToTargetGroup } from '../../services/WordNewSentenceWordTable';
import { useAutoCollapseWhilePlaying } from '../../hooks/useAutoCollapseWhilePlaying';
import { WordNewDailyReadingResourcePreview } from './WordNewDailyReadingResourcePreview';
import { formatClockTime } from '../../utils/WordNewTimeFormat';

interface Props {
  player: DailyReadingPlayer;
  trans: (k: string, r?: Record<string, string | number>) => string;
  /** Stop playback and navigate back to the wordnew home tab. */
  onGoHome?: () => void;
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

      <div className={`fixed bottom-3 left-1/2 -translate-x-1/2 ${OVERLAY_Z.modal} w-[94%] max-w-lg`}>
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
                <span>{formatClockTime(currentTime)}</span>
                <span>{formatClockTime(duration)}</span>
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
          {!panelCollapsed && <WordNewDailyReadingPlaybackSettings player={player} trans={trans} />}
        </div>
      </div>
    </div>
  );
};
