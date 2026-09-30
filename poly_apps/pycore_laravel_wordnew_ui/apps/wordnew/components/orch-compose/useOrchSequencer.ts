import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrchTimelineEntry } from '../../services/orchestration/orchStageLayout';

export interface OrchSequencer {
  playing: boolean;
  /** Seconds on the segment timeline (clips + gaps). */
  time: number;
  duration: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  /** Read the live position (animation frames) without a React render. */
  timeRef: React.MutableRefObject<number>;
}

const RENDER_INTERVAL_MS = 200;

function indexAt(timeline: OrchTimelineEntry[], ms: number): number {
  let hit = 0;
  for (let index = 0; index < timeline.length; index += 1) {
    if (timeline[index].startMs <= ms) hit = index;
    else break;
  }
  return hit;
}

/**
 * Plays a segment timeline on one audio element: each clip at its offset, the
 * gap between clips as silence, so the virtual clock equals the timeline the
 * stage and pycore's renderer use.
 */
export function useOrchSequencer(timeline: OrchTimelineEntry[], rate: number, onEnded?: () => void): OrchSequencer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(0);
  const indexRef = useRef(0);
  const playingRef = useRef(false);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapStartRef = useRef<{ at: number; from: number } | null>(null);
  const endedRef = useRef(onEnded);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  endedRef.current = onEnded;
  const duration = (timeline[timeline.length - 1]?.endMs ?? 0) / 1000;

  const clearGap = (): void => {
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    gapTimerRef.current = null;
    gapStartRef.current = null;
  };

  const startClip = useCallback((index: number, offsetMs: number): void => {
    const audio = audioRef.current;
    const entry = timeline[index];
    if (!audio || !entry) return;
    clearGap();
    indexRef.current = index;
    if (audio.src !== entry.clipUrl) audio.src = entry.clipUrl;
    audio.playbackRate = rate;
    const seekTo = Math.max(0, offsetMs / 1000);
    const begin = (): void => {
      audio.currentTime = seekTo;
      if (playingRef.current) void audio.play().catch(() => undefined);
    };
    if (audio.readyState >= 1) begin();
    else audio.addEventListener('loadedmetadata', begin, { once: true });
  }, [timeline, rate]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => {
      clearGap();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const handleEnded = (): void => {
      const index = indexRef.current;
      const entry = timeline[index];
      const next = timeline[index + 1];
      if (!entry || !next) {
        playingRef.current = false;
        setPlaying(false);
        timeRef.current = duration;
        setTime(duration);
        endedRef.current?.();
        return;
      }
      const gapMs = (next.startMs - entry.endMs) / rate;
      gapStartRef.current = { at: performance.now(), from: entry.endMs };
      gapTimerRef.current = setTimeout(() => startClip(index + 1, 0), Math.max(0, gapMs));
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [timeline, rate, duration, startClip]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    let frame = 0;
    let lastRender = 0;
    const tick = (now: number): void => {
      const audio = audioRef.current;
      const entry = timeline[indexRef.current];
      if (audio && entry && playingRef.current) {
        const gap = gapStartRef.current;
        timeRef.current = gap
          ? (gap.from + (now - gap.at) * rate) / 1000
          : (entry.startMs / 1000) + audio.currentTime;
        if (now - lastRender >= RENDER_INTERVAL_MS) {
          lastRender = now;
          setTime(timeRef.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [timeline, rate]);

  const seek = useCallback((seconds: number): void => {
    const ms = Math.max(0, Math.min(seconds * 1000, duration * 1000));
    const index = indexAt(timeline, ms);
    const entry = timeline[index];
    timeRef.current = ms / 1000;
    setTime(ms / 1000);
    if (!entry) return;
    if (ms > entry.endMs && timeline[index + 1]) {
      startClip(index + 1, 0);
      return;
    }
    startClip(index, Math.min(ms, entry.endMs) - entry.startMs);
  }, [timeline, duration, startClip]);

  const play = useCallback((): void => {
    if (timeline.length === 0) return;
    playingRef.current = true;
    setPlaying(true);
    const atEnd = timeRef.current >= duration - 0.05;
    seek(atEnd ? 0 : timeRef.current);
  }, [timeline, duration, seek]);

  const pause = useCallback((): void => {
    playingRef.current = false;
    setPlaying(false);
    clearGap();
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback((): void => {
    if (playingRef.current) pause();
    else play();
  }, [play, pause]);

  useEffect(() => {
    pause();
    timeRef.current = 0;
    setTime(0);
    indexRef.current = 0;
  }, [timeline, pause]);

  return { playing, time, duration, play, pause, toggle, seek, timeRef };
}
