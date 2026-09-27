import React from 'react';
import {
  Layers, ListMusic, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Square,
} from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { WordNewDailyReadingRateInput } from '../daily-reading/WordNewDailyReadingRateInput';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import type { OrchAudioPlayback } from './useOrchAudioPlayback';
import { ORCH_AUDIO_LIMITS, type OrchAudioRepeatMode } from './orchAudioModel';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  playback: OrchAudioPlayback;
  hasTranslations: boolean;
}

const NEXT_REPEAT: Record<OrchAudioRepeatMode, OrchAudioRepeatMode> = { off: 'all', all: 'one', one: 'off' };

/** Docked console of the orchestrated audio player. */
export const WordNewOrchAudioTransport: React.FC<Props> = ({ theme, trans, playback, hasTranslations }) => {
  const { settings, playing, paused, currentTime, duration } = playback;
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const stepBtn = 'p-2 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/10 disabled:opacity-30';
  const toggleBtn = (active: boolean) => `rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
    active ? theme.accentBg : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10'
  }`;
  const RepeatIcon = settings.repeat === 'one' ? Repeat1 : Repeat;

  return (
    <div className="sticky bottom-4 z-20 pt-2">
      <div className={`space-y-2.5 rounded-3xl border border-white/10 p-3 shadow-2xl backdrop-blur-xl ${theme.cardClass}`}>
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>{formatClockTime(currentTime)}</span>
            <span>{formatClockTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={playback.prev} disabled={!playing} className={stepBtn} title={trans('orchAudio.prev')} aria-label={trans('orchAudio.prev')}>
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={playback.playPause}
            className={`rounded-2xl border p-3.5 shadow-lg ${theme.accentBg}`}
            aria-label={trans(playing && !paused ? 'orchAudio.pause' : 'orchAudio.play')}
          >
            {playing && !paused ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
          </button>
          <button type="button" onClick={playback.stop} disabled={!playing} className={stepBtn} title={trans('orchAudio.stop')} aria-label={trans('orchAudio.stop')}>
            <Square className="h-4 w-4" />
          </button>
          <button type="button" onClick={playback.next} disabled={!playing} className={stepBtn} title={trans('orchAudio.next')} aria-label={trans('orchAudio.next')}>
            <SkipForward className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => playback.updateSettings({ repeat: NEXT_REPEAT[settings.repeat] })}
            className={`${stepBtn} ${settings.repeat !== 'off' ? 'text-indigo-300 border-indigo-500/30' : ''}`}
            title={trans(`orchAudio.repeat.${settings.repeat}`)}
            aria-label={trans(`orchAudio.repeat.${settings.repeat}`)}
          >
            <RepeatIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-400">
          <button type="button" onClick={() => playback.updateSettings({ mode: 'segments' })} className={toggleBtn(settings.mode === 'segments')}>
            <Layers className="mr-1 inline h-3 w-3" />{trans('orchAudio.mode.segments')}
          </button>
          <button type="button" onClick={() => playback.updateSettings({ mode: 'sentences' })} className={toggleBtn(settings.mode === 'sentences')}>
            <ListMusic className="mr-1 inline h-3 w-3" />{trans('orchAudio.mode.sentences')}
          </button>
          <label className="inline-flex items-center gap-1">
            {trans('orchAudio.speed')}
            <WordNewDailyReadingRateInput
              value={settings.rate}
              onChange={(rate) => playback.updateSettings({ rate })}
              ariaLabel={trans('orchAudio.speed')}
            />
          </label>
          {settings.mode === 'sentences' && (
            <>
              <label className="inline-flex items-center gap-1">
                {trans('orchAudio.sentenceRepeat')}
                <input
                  type="number"
                  min={1}
                  max={ORCH_AUDIO_LIMITS.maxSentenceRepeat}
                  value={settings.sentenceRepeat}
                  onChange={(event) => playback.updateSettings({ sentenceRepeat: Number(event.target.value) })}
                  className="w-12 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
                  aria-label={trans('orchAudio.sentenceRepeat')}
                />
              </label>
              <button type="button" onClick={() => playback.updateSettings({ wordsBefore: !settings.wordsBefore })} className={toggleBtn(settings.wordsBefore)}>
                {trans('orchAudio.wordsBefore')}
              </button>
            </>
          )}
          {hasTranslations && (
            <button type="button" onClick={() => playback.updateSettings({ bilingual: !settings.bilingual })} className={toggleBtn(settings.bilingual)}>
              {trans('orchAudio.bilingual')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
