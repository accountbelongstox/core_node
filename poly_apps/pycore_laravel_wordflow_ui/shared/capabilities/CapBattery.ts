/* =============================================================================
 * CapBattery — public, cross-platform BATTERY / POWER capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordflow_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): a vocabulary app that runs long study/listening sessions, so it
 *   wants to know battery level + charging state to throttle background work,
 *   dim animations, or warn before a long Walkman session. Falls back to web.
 *
 * WHAT IT DOES
 *   - Reports battery level (0..1 and 0..100%) and charging state.
 *   - Emits change/low/critical/charging events.
 *   - Derives a coarse drain-rate (%/hour) and a rough time-to-empty estimate
 *     from observed level deltas (best-effort; no OS API exposes this directly).
 *   - Exposes "should reduce power" guidance for callers to honor.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor/device getBatteryInfo() polled on an interval
 *     (the Device plugin has no battery event stream).
 *   - Web: the Battery Status API (navigator.getBattery()) with its native
 *     levelchange / chargingchange events; polling is used only as a backstop.
 *   - When neither is available (e.g. iOS Safari removed getBattery), the
 *     service reports `supported=false` and a neutral snapshot.
 *
 * QUICK START
 *   import { capBattery, useBattery } from '@/shared/capabilities/CapBattery';
 *   await capBattery.init();
 *   const b = capBattery.getStatus();      // { levelPct, charging, low, ... }
 *   capBattery.on('low', (b) => warnUser());
 *   // React: const { levelPct, charging, low } = useBattery();
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapBatterySource = 'native' | 'web' | 'initial' | 'unsupported';

export interface CapBatteryStatus {
  /** Whether any battery information is available on this platform. */
  supported: boolean;
  /** Charge fraction 0..1, or null when unknown. */
  level: number | null;
  /** Charge percentage 0..100 (rounded), or null when unknown. */
  levelPct: number | null;
  /** True when charging, false when discharging, null when unknown. */
  charging: boolean | null;
  /** True when at/below the "low" threshold and not charging. */
  low: boolean;
  /** True when at/below the "critical" threshold and not charging. */
  critical: boolean;
  /** Best-effort discharge rate in percent-per-hour (positive = draining). */
  drainPctPerHour: number | null;
  /** Best-effort minutes until empty at the current drain rate. */
  minutesToEmpty: number | null;
  /** Guidance flag: callers should reduce non-essential power use. */
  shouldReducePower: boolean;
  /** Where this snapshot came from. */
  source: CapBatterySource;
  /** Epoch ms when produced. */
  timestamp: number;
}

export interface CapBatteryEventMap {
  /** Any change in level or charging state. */
  change: CapBatteryStatus;
  /** Crossed into the low band while discharging. */
  low: CapBatteryStatus;
  /** Crossed into the critical band while discharging. */
  critical: CapBatteryStatus;
  /** Charging state flipped (plugged/unplugged). */
  chargingchange: CapBatteryStatus;
}

export type CapBatteryListener<K extends keyof CapBatteryEventMap> = (
  p: CapBatteryEventMap[K],
) => void;

export interface CapBatteryOptions {
  /** Low-battery threshold as a fraction (default 0.20 = 20%). */
  lowThreshold?: number;
  /** Critical-battery threshold as a fraction (default 0.10 = 10%). */
  criticalThreshold?: number;
  /**
   * Poll interval (ms). On native this is the only sampling mechanism; on web
   * it is a backstop in addition to the Battery API events. Default 30000.
   */
  pollMs?: number;
  /** Number of (level, time) samples kept for drain-rate estimation. Default 12. */
  sampleWindow?: number;
  /** Optional logger; defaults to no-op. */
  logger?: (msg: string, ...args: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// Tiny typed emitter
// ---------------------------------------------------------------------------

class Emitter<M> {
  private map = new Map<keyof M, Set<(p: any) => void>>();
  on<K extends keyof M>(e: K, fn: (p: M[K]) => void): () => void {
    let s = this.map.get(e);
    if (!s) {
      s = new Set();
      this.map.set(e, s);
    }
    s.add(fn as any);
    return () => this.off(e, fn);
  }
  once<K extends keyof M>(e: K, fn: (p: M[K]) => void): () => void {
    const off = this.on(e, (p) => {
      off();
      fn(p);
    });
    return off;
  }
  off<K extends keyof M>(e: K, fn: (p: M[K]) => void): void {
    this.map.get(e)?.delete(fn as any);
  }
  emit<K extends keyof M>(e: K, p: M[K]): void {
    const s = this.map.get(e);
    if (!s) return;
    for (const fn of Array.from(s)) {
      try {
        fn(p);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[CapBattery] listener error', err);
      }
    }
  }
  clear(): void {
    this.map.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers / formatters (exported for UI use)
// ---------------------------------------------------------------------------

const DEFAULTS: Required<Omit<CapBatteryOptions, 'logger'>> & Pick<CapBatteryOptions, 'logger'> = {
  lowThreshold: 0.2,
  criticalThreshold: 0.1,
  pollMs: 30000,
  sampleWindow: 12,
  logger: undefined,
};

/** Format a fraction as a percentage string, e.g. 0.42 -> "42%". */
export function formatBatteryPct(level: number | null): string {
  if (level == null || Number.isNaN(level)) return '--%';
  return `${Math.round(clamp01(level) * 100)}%`;
}

/** A battery glyph reflecting level + charging, for compact UI. */
export function batteryGlyph(s: CapBatteryStatus): string {
  if (s.charging) return '🔌';
  if (s.level == null) return '🔋';
  if (s.level <= 0.1) return '🪫';
  return '🔋';
}

/** Human label such as "84% • Charging" / "12% • Low". */
export function describeBattery(s: CapBatteryStatus): string {
  if (!s.supported) return 'Battery: unavailable';
  const pct = formatBatteryPct(s.level);
  if (s.charging) return `${pct} • Charging`;
  if (s.critical) return `${pct} • Critical`;
  if (s.low) return `${pct} • Low`;
  return `${pct} • On battery`;
}

/** Human "≈ 1h 23m left" string, or '' when unknown. */
export function describeTimeToEmpty(s: CapBatteryStatus): string {
  if (s.minutesToEmpty == null || !Number.isFinite(s.minutesToEmpty)) return '';
  const total = Math.max(0, Math.round(s.minutesToEmpty));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `≈ ${m}m left`;
  return `≈ ${h}h ${m}m left`;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

interface Sample {
  level: number;
  t: number;
}

export class CapBatteryService {
  private readonly opts: typeof DEFAULTS;
  private readonly emitter = new Emitter<CapBatteryEventMap>();

  private status: CapBatteryStatus;
  private samples: Sample[] = [];

  private initialized = false;
  private native = false;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private webBattery: any | null = null;
  private webHandlers: Array<[string, EventListener]> = [];

  constructor(options: CapBatteryOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.status = {
      supported: false,
      level: null,
      levelPct: null,
      charging: null,
      low: false,
      critical: false,
      drainPctPerHour: null,
      minutesToEmpty: null,
      shouldReducePower: false,
      source: 'initial',
      timestamp: Date.now(),
    };
  }

  private log(msg: string, ...args: unknown[]): void {
    this.opts.logger?.(`[CapBattery] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }
  isInitialized(): boolean {
    return this.initialized;
  }
  isSupported(): boolean {
    return this.status.supported;
  }
  getStatus(): CapBatteryStatus {
    return this.status;
  }

  on<K extends keyof CapBatteryEventMap>(e: K, fn: CapBatteryListener<K>): () => void {
    return this.emitter.on(e, fn);
  }
  once<K extends keyof CapBatteryEventMap>(e: K, fn: CapBatteryListener<K>): () => void {
    return this.emitter.once(e, fn);
  }
  off<K extends keyof CapBatteryEventMap>(e: K, fn: CapBatteryListener<K>): void {
    this.emitter.off(e, fn);
  }

  /** Initialize sampling. Idempotent. */
  async init(): Promise<CapBatteryStatus> {
    if (this.initialized) return this.status;
    this.initialized = true;
    this.native = safeIsNative();
    this.log(`init (native=${this.native})`);

    if (!this.native) {
      await this.initWebBattery();
    }
    // Native + web both also poll (web poll is a backstop).
    this.pollTimer = setInterval(() => void this.refresh(), this.opts.pollMs);
    await this.refresh();
    return this.status;
  }

  private async initWebBattery(): Promise<void> {
    try {
      const nav = navigator as any;
      if (typeof nav?.getBattery !== 'function') return;
      const bm = await nav.getBattery();
      this.webBattery = bm;
      const onChange = () => void this.refresh();
      for (const evt of ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange']) {
        bm.addEventListener(evt, onChange);
        this.webHandlers.push([evt, onChange]);
      }
    } catch (err) {
      this.log('web getBattery failed', err);
    }
  }

  /** Force a fresh read. */
  async refresh(): Promise<CapBatteryStatus> {
    const reading = this.native ? await this.readNative() : this.readWeb();
    this.ingest(reading);
    return this.status;
  }

  private async readNative(): Promise<{ level: number | null; charging: boolean | null; supported: boolean }> {
    try {
      const info = await Device.getBatteryInfo();
      const level = typeof info.batteryLevel === 'number' ? clamp01(info.batteryLevel) : null;
      const charging = typeof info.isCharging === 'boolean' ? info.isCharging : null;
      return { level, charging, supported: level != null || charging != null };
    } catch {
      return { level: null, charging: null, supported: false };
    }
  }

  private readWeb(): { level: number | null; charging: boolean | null; supported: boolean } {
    const bm = this.webBattery;
    if (!bm) return { level: null, charging: null, supported: false };
    return {
      level: typeof bm.level === 'number' ? clamp01(bm.level) : null,
      charging: typeof bm.charging === 'boolean' ? bm.charging : null,
      supported: true,
    };
  }

  private ingest(reading: { level: number | null; charging: boolean | null; supported: boolean }): void {
    const prev = this.status;
    const now = Date.now();

    // Maintain drain samples (only while discharging and level known).
    if (reading.level != null && reading.charging === false) {
      this.samples.push({ level: reading.level, t: now });
      if (this.samples.length > this.opts.sampleWindow) {
        this.samples.splice(0, this.samples.length - this.opts.sampleWindow);
      }
    } else if (reading.charging) {
      // Reset history when charging — drain estimates are no longer meaningful.
      this.samples = [];
    }

    const drainPctPerHour = this.estimateDrain();
    const minutesToEmpty =
      drainPctPerHour && drainPctPerHour > 0 && reading.level != null
        ? (reading.level * 100) / drainPctPerHour * 60
        : null;

    const low =
      reading.level != null && reading.charging !== true && reading.level <= this.opts.lowThreshold;
    const critical =
      reading.level != null && reading.charging !== true && reading.level <= this.opts.criticalThreshold;

    const next: CapBatteryStatus = {
      supported: reading.supported,
      level: reading.level,
      levelPct: reading.level == null ? null : Math.round(reading.level * 100),
      charging: reading.charging,
      low,
      critical,
      drainPctPerHour,
      minutesToEmpty,
      shouldReducePower: low || critical,
      source: reading.supported ? (this.native ? 'native' : 'web') : 'unsupported',
      timestamp: now,
    };

    const changed =
      prev.level !== next.level ||
      prev.charging !== next.charging ||
      prev.low !== next.low ||
      prev.critical !== next.critical ||
      prev.supported !== next.supported;

    this.status = next;
    if (!changed) return;

    this.emitter.emit('change', next);
    if (prev.charging !== next.charging) this.emitter.emit('chargingchange', next);
    if (!prev.low && next.low) this.emitter.emit('low', next);
    if (!prev.critical && next.critical) this.emitter.emit('critical', next);
    this.log('status', next.levelPct, next.charging ? 'charging' : 'discharging');
  }

  /** Linear-fit drain estimate over the sample window (percent/hour). */
  private estimateDrain(): number | null {
    if (this.samples.length < 2) return null;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dtHours = (last.t - first.t) / 3_600_000;
    if (dtHours <= 0) return null;
    const dPct = (first.level - last.level) * 100; // positive when draining
    if (dPct <= 0) return null;
    const rate = dPct / dtHours;
    // Guard against absurd values from tiny windows.
    return Number.isFinite(rate) ? Math.min(rate, 100) : null;
  }

  /** Tear down timers + listeners. Re-init'able. */
  async dispose(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.webBattery) {
      for (const [evt, fn] of this.webHandlers) {
        try {
          this.webBattery.removeEventListener(evt, fn);
        } catch {
          /* ignore */
        }
      }
    }
    this.webHandlers = [];
    this.webBattery = null;
    this.samples = [];
    this.emitter.clear();
    this.initialized = false;
  }
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capBattery = new CapBatteryService();
export const initBattery = (): Promise<CapBatteryStatus> => capBattery.init();
export const getBatteryStatus = (): CapBatteryStatus => capBattery.getStatus();
export const onBatteryChange = (fn: CapBatteryListener<'change'>): (() => void) =>
  capBattery.on('change', fn);

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/** Subscribe a component to the shared battery service. */
export function useBattery(): CapBatteryStatus {
  const [status, setStatus] = useState<CapBatteryStatus>(() => capBattery.getStatus());
  useEffect(() => {
    let mounted = true;
    void capBattery.init().then((s) => mounted && setStatus(s));
    const off = capBattery.on('change', (s) => mounted && setStatus(s));
    return () => {
      mounted = false;
      off();
    };
  }, []);
  return status;
}

/** Fires when battery crosses into the low / critical bands. */
export function useBatteryWarnings(handlers: {
  onLow?: (s: CapBatteryStatus) => void;
  onCritical?: (s: CapBatteryStatus) => void;
}): void {
  useEffect(() => {
    void capBattery.init();
    const offLow = handlers.onLow ? capBattery.on('low', handlers.onLow) : () => {};
    const offCrit = handlers.onCritical ? capBattery.on('critical', handlers.onCritical) : () => {};
    return () => {
      offLow();
      offCrit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ===========================================================================
// EXTENDED CAPABILITIES — power-mode guidance, charge-time estimate, savers
// ===========================================================================
//
// The wordnew mobile APP runs long Walkman / shadowing sessions; the helpers
// below let UI throttle work (animations, prefetch, background sync) based on
// the live battery picture without each screen re-implementing the heuristics.

/**
 * A coarse power mode the rest of the app can honor:
 *   - normal  : behave fully (plugged in, or comfortable charge).
 *   - reduced : trim non-essential animations / prefetch (low and discharging).
 *   - minimal : do the bare minimum (critical and discharging).
 */
export type CapPowerMode = 'normal' | 'reduced' | 'minimal';

/** Map a battery snapshot to a recommended power mode. */
export function recommendPowerMode(s: CapBatteryStatus): CapPowerMode {
  if (!s.supported) return 'normal';
  if (s.charging) return 'normal';
  if (s.critical) return 'minimal';
  if (s.low) return 'reduced';
  return 'normal';
}

/** Human label for a power mode (for diagnostics / settings UI). */
export function describePowerMode(mode: CapPowerMode): string {
  switch (mode) {
    case 'minimal':
      return 'Minimal (save power)';
    case 'reduced':
      return 'Reduced';
    default:
      return 'Normal';
  }
}

/** Format a duration in minutes as "1h 23m" / "45m". */
export function formatMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return '--';
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * A richer, derived "power profile" combining the raw status with guidance.
 * Computed on demand (pure) so callers can build it from any snapshot.
 */
export interface CapPowerProfile {
  status: CapBatteryStatus;
  mode: CapPowerMode;
  /** True when the app should pause heavy background work. */
  shouldThrottleBackground: boolean;
  /** True when the app should reduce animation/visual cost. */
  shouldReduceMotion: boolean;
  /** True when large prefetch/downloads should be deferred. */
  shouldDeferPrefetch: boolean;
  /** Friendly one-line summary. */
  summary: string;
}

/** Build a derived power profile from a battery snapshot (pure). */
export function buildPowerProfile(s: CapBatteryStatus): CapPowerProfile {
  const mode = recommendPowerMode(s);
  return {
    status: s,
    mode,
    shouldThrottleBackground: mode !== 'normal',
    shouldReduceMotion: mode === 'minimal',
    shouldDeferPrefetch: mode !== 'normal',
    summary: `${describeBattery(s)} • ${describePowerMode(mode)}`,
  };
}

/**
 * Extra service helpers attached as free functions (kept off the class so the
 * class stays focused on sampling). They read/operate on the shared singleton.
 */

/** Resolve once the device is charging (or immediately if already charging). */
export function whenCharging(timeoutMs = 0): Promise<CapBatteryStatus> {
  return new Promise((resolve, reject) => {
    const cur = capBattery.getStatus();
    if (cur.charging) {
      resolve(cur);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = capBattery.on('chargingchange', (s) => {
      if (s.charging) {
        if (timer) clearTimeout(timer);
        off();
        resolve(s);
      }
    });
    void capBattery.init();
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        off();
        reject(new Error('whenCharging timed out'));
      }, timeoutMs);
    }
  });
}

/**
 * Run `fn` only while the device is NOT in the minimal power band. If the
 * battery is critical+discharging, the call is skipped and `skipped` is true.
 * Useful to gate expensive optional work (e.g. background pre-synthesis).
 */
export async function runUnlessCritical<T>(
  fn: () => Promise<T> | T,
): Promise<{ ran: boolean; result?: T }> {
  await capBattery.init();
  const s = capBattery.getStatus();
  if (s.supported && s.critical && !s.charging) return { ran: false };
  return { ran: true, result: await fn() };
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

/** Returns the recommended power mode, recomputed on every battery change. */
export function usePowerMode(): CapPowerMode {
  const status = useBattery();
  return recommendPowerMode(status);
}

/** Convenience boolean: should the UI reduce non-essential power use right now? */
export function useBatterySaver(): boolean {
  return useBattery().shouldReducePower;
}

/** Full derived power profile, recomputed on every battery change. */
export function usePowerProfile(): CapPowerProfile {
  const status = useBattery();
  return buildPowerProfile(status);
}

// ===========================================================================
// EXTENDED CAPABILITIES — session history + diagnostics
// ===========================================================================
//
// For long study sessions it's useful to record how the battery behaved (to
// show "this session used 8%", or to debug drain). CapBatteryRecorder keeps a
// bounded ring of snapshots and computes simple session statistics. It is a
// thin, opt-in consumer of the shared service — create one per session.

export interface CapBatterySample {
  levelPct: number | null;
  charging: boolean | null;
  timestamp: number;
}

export interface CapBatterySessionStats {
  /** Number of recorded samples. */
  count: number;
  /** First / last level percentages in the window. */
  startPct: number | null;
  endPct: number | null;
  /** Net change (endPct - startPct); negative = drained. */
  deltaPct: number | null;
  /** Lowest / highest level seen. */
  minPct: number | null;
  maxPct: number | null;
  /** Wall-clock span of the window in ms. */
  spanMs: number;
  /** Average drain rate over the window (percent/hour); null if charging/empty. */
  avgDrainPctPerHour: number | null;
  /** Whether the device was charging at any point in the window. */
  everCharged: boolean;
}

/**
 * Records battery snapshots into a bounded ring and derives session stats.
 *
 *   const rec = new CapBatteryRecorder({ limit: 240 });
 *   rec.start();
 *   // ... later ...
 *   const stats = rec.getStats();   // { deltaPct, avgDrainPctPerHour, ... }
 *   rec.stop();
 */
export class CapBatteryRecorder {
  private readonly limit: number;
  private samples: CapBatterySample[] = [];
  private off: (() => void) | null = null;

  constructor(options: { limit?: number } = {}) {
    this.limit = Math.max(2, options.limit ?? 240);
  }

  /** Begin recording (records the current snapshot immediately). */
  start(): void {
    if (this.off) return;
    void capBattery.init().then(() => this.record(capBattery.getStatus()));
    this.off = capBattery.on('change', (s) => this.record(s));
  }

  /** Stop recording (keeps the captured samples for inspection). */
  stop(): void {
    this.off?.();
    this.off = null;
  }

  /** Clear all captured samples. */
  reset(): void {
    this.samples = [];
  }

  /** A copy of the recorded samples (oldest first). */
  getSamples(): CapBatterySample[] {
    return this.samples.slice();
  }

  private record(s: CapBatteryStatus): void {
    this.samples.push({ levelPct: s.levelPct, charging: s.charging, timestamp: s.timestamp });
    if (this.samples.length > this.limit) {
      this.samples.splice(0, this.samples.length - this.limit);
    }
  }

  /** Compute session statistics over the current window. */
  getStats(): CapBatterySessionStats {
    const known = this.samples.filter((s) => s.levelPct != null) as Array<
      CapBatterySample & { levelPct: number }
    >;
    if (known.length === 0) {
      return {
        count: this.samples.length,
        startPct: null,
        endPct: null,
        deltaPct: null,
        minPct: null,
        maxPct: null,
        spanMs: this.span(),
        avgDrainPctPerHour: null,
        everCharged: this.samples.some((s) => s.charging === true),
      };
    }
    const startPct = known[0].levelPct;
    const endPct = known[known.length - 1].levelPct;
    let minPct = startPct;
    let maxPct = startPct;
    for (const s of known) {
      if (s.levelPct < minPct) minPct = s.levelPct;
      if (s.levelPct > maxPct) maxPct = s.levelPct;
    }
    const spanMs = known[known.length - 1].timestamp - known[0].timestamp;
    const deltaPct = endPct - startPct;
    const everCharged = this.samples.some((s) => s.charging === true);
    const avgDrainPctPerHour =
      !everCharged && spanMs > 0 && deltaPct < 0 ? (-deltaPct / (spanMs / 3_600_000)) : null;
    return {
      count: this.samples.length,
      startPct,
      endPct,
      deltaPct,
      minPct,
      maxPct,
      spanMs,
      avgDrainPctPerHour,
      everCharged,
    };
  }

  private span(): number {
    if (this.samples.length < 2) return 0;
    return this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp;
  }

  dispose(): void {
    this.stop();
    this.reset();
  }
}

/** Format session stats into a one-line human summary. */
export function formatSessionStats(stats: CapBatterySessionStats): string {
  if (stats.startPct == null || stats.endPct == null) return 'No battery data this session.';
  const used = stats.deltaPct != null && stats.deltaPct < 0 ? `${Math.abs(stats.deltaPct)}% used` : 'no net drain';
  const dur = formatMinutes(stats.spanMs / 60000);
  const rate =
    stats.avgDrainPctPerHour != null ? ` • ${stats.avgDrainPctPerHour.toFixed(1)}%/h` : '';
  return `${stats.startPct}% → ${stats.endPct}% (${used}) over ${dur}${rate}`;
}

/**
 * React hook: records a battery session for the lifetime of the component and
 * returns live session stats. Useful on a "study session" screen.
 *
 *   const { stats, summary } = useBatteryHistory();
 */
export function useBatteryHistory(limit = 240): {
  stats: CapBatterySessionStats;
  summary: string;
  samples: CapBatterySample[];
} {
  const recorderRef = useRef<CapBatteryRecorder | null>(null);
  if (!recorderRef.current) recorderRef.current = new CapBatteryRecorder({ limit });
  const [stats, setStats] = useState<CapBatterySessionStats>(() => recorderRef.current!.getStats());
  const [samples, setSamples] = useState<CapBatterySample[]>([]);

  useEffect(() => {
    const rec = recorderRef.current!;
    rec.start();
    const off = capBattery.on('change', () => {
      setStats(rec.getStats());
      setSamples(rec.getSamples());
    });
    // Prime once.
    setStats(rec.getStats());
    setSamples(rec.getSamples());
    return () => {
      off();
      rec.dispose();
      recorderRef.current = null;
    };
  }, [limit]);

  return { stats, summary: formatSessionStats(stats), samples };
}

export default capBattery;
