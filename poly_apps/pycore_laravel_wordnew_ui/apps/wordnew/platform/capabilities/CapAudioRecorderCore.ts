/* =============================================================================
 * CapAudioRecorder — public, cross-platform VOICE / AUDIO RECORDING library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): pronunciation practice / shadowing / spoken answers all need to
 *   capture the learner's voice and hand back a playable, uploadable clip. The
 *   web shell records with the same API via MediaRecorder.
 *
 * WHAT IT DOES
 *   - Permission lifecycle (can-record / has-permission / request).
 *   - start / pause / resume / stop, with a live duration ticker + events.
 *   - Optional max-duration auto-stop and a "max size" guard.
 *   - Returns a normalized result: base64 + (web) Blob + object URL + mimeType
 *     + duration(ms) + size(bytes) — ready to <audio> play, download, or upload.
 *   - Helpers: base64<->Blob, object-URL lifecycle, mm:ss formatting.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: capacitor-voice-recorder (base64 result, OS encoder) — the
 *     maintained continuation of the unpublished
 *     @capacitor-community/voice-recorder (same VoiceRecorder API).
 *   - Web: getUserMedia + MediaRecorder (Blob result; base64 derived for parity).
 *     On the web build the plugin is aliased to a MediaRecorder-backed shim too.
 *
 * QUICK START
 *   import { capRecorder, useAudioRecorder } from '@/apps/wordnew/platform/capabilities/CapAudioRecorder';
 *   await capRecorder.requestPermission();
 *   await capRecorder.start({ maxDurationMs: 60000 });
 *   // ... later ...
 *   const clip = await capRecorder.stop();   // { base64, url?, blob?, mimeType, durationMs }
 *   // React: const { state, durationMs, start, stop, lastClip } = useAudioRecorder();
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { TypedEventEmitter } from '../../../../core/events/TypedEventEmitter';
import { blobToBase64 } from '../utils/blob';
import { formatBytes } from '../../../../core/utils/formatBytes';

export { blobToBase64, formatBytes };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapRecorderState = 'idle' | 'recording' | 'paused' | 'stopping';

export interface CapRecordingClip {
  /** Raw base64 (no data: prefix). Always present for cross-platform parity. */
  base64: string;
  /** A data: URL convenience for direct <audio src>. */
  dataUrl: string;
  /** Web only: the recorded Blob. */
  blob?: Blob;
  /** Web only: an object URL for the blob (remember to revoke when done). */
  url?: string;
  /** The MIME type the platform produced (e.g. audio/webm, audio/aac). */
  mimeType: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Size in bytes (decoded). */
  size: number;
  /** Where the clip came from. */
  source: 'native' | 'web';
  /** Epoch ms when recording stopped. */
  timestamp: number;
}

export interface CapRecorderStartOptions {
  /** Auto-stop after this many ms (0 = no limit). Default 0. */
  maxDurationMs?: number;
  /** Abort if the (web) recording exceeds this many bytes (0 = no limit). */
  maxBytes?: number;
  /** How often (ms) to emit 'duration' ticks. Default 200. */
  tickMs?: number;
}

export interface CapRecorderError {
  code:
    | 'permission-denied'
    | 'unsupported'
    | 'already-recording'
    | 'not-recording'
    | 'aborted'
    | 'unknown';
  message: string;
}

export interface CapRecorderEventMap {
  statechange: CapRecorderState;
  start: void;
  pause: void;
  resume: void;
  /** Emitted on the tick interval with elapsed ms. */
  duration: number;
  stop: CapRecordingClip;
  error: CapRecorderError;
}

export type CapRecorderListener<K extends keyof CapRecorderEventMap> = (
  p: CapRecorderEventMap[K],
) => void;

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers (exported)
// ---------------------------------------------------------------------------

/** "0:05" / "1:23" / "12:07" style mm:ss formatter from ms. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Convert raw base64 to a Blob of the given MIME type. */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const len = byteChars.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Approximate decoded byte length of a base64 string. */
export function base64Bytes(base64: string): number {
  const len = base64.length;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

function pickWebMime(): string {
  const MR: any = (typeof window !== 'undefined' && (window as any).MediaRecorder) || null;
  if (!MR || typeof MR.isTypeSupported !== 'function') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) if (MR.isTypeSupported(c)) return c;
  return '';
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const START_DEFAULTS: Required<CapRecorderStartOptions> = {
  maxDurationMs: 0,
  maxBytes: 0,
  tickMs: 200,
};

export class CapAudioRecorderService {
  private readonly emitter = new TypedEventEmitter<CapRecorderEventMap>('CapAudioRecorder');
  private readonly native = safeIsNative();
  private readonly logger?: (msg: string, ...args: unknown[]) => void;

  private state: CapRecorderState = 'idle';

  // web state
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private webMime = 'audio/webm';
  private webBytes = 0;

  // shared timing
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private startOpts: Required<CapRecorderStartOptions> = { ...START_DEFAULTS };

  constructor(options: { logger?: (msg: string, ...args: unknown[]) => void } = {}) {
    this.logger = options.logger;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.logger?.(`[CapAudioRecorder] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }
  getState(): CapRecorderState {
    return this.state;
  }
  isRecording(): boolean {
    return this.state === 'recording' || this.state === 'paused';
  }

  on<K extends keyof CapRecorderEventMap>(e: K, fn: CapRecorderListener<K>): () => void {
    return this.emitter.on(e, fn);
  }
  once<K extends keyof CapRecorderEventMap>(e: K, fn: CapRecorderListener<K>): () => void {
    return this.emitter.once(e, fn);
  }
  off<K extends keyof CapRecorderEventMap>(e: K, fn: CapRecorderListener<K>): void {
    this.emitter.off(e, fn);
  }

  private setState(s: CapRecorderState): void {
    if (s === this.state) return;
    this.state = s;
    this.emitter.emit('statechange', s);
  }

  /** Current elapsed recording time in ms (excludes paused time). */
  elapsedMs(): number {
    if (this.state === 'idle') return 0;
    const now = Date.now();
    const base = now - this.startedAt - this.pausedTotal;
    const live = this.state === 'paused' ? base - (now - this.pausedAt) : base;
    return Math.max(0, live);
  }

  /** Whether the platform can record audio at all. */
  async canRecord(): Promise<boolean> {
    try {
      if (this.native) {
        const r = await VoiceRecorder.canDeviceVoiceRecord();
        return !!r.value;
      }
      return (
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof (window as any)?.MediaRecorder !== 'undefined'
      );
    } catch {
      return false;
    }
  }

  /** Non-prompting permission check. */
  async hasPermission(): Promise<boolean> {
    try {
      if (this.native) {
        const r = await VoiceRecorder.hasAudioRecordingPermission();
        return !!r.value;
      }
      const perm = (navigator as any)?.permissions;
      if (perm?.query) {
        const res = await perm.query({ name: 'microphone' as PermissionName });
        return res.state === 'granted';
      }
    } catch {
      /* fall through */
    }
    return false;
  }

  /** Request microphone permission (may prompt). */
  async requestPermission(): Promise<boolean> {
    try {
      if (this.native) {
        const r = await VoiceRecorder.requestAudioRecordingPermission();
        return !!r.value;
      }
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  /** Begin recording. Throws a CapRecorderError on failure. */
  async start(options: CapRecorderStartOptions = {}): Promise<void> {
    if (this.isRecording()) throw this.fail('already-recording', 'A recording is already in progress.');
    if (!(await this.canRecord())) throw this.fail('unsupported', 'Audio recording is not supported here.');
    if (!(await this.hasPermission())) {
      const granted = await this.requestPermission();
      if (!granted) throw this.fail('permission-denied', 'Microphone permission was denied.');
    }

    this.startOpts = { ...START_DEFAULTS, ...options };
    this.startedAt = Date.now();
    this.pausedTotal = 0;
    this.pausedAt = 0;
    this.webBytes = 0;
    this.chunks = [];

    try {
      if (this.native) {
        await VoiceRecorder.startRecording();
      } else {
        await this.webStart();
      }
    } catch (err) {
      this.cleanup();
      throw this.fail('unknown', String((err as any)?.message || err));
    }

    this.setState('recording');
    this.emitter.emit('start', undefined);
    this.startTicker();
    if (this.startOpts.maxDurationMs > 0) {
      this.maxTimer = setTimeout(() => void this.stop().catch(() => {}), this.startOpts.maxDurationMs);
    }
    this.log('start', this.startOpts);
  }

  private async webStart(): Promise<void> {
    const MR: any = (window as any).MediaRecorder;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickWebMime();
    const recorder: MediaRecorder = mime ? new MR(stream, { mimeType: mime }) : new MR(stream);
    this.stream = stream;
    this.recorder = recorder;
    this.webMime = recorder.mimeType || mime || 'audio/webm';
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
        this.webBytes += e.data.size;
        if (this.startOpts.maxBytes > 0 && this.webBytes > this.startOpts.maxBytes) {
          // Abort: exceeded the configured size budget.
          this.emitter.emit('error', { code: 'aborted', message: 'Max size exceeded.' });
          void this.stop().catch(() => {});
        }
      }
    };
    recorder.start(250);
  }

  /** Pause an active recording. */
  async pause(): Promise<void> {
    if (this.state !== 'recording') throw this.fail('not-recording', 'Not currently recording.');
    if (this.native) {
      await VoiceRecorder.pauseRecording();
    } else if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.pause();
    }
    this.pausedAt = Date.now();
    this.setState('paused');
    this.emitter.emit('pause', undefined);
  }

  /** Resume a paused recording. */
  async resume(): Promise<void> {
    if (this.state !== 'paused') throw this.fail('not-recording', 'Not currently paused.');
    if (this.native) {
      await VoiceRecorder.resumeRecording();
    } else if (this.recorder && this.recorder.state === 'paused') {
      this.recorder.resume();
    }
    this.pausedTotal += Date.now() - this.pausedAt;
    this.pausedAt = 0;
    this.setState('recording');
    this.emitter.emit('resume', undefined);
  }

  /** Stop recording and resolve the normalized clip. */
  async stop(): Promise<CapRecordingClip> {
    if (!this.isRecording()) throw this.fail('not-recording', 'Not currently recording.');
    this.setState('stopping');
    this.stopTimers();
    const durationMs = this.elapsedMs();

    let clip: CapRecordingClip;
    try {
      clip = this.native ? await this.nativeStop(durationMs) : await this.webStop(durationMs);
    } catch (err) {
      this.cleanup();
      this.setState('idle');
      throw this.fail('unknown', String((err as any)?.message || err));
    }

    this.cleanup();
    this.setState('idle');
    this.emitter.emit('stop', clip);
    this.log('stop', clip.mimeType, formatDuration(clip.durationMs), formatBytes(clip.size));
    return clip;
  }

  private async nativeStop(fallbackDuration: number): Promise<CapRecordingClip> {
    const res = await VoiceRecorder.stopRecording();
    const v = res.value;
    const base64 = v.recordDataBase64 || '';
    const mimeType = v.mimeType || 'audio/aac';
    return {
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      mimeType,
      durationMs: typeof v.msDuration === 'number' && v.msDuration > 0 ? v.msDuration : fallbackDuration,
      size: base64Bytes(base64),
      source: 'native',
      timestamp: Date.now(),
    };
  }

  private async webStop(durationMs: number): Promise<CapRecordingClip> {
    const recorder = this.recorder;
    if (!recorder) throw new Error('No active recorder');
    const mimeType = this.webMime;
    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.chunks, { type: mimeType }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(this.chunks, { type: mimeType }));
      }
    });
    const base64 = await blobToBase64(blob);
    const url = (() => {
      try {
        return URL.createObjectURL(blob);
      } catch {
        return undefined;
      }
    })();
    return {
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      blob,
      url,
      mimeType,
      durationMs,
      size: blob.size,
      source: 'web',
      timestamp: Date.now(),
    };
  }

  /** Cancel without producing a clip (best-effort). */
  async cancel(): Promise<void> {
    if (!this.isRecording()) return;
    this.stopTimers();
    try {
      if (this.native) {
        await VoiceRecorder.stopRecording().catch(() => {});
      } else if (this.recorder) {
        try {
          this.recorder.stop();
        } catch {
          /* ignore */
        }
      }
    } finally {
      this.cleanup();
      this.setState('idle');
      this.emitter.emit('error', { code: 'aborted', message: 'Recording cancelled.' });
    }
  }

  private startTicker(): void {
    this.stopTickerOnly();
    this.tickTimer = setInterval(() => {
      this.emitter.emit('duration', this.elapsedMs());
    }, this.startOpts.tickMs);
  }

  private stopTickerOnly(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private stopTimers(): void {
    this.stopTickerOnly();
    if (this.maxTimer) {
      clearTimeout(this.maxTimer);
      this.maxTimer = null;
    }
  }

  private cleanup(): void {
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.webBytes = 0;
  }

  private fail(code: CapRecorderError['code'], message: string): CapRecorderError {
    const e: CapRecorderError = { code, message };
    this.emitter.emit('error', e);
    return e;
  }

  /** Revoke an object URL previously returned in a clip. */
  static revoke(clip: CapRecordingClip | null | undefined): void {
    if (clip?.url) {
      try {
        URL.revokeObjectURL(clip.url);
      } catch {
        /* ignore */
      }
    }
  }

  async dispose(): Promise<void> {
    await this.cancel().catch(() => {});
    this.emitter.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capRecorder = new CapAudioRecorderService();
export const startRecording = (o?: CapRecorderStartOptions): Promise<void> => capRecorder.start(o);
export const stopRecording = (): Promise<CapRecordingClip> => capRecorder.stop();

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseAudioRecorderResult {
  state: CapRecorderState;
  isRecording: boolean;
  durationMs: number;
  durationLabel: string;
  lastClip: CapRecordingClip | null;
  error: CapRecorderError | null;
  start: (o?: CapRecorderStartOptions) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<CapRecordingClip | null>;
  cancel: () => Promise<void>;
}

/**
 * React hook over the shared recorder. Auto-revokes the previous clip's object
 * URL when a new clip is produced or on unmount.
 *
 *   const { state, durationLabel, start, stop, lastClip } = useAudioRecorder();
 */
export function useAudioRecorder(): UseAudioRecorderResult {
  const [state, setState] = useState<CapRecorderState>(() => capRecorder.getState());
  const [durationMs, setDurationMs] = useState(0);
  const [lastClip, setLastClip] = useState<CapRecordingClip | null>(null);
  const [error, setError] = useState<CapRecorderError | null>(null);
  const prevClipRef = useRef<CapRecordingClip | null>(null);

  useEffect(() => {
    const offState = capRecorder.on('statechange', setState);
    const offDur = capRecorder.on('duration', setDurationMs);
    const offStop = capRecorder.on('stop', (clip) => {
      CapAudioRecorderService.revoke(prevClipRef.current);
      prevClipRef.current = clip;
      setLastClip(clip);
      setDurationMs(0);
    });
    const offErr = capRecorder.on('error', setError);
    return () => {
      offState();
      offDur();
      offStop();
      offErr();
    };
  }, []);

  // Revoke the held clip URL on unmount.
  useEffect(
    () => () => {
      CapAudioRecorderService.revoke(prevClipRef.current);
    },
    [],
  );

  const start = useCallback(async (o?: CapRecorderStartOptions) => {
    setError(null);
    await capRecorder.start(o);
  }, []);
  const pause = useCallback(() => capRecorder.pause(), []);
  const resume = useCallback(() => capRecorder.resume(), []);
  const stop = useCallback(async () => {
    try {
      return await capRecorder.stop();
    } catch {
      return null;
    }
  }, []);
  const cancel = useCallback(() => capRecorder.cancel(), []);

  return {
    state,
    isRecording: state === 'recording' || state === 'paused',
    durationMs,
    durationLabel: formatDuration(durationMs),
    lastClip,
    error,
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}

export default capRecorder;

