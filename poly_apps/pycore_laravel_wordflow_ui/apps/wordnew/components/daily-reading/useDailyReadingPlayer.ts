/** Sequential playlist player for the Daily Reading block. Owns ONE shared
 * Audio element: start(rows) filters to rows that actually have audio, plays
 * them in order and auto-advances on `ended` (a load/play error skips to the
 * next track instead of stalling). close() stops and dismisses the overlay. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyReadingRow } from './dailyReadingApi';
import { resolveAudioSync } from '../../cache/WfNewAudioCache';

export interface DailyReadingPlayer {
  open: boolean;
  playing: boolean;
  list: DailyReadingRow[];
  index: number;
  current: DailyReadingRow | null;
  currentTime: number;
  duration: number;
  start: (rows: DailyReadingRow[], startId?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
}

export function useDailyReadingPlayer(): DailyReadingPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<DailyReadingRow[]>([]);
  const indexRef = useRef(0);
  const nextRef = useRef<() => void>(() => undefined);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [list, setList] = useState<DailyReadingRow[]>([]);
  const [index, setIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playAt = useCallback((i: number) => {
    const rows = listRef.current;
    if (rows.length === 0) return;
    const clamped = Math.max(0, Math.min(i, rows.length - 1));
    const row = rows[clamped];
    if (!row?.audio_url) return;
    indexRef.current = clamped;
    setIndex(clamped);
    setCurrentTime(0);
    setDuration(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = resolveAudioSync(row.audio_url) ?? row.audio_url;
    audio.currentTime = 0;
    void audio.play().then(() => setPlaying(true)).catch((error: unknown) => {
      setPlaying(false);
      if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') {
        nextRef.current();
      }
    });
  }, []);

  const next = useCallback(() => {
    if (indexRef.current < listRef.current.length - 1) {
      playAt(indexRef.current + 1);
    } else {
      // End of playlist: pause on the last track, keep the overlay open.
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [playAt]);
  nextRef.current = next;

  // Lazily build the single shared Audio element; ended/error auto-advance.
  if (!audioRef.current && typeof Audio !== 'undefined') {
    const audio = new Audio();
    audio.onended = () => nextRef.current();
    // Skip broken audio; ignore the error a src reset fires during close().
    audio.onerror = () => {
      if (audioRef.current?.src) nextRef.current();
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
      setDuration(audio.duration || 0);
    };
    audioRef.current = audio;
  }

  const start = useCallback((rows: DailyReadingRow[], startId?: string) => {
    const playable = rows.filter((r) => !!r.audio_url);
    if (playable.length === 0) return;
    listRef.current = playable;
    setList(playable);
    setOpen(true);
    const at = startId ? playable.findIndex((r) => r.id === startId) : 0;
    playAt(at >= 0 ? at : 0);
  }, [playAt]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const prev = useCallback(() => {
    playAt(indexRef.current > 0 ? indexRef.current - 1 : 0);
  }, [playAt]);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setPlaying(false);
    setOpen(false);
  }, []);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return {
    open,
    playing,
    list,
    index,
    current: list[index] ?? null,
    currentTime,
    duration,
    start,
    toggle,
    next,
    prev,
    close,
  };
}
