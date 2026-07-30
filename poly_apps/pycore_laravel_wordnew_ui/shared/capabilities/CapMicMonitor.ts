/* =============================================================================
 * CapMicMonitor — public, cross-platform MICROPHONE LISTENING / METERING library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): pronunciation/shadowing UIs want a LIVE input level meter, a
 *   waveform/spectrum visual and simple voice-activity detection (VAD) so they
 *   can show "we hear you" feedback and auto-trim silence.
 *
 * WHAT IT DOES (this is "listening", not "recording" — pair with CapAudioRecorder)
 *   - Opens the mic via getUserMedia and runs a Web Audio AnalyserNode.
 *   - Continuously computes: RMS, peak, dBFS, a normalized 0..1 level, plus the
 *     raw time-domain (waveform) and frequency (spectrum) byte arrays.
 *   - Voice Activity Detection with threshold + attack/release hangover, firing
 *     speakingstart / speakingend events (great for auto-record gating).
 *   - Clipping detection event.
 *   - Enumerate + select input devices; configurable echo-cancellation etc.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - This uses the standard Web Audio + MediaDevices APIs, which are available
 *     BOTH on the web shell AND inside the wordnew Capacitor WebView (with the
 *     OS mic permission granted). There is no separate Capacitor "mic level"
 *     plugin — Web Audio is the cross-platform path — so this module is the
 *     single implementation for both, guarded so it degrades cleanly when the
 *     APIs are missing (reports unsupported instead of throwing at import).
 *
 * QUICK START
 *   import { CapMicMonitor, useMicLevel } from '@/shared/capabilities/CapMicMonitor';
 *   const mic = new CapMicMonitor({ vadThreshold: 0.06 });
 *   mic.on('level', (m) => meter.set(m.level));
 *   mic.on('speakingstart', () => startAutoRecord());
 *   await mic.start();
 *   // React: const { level, db, speaking, waveform } = useMicLevel({ active: true });
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { TypedEventEmitter } from '../../core/events/TypedEventEmitter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapMicMetrics {
  /** Normalized 0..1 level (RMS scaled), smoothed by the AnalyserNode. */
  level: number;
  /** Peak sample magnitude 0..1 in the current frame. */
  peak: number;
  /** RMS in 0..1. */
  rms: number;
  /** Approximate dBFS (<= 0). -Infinity when silent. */
  db: number;
  /** Whether VAD currently considers the user to be speaking. */
  speaking: boolean;
  /** Whether the frame clipped (peak ~ 1.0). */
  clipping: boolean;
  /** Epoch ms when produced. */
  timestamp: number;
}

export interface CapMicError {
  code: 'permission-denied' | 'unsupported' | 'no-device' | 'already-running' | 'unknown';
  message: string;
}

export interface CapMicEventMap {
  /** High-frequency metering update (on the configured cadence). */
  level: CapMicMetrics;
  /** VAD edge: silence -> speech. */
  speakingstart: CapMicMetrics;
  /** VAD edge: speech -> silence. */
  speakingend: CapMicMetrics;
  /** A clipping frame was detected. */
  clip: CapMicMetrics;
  start: void;
  stop: void;
  error: CapMicError;
}

export type CapMicListener<K extends keyof CapMicEventMap> = (p: CapMicEventMap[K]) => void;

export interface CapMicOptions {
  /** AnalyserNode FFT size (power of 2, 32..32768). Default 2048. */
  fftSize?: number;
  /** AnalyserNode smoothing 0..1. Default 0.8. */
  smoothing?: number;
  /**
   * Normalized RMS level at/above which VAD treats input as speech. Default
   * 0.05. Tune per environment; pair with vadHangoverMs to avoid flapping.
   */
  vadThreshold?: number;
  /** How long (ms) speech must stay below threshold before 'speakingend'. Default 350. */
  vadHangoverMs?: number;
  /** How long (ms) above threshold before 'speakingstart'. Default 60. */
  vadAttackMs?: number;
  /**
   * Metering cadence (ms). 0 = run on requestAnimationFrame (~60fps). Default 0.
   * Use a number (e.g. 100) to throttle for cheaper UIs / background tabs.
   */
  updateMs?: number;
  /** Preferred input deviceId (from enumerateInputs). Default '' = system default. */
  deviceId?: string;
  /** getUserMedia audio constraints. Defaults below tuned for speech metering. */
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  /** Optional logger; defaults to no-op. */
  logger?: (msg: string, ...args: unknown[]) => void;
}

export interface CapMicDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers (exported)
// ---------------------------------------------------------------------------

const DEFAULTS: Required<Omit<CapMicOptions, 'logger' | 'deviceId'>> &
  Pick<CapMicOptions, 'logger' | 'deviceId'> = {
  fftSize: 2048,
  smoothing: 0.8,
  vadThreshold: 0.05,
  vadHangoverMs: 350,
  vadAttackMs: 60,
  updateMs: 0,
  deviceId: '',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  logger: undefined,
};

/** Format dBFS for display, e.g. "-23 dB" / "-inf". */
export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return '-inf';
  return `${Math.round(db)} dB`;
}

/**
 * Map a normalized 0..1 level to N bar heights (0..1 each) for a simple meter.
 * Bars light up progressively; the last bars represent louder input.
 */
export function levelToBars(level: number, bars = 12): number[] {
  const clamped = level < 0 ? 0 : level > 1 ? 1 : level;
  const lit = clamped * bars;
  return Array.from({ length: bars }, (_, i) => {
    const frac = lit - i;
    return frac >= 1 ? 1 : frac <= 0 ? 0 : frac;
  });
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (window.AudioContext || (window as any).webkitAudioContext || null) as typeof AudioContext | null;
}

function micSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      !!getAudioContextCtor()
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Monitor (instances are cheap; create one per visual that needs the mic)
// ---------------------------------------------------------------------------

export class CapMicMonitor {
  private readonly opts: typeof DEFAULTS;
  private readonly emitter = new TypedEventEmitter<CapMicEventMap>('CapMicMonitor');

  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array | null = null;
  private freqData: Uint8Array | null = null;

  private running = false;
  private rafId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // VAD state
  private speaking = false;
  private aboveSince = 0;
  private belowSince = 0;

  private latest: CapMicMetrics = {
    level: 0,
    peak: 0,
    rms: 0,
    db: -Infinity,
    speaking: false,
    clipping: false,
    timestamp: Date.now(),
  };

  constructor(options: CapMicOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  private log(msg: string, ...args: unknown[]): void {
    this.opts.logger?.(`[CapMicMonitor] ${msg}`, ...args);
  }

  isRunning(): boolean {
    return this.running;
  }
  isSupported(): boolean {
    return micSupported();
  }
  getMetrics(): CapMicMetrics {
    return this.latest;
  }

  on<K extends keyof CapMicEventMap>(e: K, fn: CapMicListener<K>): () => void {
    return this.emitter.on(e, fn);
  }
  once<K extends keyof CapMicEventMap>(e: K, fn: CapMicListener<K>): () => void {
    return this.emitter.once(e, fn);
  }
  off<K extends keyof CapMicEventMap>(e: K, fn: CapMicListener<K>): void {
    this.emitter.off(e, fn);
  }

  /** Latest time-domain (waveform) bytes (0..255, 128 = silence). */
  getWaveform(): Uint8Array | null {
    return this.timeData;
  }
  /** Latest frequency-domain (spectrum) bytes (0..255). */
  getSpectrum(): Uint8Array | null {
    return this.freqData;
  }

  /** Audio context sample rate (Hz); falls back to 44100 before start(). */
  getSampleRate(): number {
    return this.ctx?.sampleRate ?? 44100;
  }

  /** FFT size currently in use (bins = fftSize/2). */
  getFftSize(): number {
    return this.analyser?.fftSize ?? clampFft(this.opts.fftSize);
  }

  /** Enumerate audio input devices (labels populated only after permission). */
  async enumerateInputs(): Promise<CapMicDevice[]> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone', groupId: d.groupId }));
    } catch {
      return [];
    }
  }

  /** Start listening + metering. Idempotent (no-op if already running). */
  async start(): Promise<void> {
    if (this.running) return;
    if (!micSupported()) {
      throw this.fail('unsupported', 'Microphone metering (Web Audio) is not available here.');
    }
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: this.opts.echoCancellation,
          noiseSuppression: this.opts.noiseSuppression,
          autoGainControl: this.opts.autoGainControl,
          ...(this.opts.deviceId ? { deviceId: { exact: this.opts.deviceId } } : {}),
        },
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      throw this.fail(
        /denied|permission/i.test(String((err as any)?.message)) ? 'permission-denied' : 'no-device',
        String((err as any)?.message || err),
      );
    }

    const Ctx = getAudioContextCtor();
    if (!Ctx) throw this.fail('unsupported', 'AudioContext unavailable.');
    this.ctx = new Ctx();
    // Some engines start the context suspended until a user gesture.
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore — will still meter once resumed by a gesture */
      }
    }
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = clampFft(this.opts.fftSize);
    this.analyser.smoothingTimeConstant = clamp01(this.opts.smoothing);
    this.source.connect(this.analyser);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.running = true;
    this.speaking = false;
    this.aboveSince = 0;
    this.belowSince = 0;
    this.emitter.emit('start', undefined);
    this.log('start', { fftSize: this.analyser.fftSize, device: this.opts.deviceId || 'default' });
    this.loop();
  }

  /** Stop listening and release the mic + audio graph. */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      await this.ctx?.close();
    } catch {
      /* ignore */
    }
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    this.source = null;
    this.analyser = null;
    this.ctx = null;
    this.stream = null;
    if (this.speaking) {
      this.speaking = false;
      this.emitter.emit('speakingend', { ...this.latest, speaking: false });
    }
    this.emitter.emit('stop', undefined);
    this.log('stop');
  }

  /** Switch input device; restarts the graph if currently running. */
  async setDevice(deviceId: string): Promise<void> {
    this.opts.deviceId = deviceId;
    if (this.running) {
      await this.stop();
      await this.start();
    }
  }

  // -- internals ----------------------------------------------------------- #

  private loop(): void {
    if (this.opts.updateMs > 0) {
      this.intervalId = setInterval(() => this.tick(), this.opts.updateMs);
    } else {
      const step = (): void => {
        if (!this.running) return;
        this.tick();
        this.rafId = requestAnimationFrame(step);
      };
      this.rafId = requestAnimationFrame(step);
    }
  }

  private tick(): void {
    const analyser = this.analyser;
    const time = this.timeData;
    const freq = this.freqData;
    if (!analyser || !time || !freq) return;

    analyser.getByteTimeDomainData(time);
    analyser.getByteFrequencyData(freq);

    // Compute RMS + peak from the time-domain data (128 = zero).
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < time.length; i++) {
      const v = (time[i] - 128) / 128; // -1..1
      const mag = Math.abs(v);
      if (mag > peak) peak = mag;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / time.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    // Normalized level: emphasize the speech range a little for nicer meters.
    const level = Math.min(1, rms * 1.8);
    const clipping = peak >= 0.99;

    const now = Date.now();
    const metrics: CapMicMetrics = {
      level,
      peak,
      rms,
      db,
      speaking: this.speaking,
      clipping,
      timestamp: now,
    };

    // --- VAD with attack/release hangover -------------------------------- #
    if (level >= this.opts.vadThreshold) {
      this.belowSince = 0;
      if (this.aboveSince === 0) this.aboveSince = now;
      if (!this.speaking && now - this.aboveSince >= this.opts.vadAttackMs) {
        this.speaking = true;
        metrics.speaking = true;
        this.emitter.emit('speakingstart', metrics);
      }
    } else {
      this.aboveSince = 0;
      if (this.belowSince === 0) this.belowSince = now;
      if (this.speaking && now - this.belowSince >= this.opts.vadHangoverMs) {
        this.speaking = false;
        metrics.speaking = false;
        this.emitter.emit('speakingend', metrics);
      }
    }

    if (clipping) this.emitter.emit('clip', metrics);

    this.latest = metrics;
    this.emitter.emit('level', metrics);
  }

  private fail(code: CapMicError['code'], message: string): CapMicError {
    const e: CapMicError = { code, message };
    this.emitter.emit('error', e);
    return e;
  }

  /** Stop + drop listeners. */
  async dispose(): Promise<void> {
    await this.stop();
    this.emitter.clear();
  }
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clampFft(n: number): number {
  // Must be a power of two in [32, 32768].
  let p = 32;
  while (p < n && p < 32768) p *= 2;
  return Math.min(32768, Math.max(32, p));
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseMicLevelOptions extends CapMicOptions {
  /** Start listening while true; stop when false/unmounted. Default false. */
  active?: boolean;
}

export interface UseMicLevelResult {
  level: number;
  db: number;
  peak: number;
  speaking: boolean;
  clipping: boolean;
  supported: boolean;
  running: boolean;
  error: CapMicError | null;
  /** Latest waveform bytes (mutates in place; copy if you need a snapshot). */
  waveform: Uint8Array | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * React hook over a per-component CapMicMonitor instance.
 *
 *   const { level, speaking, start, stop } = useMicLevel({ active: true });
 */
export function useMicLevel(options: UseMicLevelOptions = {}): UseMicLevelResult {
  const { active = false, ...monitorOpts } = options;
  const monitorRef = useRef<CapMicMonitor | null>(null);
  if (!monitorRef.current) monitorRef.current = new CapMicMonitor(monitorOpts);

  const [metrics, setMetrics] = useState<CapMicMetrics>(() => monitorRef.current!.getMetrics());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<CapMicError | null>(null);
  const supported = monitorRef.current.isSupported();

  useEffect(() => {
    const mic = monitorRef.current!;
    const offLevel = mic.on('level', setMetrics);
    const offStart = mic.on('start', () => setRunning(true));
    const offStop = mic.on('stop', () => setRunning(false));
    const offErr = mic.on('error', setError);
    return () => {
      offLevel();
      offStart();
      offStop();
      offErr();
      void mic.dispose();
      monitorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mic = monitorRef.current;
    if (!mic) return;
    if (active && !mic.isRunning()) {
      setError(null);
      void mic.start().catch((e: CapMicError) => setError(e));
    } else if (!active && mic.isRunning()) {
      void mic.stop();
    }
  }, [active]);

  const start = async (): Promise<void> => {
    setError(null);
    await monitorRef.current?.start();
  };
  const stop = async (): Promise<void> => {
    await monitorRef.current?.stop();
  };

  return {
    level: metrics.level,
    db: metrics.db,
    peak: metrics.peak,
    speaking: metrics.speaking,
    clipping: metrics.clipping,
    supported,
    running,
    error,
    waveform: monitorRef.current.getWaveform(),
    start,
    stop,
  };
}

// ===========================================================================
// EXTENDED CAPABILITIES — spectrum analysis, pitch, visualization hooks
// ===========================================================================
//
// Built primarily for the wordnew mobile APP pronunciation visuals: a 3-band
// equalizer, a rough pitch read-out, and ready-made hooks that surface the
// waveform/spectrum on each frame for a canvas to draw.

export interface CapFrequencyBands {
  /** Normalized 0..1 energy in the low band (~20-250 Hz). */
  bass: number;
  /** Normalized 0..1 energy in the mid band (~250-2000 Hz). */
  mid: number;
  /** Normalized 0..1 energy in the high band (~2000+ Hz). */
  treble: number;
}

/**
 * Compute coarse bass/mid/treble energies from a frequency byte array.
 * `sampleRate` and the FFT size let us map bins -> Hz.
 */
export function frequencyBandEnergies(
  spectrum: Uint8Array,
  sampleRate: number,
  fftSize: number,
): CapFrequencyBands {
  const binCount = spectrum.length;
  const hzPerBin = sampleRate / fftSize;
  const sums = { bass: 0, mid: 0, treble: 0 };
  const counts = { bass: 0, mid: 0, treble: 0 };
  for (let i = 0; i < binCount; i++) {
    const hz = i * hzPerBin;
    const v = spectrum[i] / 255;
    if (hz < 250) {
      sums.bass += v;
      counts.bass++;
    } else if (hz < 2000) {
      sums.mid += v;
      counts.mid++;
    } else {
      sums.treble += v;
      counts.treble++;
    }
  }
  return {
    bass: counts.bass ? sums.bass / counts.bass : 0,
    mid: counts.mid ? sums.mid / counts.mid : 0,
    treble: counts.treble ? sums.treble / counts.treble : 0,
  };
}

/** The frequency (Hz) of the loudest spectrum bin (crude). */
export function dominantFrequency(spectrum: Uint8Array, sampleRate: number, fftSize: number): number {
  let maxV = 0;
  let maxI = 0;
  for (let i = 0; i < spectrum.length; i++) {
    if (spectrum[i] > maxV) {
      maxV = spectrum[i];
      maxI = i;
    }
  }
  return (maxI * sampleRate) / fftSize;
}

/**
 * Estimate fundamental pitch (Hz) from a time-domain byte waveform using
 * autocorrelation. Returns null when no clear pitch is found (silence/noise).
 * Good enough for a "you're singing ~A3" style read-out, not for tuning.
 */
export function estimatePitchHz(waveform: Uint8Array, sampleRate: number): number | null {
  const n = waveform.length;
  if (n < 64) return null;
  // Center to -1..1 floats and measure energy.
  const buf = new Float32Array(n);
  let rms = 0;
  for (let i = 0; i < n; i++) {
    const v = (waveform[i] - 128) / 128;
    buf[i] = v;
    rms += v * v;
  }
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return null; // too quiet

  const minLag = Math.floor(sampleRate / 1000); // up to 1000 Hz
  const maxLag = Math.floor(sampleRate / 60); // down to 60 Hz
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= Math.min(maxLag, n - 1); lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) corr += buf[i] * buf[i + lag];
    corr /= n - lag;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  if (bestLag <= 0 || bestCorr < 0.01) return null;
  return sampleRate / bestLag;
}

/** Map a frequency (Hz) to the nearest musical note name, e.g. "A4". */
export function frequencyToNote(hz: number | null): string {
  if (hz == null || hz <= 0) return '--';
  const A4 = 440;
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const semis = Math.round(12 * Math.log2(hz / A4));
  const noteIdx = (((semis + 9) % 12) + 12) % 12; // A4 -> index of 'A'
  const octave = 4 + Math.floor((semis + 9) / 12);
  return `${names[noteIdx]}${octave}`;
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

/**
 * Per-frame 3-band equalizer levels from a per-component mic monitor.
 *
 *   const { bands, running, start, stop } = useMicBands({ active: true });
 */
export function useMicBands(options: UseMicLevelOptions = {}): {
  bands: CapFrequencyBands;
  running: boolean;
  error: CapMicError | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const { active = false, ...monitorOpts } = options;
  const monitorRef = useRef<CapMicMonitor | null>(null);
  if (!monitorRef.current) monitorRef.current = new CapMicMonitor(monitorOpts);
  const [bands, setBands] = useState<CapFrequencyBands>({ bass: 0, mid: 0, treble: 0 });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<CapMicError | null>(null);

  useEffect(() => {
    const mic = monitorRef.current!;
    const offLevel = mic.on('level', () => {
      const spec = mic.getSpectrum();
      if (spec) setBands(frequencyBandEnergies(spec, mic.getSampleRate(), mic.getFftSize()));
    });
    const offStart = mic.on('start', () => setRunning(true));
    const offStop = mic.on('stop', () => setRunning(false));
    const offErr = mic.on('error', setError);
    return () => {
      offLevel();
      offStart();
      offStop();
      offErr();
      void mic.dispose();
      monitorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mic = monitorRef.current;
    if (!mic) return;
    if (active && !mic.isRunning()) void mic.start().catch((e: CapMicError) => setError(e));
    else if (!active && mic.isRunning()) void mic.stop();
  }, [active]);

  return {
    bands,
    running,
    error,
    start: async () => {
      setError(null);
      await monitorRef.current?.start();
    },
    stop: async () => {
      await monitorRef.current?.stop();
    },
  };
}

/**
 * Live pitch read-out (Hz + nearest note) from a per-component mic monitor.
 *
 *   const { hz, note, running } = useMicPitch({ active: true });
 */
export function useMicPitch(options: UseMicLevelOptions = {}): {
  hz: number | null;
  note: string;
  running: boolean;
  error: CapMicError | null;
} {
  const { active = false, ...monitorOpts } = options;
  const monitorRef = useRef<CapMicMonitor | null>(null);
  if (!monitorRef.current) monitorRef.current = new CapMicMonitor(monitorOpts);
  const [hz, setHz] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<CapMicError | null>(null);

  useEffect(() => {
    const mic = monitorRef.current!;
    const offLevel = mic.on('level', () => {
      const wave = mic.getWaveform();
      if (wave) setHz(estimatePitchHz(wave, mic.getSampleRate()));
    });
    const offStart = mic.on('start', () => setRunning(true));
    const offStop = mic.on('stop', () => setRunning(false));
    const offErr = mic.on('error', setError);
    return () => {
      offLevel();
      offStart();
      offStop();
      offErr();
      void mic.dispose();
      monitorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mic = monitorRef.current;
    if (!mic) return;
    if (active && !mic.isRunning()) void mic.start().catch((e: CapMicError) => setError(e));
    else if (!active && mic.isRunning()) void mic.stop();
  }, [active]);

  return { hz, note: frequencyToNote(hz), running, error };
}

export default CapMicMonitor;
