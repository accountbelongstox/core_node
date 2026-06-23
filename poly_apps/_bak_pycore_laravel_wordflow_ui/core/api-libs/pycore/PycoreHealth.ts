/**
 * PycoreHealth — reachability state + all-Offline retry loop for the
 * pycore-manager end.
 *
 * The pycore end has a single "endpoint": the pycore backend behind the
 * /pyapi proxy (dev: Vite proxy to :59000). Health = GET /pyapi/ping answers
 * 2xx within the probe timeout. The shared STORED-FIRST detection contract
 * degenerates here to that single probe (there is nothing to sweep or fail
 * over to), so every check costs exactly one request. Same contract as the
 * other two ends:
 *  - while DOWN, re-ping at a configurable interval (default below,
 *    overridable in PcSettingsPage, read fresh on every tick);
 *  - the loop stops as soon as the backend answers — an up backend is never
 *    polled;
 *  - path-prefix gating: PcApp (mounted only under /pycore-manager) runs the
 *    initial check and owns start/stop of the loop.
 *
 * Listeners subscribe via PYCORE_HEALTH_EVENT on window; the interval override
 * lives in plain localStorage (per-browser UI config, synchronous reads).
 */
import {
  OfflineRecheckScheduler,
  clampRecheckInterval,
} from '../../health/OfflineRecheckScheduler';

export interface PycoreHealthState {
  /** null until the first check finishes. */
  up: boolean | null;
  responseTime: number | null;
  timestamp: number | null;
}

export const PYCORE_HEALTH_EVENT = 'pycore-health-changed';

export const PYCORE_HEALTH_DEFAULTS = {
  /** Default ALL-Offline retry interval (ms). */
  healthCheckInterval: 60_000,
  /** Probe timeout (ms) — matches the other ends' 3s cold-start allowance. */
  timeout: 3_000,
};

const RECHECK_INTERVAL_LS_KEY = 'pc_health_recheck_interval_ms';

let lastState: PycoreHealthState = { up: null, responseTime: null, timestamp: null };

export function getPycoreHealth(): PycoreHealthState {
  return lastState;
}

export function getPycoreRecheckIntervalMs(): number {
  const raw = localStorage.getItem(RECHECK_INTERVAL_LS_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return clampRecheckInterval(parsed, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
}

export function setPycoreRecheckIntervalMs(ms: number): void {
  const clamped = clampRecheckInterval(ms, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
  localStorage.setItem(RECHECK_INTERVAL_LS_KEY, String(clamped));
}

/** Single-flight: interval ticks and manual re-checks share one in-flight ping. */
let inFlight: Promise<boolean> | null = null;

/** One ping with the probe timeout; updates state and notifies listeners. */
export function checkPycoreNow(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const start = performance.now();
    let up = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PYCORE_HEALTH_DEFAULTS.timeout);
    try {
      const response = await fetch('/pyapi/ping', { signal: controller.signal });
      up = response.ok;
    } catch {
      up = false;
    } finally {
      clearTimeout(timeoutId);
    }
    lastState = {
      up,
      responseTime: Math.round(performance.now() - start),
      timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent(PYCORE_HEALTH_EVENT));
    return up;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

const scheduler = new OfflineRecheckScheduler({
  recheck: checkPycoreNow,
  getIntervalMs: getPycoreRecheckIntervalMs,
});

/**
 * Manual re-check (PcSettingsPage button). Also re-syncs the loop: still down
 * → (re)start it, recovered → stop it.
 */
export async function recheckPycoreNow(): Promise<boolean> {
  const up = await checkPycoreNow();
  if (up) scheduler.stop();
  else scheduler.start();
  return up;
}

/** Align the loop with current state: run only while the backend is down. */
export function syncPycoreOfflineRecheckLoop(): void {
  if (lastState.up) scheduler.stop();
  else scheduler.start();
}

export function stopPycoreOfflineRecheckLoop(): void {
  scheduler.stop();
}
