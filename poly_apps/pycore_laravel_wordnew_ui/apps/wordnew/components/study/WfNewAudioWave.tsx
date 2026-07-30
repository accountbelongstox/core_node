/**
 * WfNewAudioWave — a compact, PLAYABLE audio visual (音波) for a study word.
 *
 * Renders an equalizer-style bar visual that animates while the word is playing
 * and, on click, plays the word's REAL audio (its absolute audioUrl / the
 * selected voice's file). Dependency-free: the bars are plain <span> elements
 * driven by a single injected CSS keyframe (no waveform library, no
 * AnalyserNode). Animation runs while the external `playing` flag is set (the
 * recite loop) OR for a brief self-pulse right after a manual tap, so every
 * surface gets feedback even without a playback-state flag.
 *
 * Playback: when `onPlay` is supplied the click routes THROUGH it (so callers
 * reuse their existing real-audio → Web-Speech path — no double audio); with no
 * `onPlay` the component plays the URL itself via a hidden <audio> element.
 *
 * Also shows an audio-count badge — how many audios this word has
 * (audioCount ?? audioFiles.length). When there are multiple audioFiles the
 * badge becomes a control that cycles the active voice; the wave then plays that
 * voice's file.
 */
import React, { useEffect, useRef, useState } from 'react';
import { translate } from '../../WfNewLocales';
import { resolveAudioSync } from '../../cache/WfNewAudioCache';

export interface WfNewAudioFile {
  url?: string;
  voice?: string;
  lang?: string;
}

interface WfNewAudioWaveProps {
  lang: string;
  /** Absolute primary audio URL (fallback when there are no audioFiles). */
  audioUrl?: string;
  /** Per-voice audio files; a multi-entry list turns the badge into a voice cycler. */
  audioFiles?: WfNewAudioFile[];
  /** Explicit audio count; else derived from audioFiles / audioUrl. */
  audioCount?: number;
  /** External playback flag (e.g. recite.isPlaying) that drives the animation. */
  playing?: boolean;
  /** Preferred play path — reuses the caller's real-audio → Web-Speech fallback. */
  onPlay?: (url?: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

// Relative bar heights (0..1), scaled by the keyframe while active.
const BAR_HEIGHTS = [0.5, 0.85, 1, 0.7, 0.45];
const STYLE_ID = 'wfnew-audiowave-styles';

let stylesInjected = false;

/** Inject the shared equalizer keyframe once for the whole app. */
function ensureStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent =
      '@keyframes wfnewEq{0%,100%{transform:scaleY(0.32)}50%{transform:scaleY(1)}}';
    document.head.appendChild(el);
  }
  stylesInjected = true;
}

const isAbsoluteUrl = (u?: string): u is string =>
  !!u && (u.startsWith('http://') || u.startsWith('https://'));

export const WfNewAudioWave: React.FC<WfNewAudioWaveProps> = ({
  lang,
  audioUrl,
  audioFiles,
  audioCount,
  playing = false,
  onPlay,
  size = 'sm',
  className,
}) => {
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const pulseTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    ensureStyles();
    return () => {
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    };
  }, []);

  const files = (audioFiles ?? []).filter((f) => !!f.url);
  const safeIndex = files.length ? voiceIndex % files.length : 0;
  const currentUrl = files[safeIndex]?.url ?? audioUrl;
  const count = typeof audioCount === 'number' ? audioCount : files.length || (audioUrl ? 1 : 0);
  const active = playing || pulsing;
  const barWidth = size === 'md' ? 3 : 2;
  const barGap = size === 'md' ? 3 : 2;

  // Nothing to play and no visual purpose → render nothing.
  if (!onPlay && !isAbsoluteUrl(currentUrl) && count === 0) return null;

  const triggerPulse = (): void => {
    setPulsing(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulsing(false), 1600);
  };

  const play = (): void => {
    if (onPlay) {
      onPlay(currentUrl);
    } else if (isAbsoluteUrl(currentUrl) && audioRef.current) {
      audioRef.current.src = resolveAudioSync(currentUrl) ?? currentUrl;
      void audioRef.current.play().catch(() => undefined);
    }
    triggerPulse();
  };

  const handlePlay = (e: React.MouseEvent): void => {
    e.stopPropagation();
    play();
  };

  const handleBadge = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (files.length > 1) setVoiceIndex((i) => (i + 1) % files.length);
    else play();
  };

  const voiceLabel = files[safeIndex]?.voice;
  const badgeTitle =
    translate(lang, 'study.audioCount', { n: count }) +
    (files.length > 1 ? ` · ${translate(lang, 'study.switchVoice')}` : '');

  return (
    <div className={`inline-flex items-center gap-1.5 shrink-0 ${className ?? ''}`}>
      <button
        type="button"
        onClick={handlePlay}
        title={translate(lang, 'audio.play')}
        aria-label={translate(lang, 'audio.play')}
        className={`inline-flex items-end justify-center rounded-md px-1 transition-colors ${
          size === 'md' ? 'h-5' : 'h-4'
        } ${active ? 'text-indigo-400' : 'text-zinc-500 hover:text-indigo-400'}`}
        style={{ gap: barGap }}
      >
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            aria-hidden
            className="rounded-full bg-current"
            style={{
              width: barWidth,
              height: '100%',
              transformOrigin: 'bottom',
              transform: active ? undefined : `scaleY(${h * 0.5})`,
              animation: active
                ? `wfnewEq ${0.7 + (i % 3) * 0.12}s ease-in-out ${i * 0.09}s infinite`
                : undefined,
            }}
          />
        ))}
      </button>

      {count > 0 && (
        <button
          type="button"
          onClick={handleBadge}
          title={badgeTitle}
          aria-label={badgeTitle}
          className="inline-flex items-center gap-0.5 rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-mono font-bold leading-none text-indigo-300/90 hover:bg-indigo-500/20"
        >
          <span>{count}</span>
          {files.length > 1 && voiceLabel && (
            <span className="max-w-[52px] truncate text-indigo-300/70">{voiceLabel}</span>
          )}
        </button>
      )}

      {!onPlay && <audio ref={audioRef} preload="none" />}
    </div>
  );
};
