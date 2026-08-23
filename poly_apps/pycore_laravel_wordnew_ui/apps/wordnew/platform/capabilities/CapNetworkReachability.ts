/** Active reachability, online-gated retry, and network badge hooks. */
import { useEffect, useRef, useState } from 'react';
import { protocolFetch } from '../../../../core/network/ProtocolFetch';
import { capNetwork, useNetworkStatus } from './CapNetworkCore';
import type { CapNetworkStatus } from './CapNetworkCore';
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
    await protocolFetch(cacheBust(url), {
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


