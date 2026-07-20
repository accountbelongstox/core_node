/**
 * useWfNewReciteController — the audio auto-play recitation loop for the shelf
 * study surface, ported from the legacy client's playControlNewCase.
 *
 * For each word it plays the pronunciation `wmPlayCount` times (interval
 * `wmPlayInterval` between plays, speed `wmPlaybackSpeed`), auto-scrolls it into
 * view, counts it as read (wfNewStudyProgress.recordSeen), then advances; when a
 * replay gap is configured it "glimpses" an earlier word `wmReplayCount` times at
 * `wmReplaySpeed` (the legacy 闪读 behavior). Play/pause driven; loops at the end.
 *
 * Audio: a real `Word.audioUrl` (absolute http) plays through an HTMLAudioElement
 * at the set rate; otherwise it falls back to Web-Speech (speechSynthesis). A
 * hard per-utterance timeout keeps the loop from stalling on a silent/failed clip.
 * All settings are read live from wfNewSettings (the app's persisted store), so
 * the settings sheet edits take effect on the next word with no restart.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Word } from '../../api';
import { wfNewSettings } from '../../WfNewSettingsStore';
import { accentToBcp47, mapUiAccent, resolvePracticeVoice } from '../../hooks/wfWordAudioFallback';
import { wfNewStudyProgress } from './WfNewStudyProgress';
import { resolveAudioSync } from '../../cache/WfNewAudioCache';

interface ReciteOptions {
  gid: string;
  words: Word[];
  language?: string;
  /** Scroll the active word into view (element resolved by the caller). */
  onActive?: (index: number) => void;
}

interface ReciteApi {
  index: number;
  isPlaying: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setIndex: (i: number) => void;
}

const isAbsoluteUrl = (u?: string): u is string =>
  !!u && (u.startsWith('http://') || u.startsWith('https://'));

const wait = (ms: number, aliveRef: React.MutableRefObject<boolean>): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    // If playback stops mid-wait, resolve promptly on the next check anyway;
    // clearing here keeps timers tidy when the component unmounts.
    if (!aliveRef.current) {
      clearTimeout(t);
      resolve();
    }
  });

export function useWfNewReciteController(opts: ReciteOptions): ReciteApi {
  const { gid, words, language, onActive } = opts;

  const [index, setIndexState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Live refs so the async loop always reads current values.
  const wordsRef = useRef<Word[]>(words);
  const indexRef = useRef(0);
  const playingRef = useRef(false);
  const genRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    wordsRef.current = words;
    // Clamp the index if the list shrank.
    if (indexRef.current >= words.length) {
      indexRef.current = 0;
      setIndexState(0);
    }
  }, [words]);

  const setIndex = useCallback(
    (i: number) => {
      const len = wordsRef.current.length;
      if (len === 0) return;
      const clamped = ((i % len) + len) % len;
      indexRef.current = clamped;
      setIndexState(clamped);
      onActive?.(clamped);
    },
    [onActive],
  );

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }, []);

  /** Play one word once; resolves with the audio duration in seconds (0 when
   *  unknown, e.g. Web-Speech fallback or a failed clip) when it ends, errors,
   *  or times out. The duration feeds the per-word play_time submission. */
  const playOnce = useCallback((word: Word, speed: number): Promise<number> => {
    return new Promise<number>((resolve) => {
      let done = false;
      let capturedDuration = 0;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        resolve(capturedDuration);
      };
      // Hard ceiling so a missing/stuck clip can never freeze the loop.
      const guard = setTimeout(finish, 8000);

      if (isAbsoluteUrl(word.audioUrl)) {
        try {
          // Play the LOCALLY CACHED clip when preloaded (the pager preloads the
          // current + next page's audio); resolveAudioSync falls back to the
          // remote URL and caches it in the background for the next play.
          const audio = new Audio(resolveAudioSync(word.audioUrl) ?? word.audioUrl);
          audio.playbackRate = speed > 0 ? speed : 1;
          audioRef.current = audio;
          // Capture the real clip duration once metadata loads (natural length,
          // not speed-adjusted) so the loop can report play_time for this word.
          audio.onloadedmetadata = () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              capturedDuration = audio.duration;
            }
          };
          audio.onended = finish;
          audio.onerror = () => {
            // Real file failed — fall back to speech synthesis once.
            speak(word.text, speed, finish);
          };
          void audio.play().catch(() => speak(word.text, speed, finish));
          return;
        } catch {
          /* fall through to speech */
        }
      }
      speak(word.text, speed, finish);
    });
  }, []);

  const runLoop = useCallback(async () => {
    const myGen = ++genRef.current;
    const alive = { current: true };
    playingRef.current = true;

    const aliveCheck = () => playingRef.current && genRef.current === myGen;

    while (aliveCheck()) {
      const list = wordsRef.current;
      if (list.length === 0) break;
      const i = indexRef.current;
      const word = list[i];
      if (!word) {
        setIndex(0);
        continue;
      }
      onActive?.(i);

      const playCount = clampInt(wfNewSettings.get('wmPlayCount'), 1, 10);
      const interval = clampNum(wfNewSettings.get('wmPlayInterval'), 0, 30) * 1000;
      const speed = clampNum(wfNewSettings.get('wmPlaybackSpeed'), 0.5, 2);

      // Track the real clip duration (seconds) across this word's plays so the
      // per-word play_time can be submitted to the backend mapping table (§5.5).
      let audioDurationSeconds = 0;
      for (let p = 0; p < playCount; p++) {
        if (!aliveCheck()) break;
        const dur = await playOnce(word, speed);
        if (dur > 0) audioDurationSeconds = dur;
        if (!aliveCheck()) break;
        if (p < playCount - 1) await wait(interval, alive);
      }
      if (!aliveCheck()) break;

      // play_time = playCount * (real audio duration || configured interval),
      // clamped to [1, 600] seconds (§5.5 implementation note).
      const intervalSeconds = clampNum(wfNewSettings.get('wmPlayInterval'), 0, 30);
      const playTimeSeconds = clampInt(
        playCount * (audioDurationSeconds || intervalSeconds),
        1,
        600,
      );
      wfNewStudyProgress.recordSeen(gid, word, language, playTimeSeconds);

      // Legacy "glimpse" — replay a word a few positions back.
      const gap = clampInt(wfNewSettings.get('wmReplayGapWords'), 0, 20);
      const replayCount = clampInt(wfNewSettings.get('wmReplayCount'), 0, 10);
      if (gap > 0 && replayCount > 0 && list.length > gap) {
        const prev = list[(i - gap + list.length) % list.length];
        const replaySpeed = clampNum(wfNewSettings.get('wmReplaySpeed'), 0.5, 2);
        const replayInterval = clampNum(wfNewSettings.get('wmReplayInterval'), 0, 30) * 1000;
        for (let r = 0; r < replayCount; r++) {
          if (!aliveCheck()) break;
          await playOnce(prev, replaySpeed);
          if (r < replayCount - 1) await wait(replayInterval, alive);
        }
      }
      if (!aliveCheck()) break;

      await wait(interval, alive);
      if (!aliveCheck()) break;
      setIndex(i + 1); // wraps → continuous loop until paused
    }

    alive.current = false;
    if (genRef.current === myGen) {
      playingRef.current = false;
      setIsPlaying(false);
    }
  }, [gid, language, onActive, playOnce, setIndex]);

  const play = useCallback(() => {
    if (playingRef.current || wordsRef.current.length === 0) return;
    setIsPlaying(true);
    void runLoop();
  }, [runLoop]);

  const pause = useCallback(() => {
    playingRef.current = false;
    genRef.current += 1; // invalidate the running loop
    stopAudio();
    setIsPlaying(false);
  }, [stopAudio]);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  const next = useCallback(() => {
    setIndex(indexRef.current + 1);
  }, [setIndex]);

  const prev = useCallback(() => {
    setIndex(indexRef.current - 1);
  }, [setIndex]);

  // Stop audio + invalidate the loop on unmount.
  useEffect(() => {
    return () => {
      playingRef.current = false;
      genRef.current += 1;
      stopAudio();
    };
  }, [stopAudio]);

  return { index, isPlaying, toggle, play, pause, next, prev, setIndex };
}

// ---- helpers ----

function speak(text: string, speed: number, onDone: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    // No speech available — advance after a short beat so the loop keeps moving.
    setTimeout(onDone, 600);
    return;
  }
  try {
    // Resolve the fallback voice: chosen wmVoiceUri → accent-matched → any en-* →
    // first available. lang follows the voice (or the accent when none loaded yet),
    // so the loop always makes an attempt rather than silently skipping.
    const accent = mapUiAccent(String(wfNewSettings.get('voiceAccent')));
    const voice = resolvePracticeVoice(String(wfNewSettings.get('wmVoiceUri')), accent);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang ?? accentToBcp47(accent);
    if (voice) u.voice = voice;
    u.rate = speed > 0 ? speed : 1;
    u.onend = onDone;
    u.onerror = onDone;
    window.speechSynthesis.speak(u);
  } catch {
    setTimeout(onDone, 600);
  }
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampNum(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
