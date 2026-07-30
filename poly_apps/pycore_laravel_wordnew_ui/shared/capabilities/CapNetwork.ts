/* =============================================================================
 * CapNetwork — public, cross-platform NETWORK STATUS capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   This is a PUBLIC capability library: any app/page inside
 *   poly_apps/pycore_laravel_wordnew_ui may import and use it. It is, however,
 *   *built primarily for the wordnew mobile APP* (the native Capacitor build of
 *   /wordnew), which needs reliable connectivity awareness for sync, audio
 *   streaming and offline study. The web shell gets a first-class fallback.
 *
 * WHAT IT DOES
 *   - Reports the current connection state (online/offline + connection type:
 *     wifi / cellular / none / unknown).
 *   - Emits change events when connectivity flips (debounced) so UI can react
 *     (banners, retry queues, "offline mode" toggles).
 *   - Tracks a rolling history of transitions for diagnostics.
 *   - Exposes derived signals: a coarse "quality" estimate, time-since-change,
 *     and a metered/save-data hint (from the Network Information API on web).
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native (Capacitor.isNativePlatform()): uses @capacitor/network
 *     (Network.getStatus / addListener('networkStatusChange')).
 *   - Web: uses the browser online/offline events + the Network Information API
 *     (navigator.connection). On the web build @capacitor/network is aliased to
 *     a browser-backed shim, so even the "native" code path degrades gracefully.
 *
 * QUICK START
 *   import { capNetwork, useNetworkStatus } from '@/shared/capabilities/CapNetwork';
 *   await capNetwork.init();
 *   const s = capNetwork.getStatus();              // { connected, connectionType, ... }
 *   const off = capNetwork.on('change', (s) => {  ...  });
 *   // React:  const { connected, connectionType, online } = useNetworkStatus();
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { TypedEventEmitter } from '../../core/events/TypedEventEmitter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four connection types Capacitor reports, mirrored on web. */
export type CapConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

/** A very coarse, best-effort link-quality bucket derived from available hints. */
export type CapNetworkQuality = 'offline' | 'poor' | 'moderate' | 'good' | 'unknown';

/** The source the current snapshot was produced from. */
export type CapNetworkSource = 'native' | 'web' | 'initial';

/** A normalized, immutable snapshot of connectivity at a point in time. */
export interface CapNetworkStatus {
  /** Whether the device believes it has an active connection. */
  connected: boolean;
  /** The connection transport type. */
  connectionType: CapConnectionType;
  /** Convenience alias of `connected` (reads nicer in UI code). */
  online: boolean;
  /** Coarse quality bucket (best-effort; 'unknown' when no hints exist). */
  quality: CapNetworkQuality;
  /** Web-only: effective type from the Network Information API, if present. */
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g' | string;
  /** Web-only: estimated downlink in Mbps, if present. */
  downlinkMbps?: number;
  /** Web-only: estimated round-trip time in ms, if present. */
  rttMs?: number;
  /** Web-only: user has requested reduced data usage (Save-Data), if present. */
  saveData?: boolean;
  /** Whether the link is likely metered (cellular or save-data). */
  metered: boolean;
  /** Where this snapshot came from. */
  source: CapNetworkSource;
  /** Epoch ms when this snapshot was produced. */
  timestamp: number;
}

/** A recorded transition between two snapshots. */
export interface CapNetworkTransition {
  from: CapNetworkStatus;
  to: CapNetworkStatus;
  /** ms the previous status was held before this transition. */
  heldMs: number;
}

/** Events emitted by the service. */
export interface CapNetworkEventMap {
  /** Any change in the normalized status (debounced). */
  change: CapNetworkStatus;
  /** Fired only when transitioning offline -> online. */
  online: CapNetworkStatus;
  /** Fired only when transitioning online -> offline. */
  offline: CapNetworkStatus;
  /** Fired only when the connectionType value changes. */
  typechange: CapNetworkStatus;
}

export type CapNetworkListener<K extends keyof CapNetworkEventMap> = (
  payload: CapNetworkEventMap[K],
) => void;

/** Construction / init options. */
export interface CapNetworkOptions {
  /**
   * Debounce window (ms) applied to rapid flaps before emitting `change`.
   * Mobile radios flip wifi<->cellular quickly; debouncing avoids UI thrash.
   * Default 350ms.
   */
  debounceMs?: number;
  /** Max number of transitions kept in the rolling history. Default 50. */
  historyLimit?: number;
  /**
   * On web, poll the Network Information API at this interval (ms) as a safety
   * net for engines that do not fire 'change' reliably. 0 disables. Default 0.
   */
  webPollMs?: number;
  /** Optional logger; defaults to a no-op (set to console for debugging). */
  logger?: (msg: string, ...args: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// Tiny typed event emitter (kept inline so this file is self-contained)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pure helpers / formatters (exported — handy for UI code)
// ---------------------------------------------------------------------------

const DEFAULTS: Required<Omit<CapNetworkOptions, 'logger'>> & Pick<CapNetworkOptions, 'logger'> = {
  debounceMs: 350,
  historyLimit: 50,
  webPollMs: 0,
  logger: undefined,
};

/** Human label for a connection type, e.g. for status chips. */
export function describeConnectionType(t: CapConnectionType): string {
  switch (t) {
    case 'wifi':
      return 'Wi-Fi';
    case 'cellular':
      return 'Cellular';
    case 'none':
      return 'No connection';
    default:
      return 'Unknown';
  }
}

/** Human label for a quality bucket. */
export function describeQuality(q: CapNetworkQuality): string {
  switch (q) {
    case 'offline':
      return 'Offline';
    case 'poor':
      return 'Poor';
    case 'moderate':
      return 'Moderate';
    case 'good':
      return 'Good';
    default:
      return 'Unknown';
  }
}

/** A small emoji/sigil for compact UI (purely cosmetic). */
export function connectionGlyph(t: CapConnectionType): string {
  switch (t) {
    case 'wifi':
      return '📶';
    case 'cellular':
      return '📡';
    case 'none':
      return '🚫';
    default:
      return '❔';
  }
}

/** Read the browser Network Information API object, if present. */
function readConnectionInfo(): {
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
  saveData?: boolean;
  type?: string;
} {
  try {
    const nav = navigator as any;
    const c = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (!c) return {};
    return {
      effectiveType: c.effectiveType,
      downlinkMbps: typeof c.downlink === 'number' ? c.downlink : undefined,
      rttMs: typeof c.rtt === 'number' ? c.rtt : undefined,
      saveData: typeof c.saveData === 'boolean' ? c.saveData : undefined,
      type: c.type,
    };
  } catch {
    return {};
  }
}

/** Derive a coarse quality bucket from whatever hints we have. */
export function deriveQuality(input: {
  connected: boolean;
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
}): CapNetworkQuality {
  if (!input.connected) return 'offline';
  const eff = input.effectiveType;
  if (eff) {
    if (eff === 'slow-2g' || eff === '2g') return 'poor';
    if (eff === '3g') return 'moderate';
    if (eff === '4g') return 'good';
  }
  if (typeof input.downlinkMbps === 'number') {
    if (input.downlinkMbps < 0.5) return 'poor';
    if (input.downlinkMbps < 3) return 'moderate';
    return 'good';
  }
  if (typeof input.rttMs === 'number') {
    if (input.rttMs > 600) return 'poor';
    if (input.rttMs > 200) return 'moderate';
    return 'good';
  }
  return 'unknown';
}

/** True when two snapshots are meaningfully different (ignoring timestamp). */
export function statusChanged(a: CapNetworkStatus | null, b: CapNetworkStatus): boolean {
  if (!a) return true;
  return (
    a.connected !== b.connected ||
    a.connectionType !== b.connectionType ||
    a.quality !== b.quality ||
    a.effectiveType !== b.effectiveType ||
    a.metered !== b.metered
  );
}

function deriveType(rawType: string | undefined, connected: boolean): CapConnectionType {
  if (!connected) return 'none';
  const t = (rawType || '').toLowerCase();
  if (t === 'wifi' || t === 'ethernet') return 'wifi';
  if (t === 'cellular') return 'cellular';
  if (t === 'none') return 'none';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------

export class CapNetworkService {
  private readonly opts: typeof DEFAULTS;
  private readonly emitter = new TypedEventEmitter<CapNetworkEventMap>('CapNetwork');

  private status: CapNetworkStatus;
  private lastChangeAt = Date.now();
  private history: CapNetworkTransition[] = [];

  private initialized = false;
  private native = false;

  // teardown handles
  private nativeHandle: { remove: () => Promise<void> } | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private connChangeHandler: (() => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRaw: CapNetworkStatus | null = null;

  constructor(options: CapNetworkOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.status = {
      connected: true,
      connectionType: 'unknown',
      online: true,
      quality: 'unknown',
      metered: false,
      source: 'initial',
      timestamp: Date.now(),
    };
  }

  private log(msg: string, ...args: unknown[]): void {
    this.opts.logger?.(`[CapNetwork] ${msg}`, ...args);
  }

  /** Whether the service is using the native Capacitor plugin path. */
  isNative(): boolean {
    return this.native;
  }

  /** Whether init() has completed. */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** The most recent normalized status snapshot. */
  getStatus(): CapNetworkStatus {
    return this.status;
  }

  /** Convenience: just the boolean. */
  isOnline(): boolean {
    return this.status.connected;
  }

  /** Convenience: whether the link looks metered (cellular / save-data). */
  isMetered(): boolean {
    return this.status.metered;
  }

  /** ms since the status last meaningfully changed. */
  timeSinceChange(): number {
    return Date.now() - this.lastChangeAt;
  }

  /** A copy of the transition history (oldest first). */
  getHistory(): CapNetworkTransition[] {
    return this.history.slice();
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof CapNetworkEventMap>(event: K, fn: CapNetworkListener<K>): () => void {
    return this.emitter.on(event, fn);
  }

  /** Subscribe once. */
  once<K extends keyof CapNetworkEventMap>(event: K, fn: CapNetworkListener<K>): () => void {
    return this.emitter.once(event, fn);
  }

  /** Unsubscribe a previously-registered listener. */
  off<K extends keyof CapNetworkEventMap>(event: K, fn: CapNetworkListener<K>): void {
    this.emitter.off(event, fn);
  }

  /**
   * Initialize listeners and capture the first real snapshot. Safe to call
   * multiple times (idempotent). Resolves with the first snapshot.
   */
  async init(): Promise<CapNetworkStatus> {
    if (this.initialized) return this.status;
    this.initialized = true;
    this.native = safeIsNative();
    this.log(`init (native=${this.native})`);

    if (this.native) {
      await this.initNative();
    } else {
      this.initWeb();
    }

    // Capture an immediate snapshot.
    await this.refresh();
    return this.status;
  }

  private async initNative(): Promise<void> {
    try {
      this.nativeHandle = await Network.addListener('networkStatusChange', (s) => {
        this.ingest(this.fromNative(s));
      });
    } catch (err) {
      this.log('native addListener failed, falling back to web', err);
      this.native = false;
      this.initWeb();
    }
  }

  private initWeb(): void {
    if (typeof window === 'undefined') return;
    this.onlineHandler = () => void this.refresh();
    this.offlineHandler = () => void this.refresh();
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    const nav = navigator as any;
    const c = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (c && typeof c.addEventListener === 'function') {
      this.connChangeHandler = () => void this.refresh();
      c.addEventListener('change', this.connChangeHandler);
    }

    if (this.opts.webPollMs > 0) {
      this.pollTimer = setInterval(() => void this.refresh(), this.opts.webPollMs);
    }
  }

  /** Force a fresh read of the current status. */
  async refresh(): Promise<CapNetworkStatus> {
    let raw: CapNetworkStatus;
    if (this.native) {
      try {
        const s = await Network.getStatus();
        raw = this.fromNative(s);
      } catch {
        raw = this.fromWeb();
      }
    } else {
      raw = this.fromWeb();
    }
    this.ingest(raw);
    return this.status;
  }

  private fromNative(s: { connected: boolean; connectionType: string }): CapNetworkStatus {
    const connected = !!s.connected;
    const connectionType = deriveType(s.connectionType, connected);
    const quality = deriveQuality({ connected });
    return {
      connected,
      connectionType,
      online: connected,
      quality,
      metered: connectionType === 'cellular',
      source: 'native',
      timestamp: Date.now(),
    };
  }

  private fromWeb(): CapNetworkStatus {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    const info = readConnectionInfo();
    const connectionType = deriveType(info.type, online);
    const quality = deriveQuality({
      connected: online,
      effectiveType: info.effectiveType,
      downlinkMbps: info.downlinkMbps,
      rttMs: info.rttMs,
    });
    return {
      connected: online,
      connectionType: online ? connectionType : 'none',
      online,
      quality,
      effectiveType: info.effectiveType,
      downlinkMbps: info.downlinkMbps,
      rttMs: info.rttMs,
      saveData: info.saveData,
      metered: connectionType === 'cellular' || info.saveData === true,
      source: 'web',
      timestamp: Date.now(),
    };
  }

  /** Normalize + debounce + diff + emit. */
  private ingest(raw: CapNetworkStatus): void {
    this.pendingRaw = raw;
    if (this.opts.debounceMs <= 0) {
      this.commit();
      return;
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.commit(), this.opts.debounceMs);
  }

  private commit(): void {
    const next = this.pendingRaw;
    this.pendingRaw = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (!next) return;
    const prev = this.status;
    if (!statusChanged(prev, next)) {
      // No meaningful change: still refresh the timestamp silently.
      this.status = { ...next, timestamp: next.timestamp };
      return;
    }

    const heldMs = Date.now() - this.lastChangeAt;
    this.history.push({ from: prev, to: next, heldMs });
    if (this.history.length > this.opts.historyLimit) {
      this.history.splice(0, this.history.length - this.opts.historyLimit);
    }

    this.status = next;
    this.lastChangeAt = Date.now();

    this.emitter.emit('change', next);
    if (!prev.connected && next.connected) this.emitter.emit('online', next);
    if (prev.connected && !next.connected) this.emitter.emit('offline', next);
    if (prev.connectionType !== next.connectionType) this.emitter.emit('typechange', next);
    this.log('status', next.connectionType, next.connected ? 'online' : 'offline', next.quality);
  }

  /** Remove all listeners + OS subscriptions. The service can be re-init'd. */
  async dispose(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.nativeHandle) {
      try {
        await this.nativeHandle.remove();
      } catch {
        /* ignore */
      }
      this.nativeHandle = null;
    }
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
      const nav = navigator as any;
      const c = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
      if (c && this.connChangeHandler && typeof c.removeEventListener === 'function') {
        c.removeEventListener('change', this.connChangeHandler);
      }
    }
    this.onlineHandler = null;
    this.offlineHandler = null;
    this.connChangeHandler = null;
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
// Singleton + convenience function API
// ---------------------------------------------------------------------------

/** The shared, app-wide network service. Most callers use this. */
export const capNetwork = new CapNetworkService();

/** Initialize the shared service (idempotent). */
export const initNetwork = (): Promise<CapNetworkStatus> => capNetwork.init();

/** Current snapshot from the shared service. */
export const getNetworkStatus = (): CapNetworkStatus => capNetwork.getStatus();

/** Subscribe to change events on the shared service. */
export const onNetworkChange = (fn: CapNetworkListener<'change'>): (() => void) =>
  capNetwork.on('change', fn);

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Subscribe a component to the shared network service. Auto-inits on mount.
 *
 *   const { online, connectionType, quality } = useNetworkStatus();
 */
export function useNetworkStatus(): CapNetworkStatus {
  const [status, setStatus] = useState<CapNetworkStatus>(() => capNetwork.getStatus());
  useEffect(() => {
    let mounted = true;
    void capNetwork.init().then((s) => {
      if (mounted) setStatus(s);
    });
    const off = capNetwork.on('change', (s) => {
      if (mounted) setStatus(s);
    });
    return () => {
      mounted = false;
      off();
    };
  }, []);
  return status;
}

/** Boolean-only convenience hook. */
export function useIsOnline(): boolean {
  return useNetworkStatus().connected;
}

/** Fires the supplied callbacks on online/offline edges. */
export function useNetworkEdges(handlers: {
  onOnline?: (s: CapNetworkStatus) => void;
  onOffline?: (s: CapNetworkStatus) => void;
}): void {
  useEffect(() => {
    void capNetwork.init();
    const offOn = handlers.onOnline ? capNetwork.on('online', handlers.onOnline) : () => {};
    const offOff = handlers.onOffline ? capNetwork.on('offline', handlers.onOffline) : () => {};
    return () => {
      offOn();
      offOff();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ===========================================================================
// EXTENDED CAPABILITIES — active reachability, wait-for-online, gated retry
// ===========================================================================
//
// `navigator.onLine` / Capacitor only tell us about the *radio*, not whether a
// server is actually reachable (captive portals, dead Wi-Fi, backend down). The
// wordnew mobile APP needs to know "can I actually sync right now", so these
// helpers add an optional ACTIVE probe and connectivity-gated retry utilities.

export interface CapReachabilityOptions {
  /** URL to probe. Default: same-origin '/favicon.ico'. */
  url?: string;
  /** Probe timeout (ms). Default 4000. */
  timeoutMs?: number;
  /**
   * Use a no-cors HEAD/GET so cross-origin probes don't need CORS. The response
   * is opaque but a resolved fetch still proves the network path is alive.
   * Default true.
   */
  noCors?: boolean;
}

export interface CapReachabilityResult {
  reachable: boolean;
  /** Round-trip time of the probe in ms (when reachable). */
  rttMs: number | null;
  /** The status snapshot at probe time. */
  status: CapNetworkStatus;
}

/**
 * Actively probe whether the network path to `url` is alive. Unlike getStatus()
 * this performs a real request, so it detects captive portals / dead links.
 */
export async function probeReachability(
  options: CapReachabilityOptions = {},
): Promise<CapReachabilityResult> {
  const status = capNetwork.getStatus();
  if (!status.connected) return { reachable: false, rttMs: null, status };
  if (typeof fetch === 'undefined') return { reachable: status.connected, rttMs: null, status };

  const url = options.url ?? defaultProbeUrl();
  const timeoutMs = options.timeoutMs ?? 4000;
  const noCors = options.noCors ?? true;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const startedAt = nowMs();
  try {
    await fetch(cacheBust(url), {
      method: 'GET',
      mode: noCors ? 'no-cors' : 'cors',
      cache: 'no-store',
      signal: controller?.signal,
    });
    return { reachable: true, rttMs: Math.round(nowMs() - startedAt), status: capNetwork.getStatus() };
  } catch {
    return { reachable: false, rttMs: null, status: capNetwork.getStatus() };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function defaultProbeUrl(): string {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/favicon.ico`;
    }
  } catch {
    /* ignore */
  }
  return '/favicon.ico';
}

function cacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  // Math.random()/Date.now() are fine in a browser runtime helper.
  return `${url}${sep}_cap=${nowMs()}`;
}

function nowMs(): number {
  try {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * Resolve as soon as the device is online (immediately if already online).
 * Optionally reject after `timeoutMs`.
 */
export function waitForOnline(timeoutMs = 0): Promise<CapNetworkStatus> {
  return new Promise((resolve, reject) => {
    void capNetwork.init();
    const cur = capNetwork.getStatus();
    if (cur.connected) {
      resolve(cur);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = capNetwork.on('online', (s) => {
      if (timer) clearTimeout(timer);
      off();
      resolve(s);
    });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        off();
        reject(new Error('waitForOnline timed out'));
      }, timeoutMs);
    }
  });
}

export interface CapRetryOptions {
  /** Max attempts before giving up. Default 5. */
  attempts?: number;
  /** Base delay (ms) for exponential backoff. Default 500. */
  baseDelayMs?: number;
  /** Cap on the per-attempt delay (ms). Default 15000. */
  maxDelayMs?: number;
  /** Wait for connectivity before each attempt. Default true. */
  waitForConnectivity?: boolean;
}

/**
 * Run `fn` with connectivity-aware exponential backoff. Between attempts it
 * waits for the device to be online (so a failed sync resumes the moment the
 * radio comes back instead of burning attempts while offline).
 */
export async function retryWhenOnline<T>(
  fn: () => Promise<T>,
  options: CapRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 15000;
  const waitConn = options.waitForConnectivity ?? true;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (waitConn) await waitForOnline().catch(() => undefined);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** i);
      await sleep(delay);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** A compact, render-ready descriptor for a status chip/badge. */
export interface CapNetworkBadge {
  glyph: string;
  label: string;
  /** A tailwind-ish tone hint the UI can map to colors. */
  tone: 'ok' | 'warn' | 'bad' | 'muted';
}

/** Build a badge descriptor from a status (pure). */
export function networkBadge(s: CapNetworkStatus): CapNetworkBadge {
  if (!s.connected) return { glyph: connectionGlyph('none'), label: 'Offline', tone: 'bad' };
  const tone: CapNetworkBadge['tone'] =
    s.quality === 'good' ? 'ok' : s.quality === 'poor' ? 'warn' : 'muted';
  const label = `${describeConnectionType(s.connectionType)}${
    s.metered ? ' • metered' : ''
  }`;
  return { glyph: connectionGlyph(s.connectionType), label, tone };
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

/** A render-ready badge descriptor, recomputed on every change. */
export function useNetworkBadge(): CapNetworkBadge {
  return networkBadge(useNetworkStatus());
}

/**
 * Periodically probe real reachability while mounted. Returns the latest
 * result plus a manual `check()`. Pauses probing while offline.
 */
export function useReachability(
  options: CapReachabilityOptions & { intervalMs?: number } = {},
): { result: CapReachabilityResult | null; checking: boolean; check: () => Promise<void> } {
  const [result, setResult] = useState<CapReachabilityResult | null>(null);
  const [checking, setChecking] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  const check = async (): Promise<void> => {
    setChecking(true);
    try {
      setResult(await probeReachability(optsRef.current));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void capNetwork.init();
    void check();
    const interval = options.intervalMs ?? 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    if (interval > 0) {
      timer = setInterval(() => {
        if (mounted && capNetwork.isOnline()) void check();
      }, interval);
    }
    const off = capNetwork.on('online', () => mounted && void check());
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.intervalMs]);

  return { result, checking, check };
}

export default capNetwork;
