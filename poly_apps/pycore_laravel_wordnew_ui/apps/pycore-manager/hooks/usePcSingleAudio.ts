import { useCallback, useEffect, useRef, useState } from 'react';

export interface PcSingleAudio {
  playing: boolean;
  /** Stops any current clip; resolves when the new clip ends or is stopped, rejects on a load or play failure. */
  play: (src: string) => Promise<void>;
  stop: () => void;
}

/**
 * One audio element per view: a new clip stops the previous one, and
 * unmounting the view stops playback.
 */
export function usePcSingleAudio(): PcSingleAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const settleRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const [playing, setPlaying] = useState(false);

  const release = useCallback(() => {
    const audio = audioRef.current;
    const settle = settleRef.current;
    audioRef.current = null;
    settleRef.current = null;
    audio?.pause();
    settle?.();
  }, []);

  const stop = useCallback(() => {
    release();
    if (mountedRef.current) setPlaying(false);
  }, [release]);

  const play = useCallback((src: string) => {
    release();
    const audio = new Audio(src);
    audioRef.current = audio;
    setPlaying(true);
    return new Promise<void>((resolve, reject) => {
      const finish = (failed: boolean, reason?: unknown) => {
        audio.onended = null;
        audio.onerror = null;
        if (audioRef.current === audio) {
          audioRef.current = null;
          settleRef.current = null;
        }
        if (mountedRef.current && audioRef.current === null) setPlaying(false);
        if (failed) reject(reason);
        else resolve();
      };
      settleRef.current = () => finish(false);
      audio.onended = () => finish(false);
      audio.onerror = () => finish(true, audio.error);
      audio.play().catch((error: unknown) => finish(true, error));
    });
  }, [release]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      release();
    };
  }, [release]);

  return { playing, play, stop };
}
