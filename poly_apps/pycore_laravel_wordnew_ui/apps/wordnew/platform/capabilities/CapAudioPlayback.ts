/** Recorded-clip playback, download, waveform helpers, and React state. */
import { useEffect, useRef, useState } from 'react';
import { base64ToBlob, capRecorder } from './CapAudioRecorderCore';
import type { CapRecordingClip } from './CapAudioRecorderCore';
// ===========================================================================
// EXTENDED CAPABILITIES — playback, waveform peaks, download
// ===========================================================================
//
// A recorded clip is only useful if the learner can play it back and see it.
// These helpers (built primarily for the wordnew mobile APP pronunciation flow)
// add a tiny playback controller, an offline waveform-peak decoder for drawing
// the clip, and a download/share helper — all cross-platform.

/** Resolve a playable src for a clip (object URL on web, data URL otherwise). */
export function clipPlaybackSrc(clip: CapRecordingClip): string {
  return clip.url || clip.dataUrl;
}

/** Suggest a filename for saving/uploading a clip, e.g. wordnew-rec-….webm. */
export function clipFileName(clip: CapRecordingClip, prefix = 'wordnew-rec'): string {
  const ext = mimeToExt(clip.mimeType);
  return `${prefix}-${clip.timestamp}.${ext}`;
}

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'audio';
}

/** Trigger a browser download of a clip (web only; no-op without DOM). */
export function downloadClip(clip: CapRecordingClip, fileName?: string): void {
  try {
    const blob = clip.blob || base64ToBlob(clip.base64, clip.mimeType);
    const url = clip.url || URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || clipFileName(clip);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!clip.url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* no DOM / unsupported */
  }
}

/**
 * Decode a clip into `buckets` normalized peak values (0..1) for drawing a
 * static waveform. Uses an OfflineAudioContext when available; returns null if
 * decoding is unsupported (e.g. some WebViews) so callers can fall back.
 */
export async function decodeWaveformPeaks(
  clip: CapRecordingClip,
  buckets = 96,
): Promise<number[] | null> {
  try {
    const Ctx: any =
      (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) ||
      null;
    if (!Ctx) return null;
    const blob = clip.blob || base64ToBlob(clip.base64, clip.mimeType);
    const arrayBuf = await blob.arrayBuffer();
    const ctx = new Ctx();
    const audioBuf: AudioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    const channel = audioBuf.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / buckets));
    const peaks: number[] = [];
    let max = 0.0001;
    for (let b = 0; b < buckets; b++) {
      let peak = 0;
      const start = b * block;
      for (let i = 0; i < block && start + i < channel.length; i++) {
        const v = Math.abs(channel[start + i]);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
      if (peak > max) max = peak;
    }
    try {
      await ctx.close();
    } catch {
      /* ignore */
    }
    return peaks.map((p) => p / max); // normalize 0..1
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Clip playback controller (one <audio> element wrapper with events)
// ---------------------------------------------------------------------------

export type CapPlaybackState = 'idle' | 'playing' | 'paused' | 'ended';

export interface CapPlaybackStatus {
  state: CapPlaybackState;
  /** Current playback position in seconds. */
  currentTime: number;
  /** Total duration in seconds (NaN until metadata loads). */
  duration: number;
  /** 0..1 progress. */
  progress: number;
}

/**
 * A minimal audio playback controller around an HTMLAudioElement. Lets a UI
 * play/pause/seek a recorded clip and subscribe to progress without each screen
 * managing an <audio> element by hand.
 */
export class CapClipPlayer {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<(s: CapPlaybackStatus) => void>();
  private currentUrl = '';
  private ownsUrl = false;

  private status: CapPlaybackStatus = { state: 'idle', currentTime: 0, duration: NaN, progress: 0 };

  /** Load a clip (replaces any currently-loaded one). */
  load(clip: CapRecordingClip): void {
    this.unload();
    if (typeof Audio === 'undefined') return;
    if (clip.url) {
      this.currentUrl = clip.url;
      this.ownsUrl = false;
    } else {
      const blob = clip.blob || base64ToBlob(clip.base64, clip.mimeType);
      this.currentUrl = URL.createObjectURL(blob);
      this.ownsUrl = true;
    }
    const audio = new Audio(this.currentUrl);
    this.audio = audio;
    audio.addEventListener('timeupdate', () => this.publish('playing'));
    audio.addEventListener('loadedmetadata', () => this.publish(this.status.state));
    audio.addEventListener('play', () => this.publish('playing'));
    audio.addEventListener('pause', () => {
      if (this.status.state !== 'ended') this.publish('paused');
    });
    audio.addEventListener('ended', () => this.publish('ended'));
  }

  async play(): Promise<void> {
    await this.audio?.play();
    this.publish('playing');
  }
  pause(): void {
    this.audio?.pause();
    this.publish('paused');
  }
  toggle(): void {
    if (!this.audio) return;
    if (this.audio.paused) void this.play();
    else this.pause();
  }
  /** Seek to a fraction 0..1 of the clip. */
  seekFraction(fraction: number): void {
    if (!this.audio || !Number.isFinite(this.audio.duration)) return;
    this.audio.currentTime = Math.max(0, Math.min(1, fraction)) * this.audio.duration;
    this.publish(this.status.state === 'idle' ? 'paused' : this.status.state);
  }

  subscribe(fn: (s: CapPlaybackStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }
  getStatus(): CapPlaybackStatus {
    return this.status;
  }

  private publish(state: CapPlaybackState): void {
    const a = this.audio;
    const currentTime = a?.currentTime ?? 0;
    const duration = a?.duration ?? NaN;
    const progress = Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0;
    this.status = { state, currentTime, duration, progress };
    for (const fn of Array.from(this.listeners)) {
      try {
        fn(this.status);
      } catch {
        /* ignore */
      }
    }
  }

  /** Release the element + any owned object URL. */
  unload(): void {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
      } catch {
        /* ignore */
      }
    }
    if (this.ownsUrl && this.currentUrl) {
      try {
        URL.revokeObjectURL(this.currentUrl);
      } catch {
        /* ignore */
      }
    }
    this.audio = null;
    this.currentUrl = '';
    this.ownsUrl = false;
    this.status = { state: 'idle', currentTime: 0, duration: NaN, progress: 0 };
  }

  dispose(): void {
    this.unload();
    this.listeners.clear();
  }
}

/**
 * React hook: play back a clip with live progress.
 *
 *   const { status, play, pause, toggle, seek } = useClipPlayback(lastClip);
 */
export function useClipPlayback(clip: CapRecordingClip | null): {
  status: CapPlaybackStatus;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  seek: (fraction: number) => void;
} {
  const playerRef = useRef<CapClipPlayer | null>(null);
  if (!playerRef.current) playerRef.current = new CapClipPlayer();
  const [status, setStatus] = useState<CapPlaybackStatus>(() => playerRef.current!.getStatus());

  useEffect(() => {
    const player = playerRef.current!;
    const off = player.subscribe(setStatus);
    return () => {
      off();
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (clip) player.load(clip);
    else player.unload();
  }, [clip]);

  return {
    status,
    play: () => playerRef.current?.play() ?? Promise.resolve(),
    pause: () => playerRef.current?.pause(),
    toggle: () => playerRef.current?.toggle(),
    seek: (f: number) => playerRef.current?.seekFraction(f),
  };
}


