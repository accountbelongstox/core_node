/**
 * The composition player, shared by the resources page (`preview`: the stage
 * with a compact transport and a link to the player page) and the player page
 * (`full`: segments, speed and an immersive fullscreen stage whose controls
 * fade out while playing).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Gauge, Maximize, Maximize2, Minimize, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { OrchVideoSettings } from '../../../../core/integrations/pycore';
import { OrchStage } from '../../../../shared/orchestration/OrchStage';
import type { ElementTheme } from '../../WfNewThemes';
import { formatClockTime } from '../../utils/WordNewTimeFormat';
import { ORCH_COMPOSE_RATES, type WordNewOrchComposePlayback } from './useWordNewOrchComposePlayback';
import { capImmersive } from '../../platform/capabilities/CapImmersive';
import { capApp } from '../../platform/capabilities/CapAppStateCore';
import { useKeepAwake } from '../../platform/capabilities/CapKeepAwake';
import { OrchButton, OrchPanel, OrchPanelHeader } from './orchPanels';
import { OrchTabs } from './OrchTabs';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

interface Props {
  variant: 'preview' | 'full';
  playback: WordNewOrchComposePlayback;
  settings: OrchVideoSettings;
  label: string;
  theme: ElementTheme;
  trans: Trans;
  /** Preview: open the player page. */
  onOpenPlayer?: () => void;
  /** Full: the resource-loading widget, kept visible over the fullscreen stage. */
  loadWidget?: (overlay: boolean) => React.ReactNode;
}

const CONTROLS_HIDE_MS = 3000;
const CONTROL_TONE = {
  light: 'text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10',
  dark: 'text-zinc-100 hover:bg-white/15',
} as const;

function nextRate(rate: number): number {
  const index = ORCH_COMPOSE_RATES.indexOf(rate as (typeof ORCH_COMPOSE_RATES)[number]);
  return ORCH_COMPOSE_RATES[(index + 1) % ORCH_COMPOSE_RATES.length];
}

/**
 * Immersive mode: a full-viewport layer on the body plus `capImmersive` (native: system bars hidden and
 * landscape; web: document fullscreen). The Android back button and Esc leave it first.
 */
function useImmersive(): { immersive: boolean; enter: () => void; exit: () => void } {
  const [immersive, setImmersive] = useState(false);

  const exit = useCallback((): void => {
    setImmersive(false);
    void capImmersive.exit();
  }, []);

  const enter = useCallback((): void => {
    setImmersive(true);
    void capImmersive.enter(true);
  }, []);

  useEffect(() => {
    if (!immersive) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') exit();
    };
    document.addEventListener('keydown', onKey);
    const offWebExit = capImmersive.onWebExit(() => setImmersive(false));
    void capApp.init();
    const offBack = capApp.registerBackHandler(() => {
      exit();
      return true;
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      offWebExit();
      offBack();
    };
  }, [immersive, exit]);

  const immersiveRef = useRef(immersive);
  immersiveRef.current = immersive;
  useEffect(() => () => { if (immersiveRef.current) void capImmersive.exit(); }, []);

  return { immersive, enter, exit };
}

const Transport: React.FC<{
  playback: WordNewOrchComposePlayback;
  theme: ElementTheme;
  trans: Trans;
  compact: boolean;
  dark: boolean;
  trailing?: React.ReactNode;
}> = ({ playback, theme, trans, compact, dark, trailing }) => {
  const { sequencer, segment, segmentCount, setSegment, rate, setRate } = playback;
  const tone = CONTROL_TONE[dark ? 'dark' : 'light'];
  const iconButton = `rounded-full p-2 transition-colors disabled:opacity-30 ${tone}`;
  const muted = dark ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400';
  return (
    <div className="space-y-1.5">
      <input
        type="range"
        min={0}
        max={Math.max(0.1, sequencer.duration)}
        step={0.1}
        value={Math.min(sequencer.time, sequencer.duration)}
        onChange={(event) => sequencer.seek(Number(event.target.value))}
        className="block h-6 w-full cursor-pointer touch-none accent-indigo-400"
        aria-label={trans('orchCompose.seek')}
      />
      <div className="flex items-center gap-1">
        <span className={`min-w-0 font-mono text-[10px] tabular-nums ${muted}`}>
          {formatClockTime(sequencer.time)} / {formatClockTime(sequencer.duration)}
        </span>
        <div className="mx-auto flex items-center gap-1">
          <button type="button" disabled={segment === 0} onClick={() => setSegment(segment - 1)} className={iconButton} aria-label={trans('orchAudio.prev')} title={trans('orchAudio.prev')}>
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={sequencer.toggle}
            className={`rounded-full border shadow-lg ${compact ? 'p-2' : 'p-3'} ${theme.accentBg}`}
            aria-label={trans(sequencer.playing ? 'orchAudio.pause' : 'orchAudio.play')}
          >
            {sequencer.playing ? <Pause className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : <Play className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} translate-x-px`} />}
          </button>
          <button type="button" disabled={segment + 1 >= segmentCount} onClick={() => setSegment(segment + 1)} className={iconButton} aria-label={trans('orchAudio.next')} title={trans('orchAudio.next')}>
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setRate(nextRate(rate))}
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 font-mono text-[10px] font-bold ${tone}`}
          aria-label={trans('orchAudio.speed')}
          title={trans('orchAudio.speed')}
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden />{rate}x
        </button>
        {trailing}
      </div>
    </div>
  );
};

const SegmentTabs: React.FC<{ playback: WordNewOrchComposePlayback; theme: ElementTheme; trans: Trans }> = ({ playback, theme, trans }) => {
  if (playback.segmentCount <= 1) return null;
  return (
    <OrchTabs
      nowrap
      shape="mono"
      theme={theme}
      label={trans('orchAudio.segmentCount', { count: playback.segmentCount })}
      value={playback.segment}
      options={Array.from({ length: playback.segmentCount }, (_, index) => ({ value: index, label: index + 1 }))}
      onChange={playback.setSegment}
    />
  );
};

export const WordNewOrchComposePlayer: React.FC<Props> = ({ variant, playback, settings, label, theme, trans, onOpenPlayer, loadWidget }) => {
  const { immersive, enter, exit } = useImmersive();
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { sequencer } = playback;
  // The player page keeps the screen on while it plays (the preview does not).
  useKeepAwake(variant === 'full' && sequencer.playing, 'orch-player');

  const revealControls = useCallback((): void => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    if (!immersive || !sequencer.playing) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
      return;
    }
    revealControls();
  }, [immersive, sequencer.playing, revealControls]);
  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  const stage = (
    <OrchStage
      cards={playback.cards}
      settings={settings}
      timeRef={sequencer.timeRef}
      duration={sequencer.duration}
      label={label}
      newWords={playback.newWords}
      newLabel={trans('orchCompose.newWords.badge')}
    />
  );

  if (variant === 'preview') {
    return (
      <OrchPanel theme={theme} label={trans('orchCompose.preview')} className="space-y-2.5">
        <OrchPanelHeader icon={Eye} title={trans('orchCompose.preview')} theme={theme}>
          {playback.segmentCount > 1 && (
            <span className="font-mono text-[10px] text-zinc-500">{playback.segment + 1}/{playback.segmentCount}</span>
          )}
          {onOpenPlayer && (
            <OrchButton icon={Maximize2} className="ml-auto" onClick={() => { sequencer.pause(); onOpenPlayer(); }}>
              {trans('orchCompose.openPlayer')}
            </OrchButton>
          )}
        </OrchPanelHeader>
        {stage}
        <Transport playback={playback} theme={theme} trans={trans} compact dark={false} />
      </OrchPanel>
    );
  }

  const fullscreenButton = (dark: boolean): React.ReactNode => (
    <button
      type="button"
      onClick={() => (immersive ? exit() : enter())}
      className={`rounded-full p-2 ${CONTROL_TONE[dark ? 'dark' : 'light']}`}
      aria-label={trans(immersive ? 'library.exitFullscreen' : 'library.fullscreen')}
      title={trans(immersive ? 'library.exitFullscreen' : 'library.fullscreen')}
    >
      {immersive ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </button>
  );

  if (immersive) {
    return (
      <ModalShell onClose={exit} locked backdrop="black" cardClassName={null}>
        <div className="absolute inset-0 flex items-center justify-center bg-black" onPointerMove={revealControls}>
          <button
            type="button"
            className="block w-full"
            style={{ maxWidth: 'min(100vw, calc(100dvh * 16 / 9))' }}
            onClick={() => (controlsVisible && sequencer.playing ? setControlsVisible(false) : revealControls())}
            aria-label={label}
          >
            {stage}
          </button>
          <div className={`pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-6 pt-[max(0.75rem,var(--wf-safe-top,0px))] ${controlsVisible ? 'pointer-events-auto' : ''}`}>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{label}</span>
              {loadWidget?.(true)}
            </div>
            <div className={`bg-gradient-to-t from-black/80 to-transparent pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,var(--wf-safe-bottom,0px))] pt-8 ${controlsVisible ? 'pointer-events-auto' : ''}`}>
              <div className="mx-auto max-w-3xl">
                <Transport playback={playback} theme={theme} trans={trans} compact={false} dark trailing={fullscreenButton(true)} />
              </div>
            </div>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10">{stage}</div>
      <OrchPanel as="div" theme={theme}>
        <Transport playback={playback} theme={theme} trans={trans} compact={false} dark={false} trailing={fullscreenButton(false)} />
      </OrchPanel>
      <SegmentTabs playback={playback} theme={theme} trans={trans} />
    </div>
  );
};
