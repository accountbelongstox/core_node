/**
 * PycoreHealth — reachability state + all-Offline retry loop for the
 * pycore-manager end.
 *
 * The pycore end has a single "endpoint": the pycore backend on :59000
 * (direct). Health is determined by a FastAPI HTTP controller probe
 * (`ui/ping`, 3s timeout). Two consecutive failures are required before
 * flipping to down, so a single transient blip is tolerated.
 *
 * Loop:
 *  - while DOWN (http_unreachable), re-ping at a
 *    configurable interval (default below, overridable in PcSettingsPage,
 *    read fresh on every tick);
 *  - while PROBING, retry failed pings on a short
 *    interval (not the 60s offline cadence);
 *  - the loop stops as soon as the backend answers — an up backend is
 *    never polled;
 *  - path-prefix gating: PcApp (mounted only under /pycore-manager) runs
 *    the initial check and owns start/stop of the loop.
 *
 * Listeners subscribe via PYCORE_HEALTH_EVENT on window; the interval
 * override lives in the shared browser persistence manager.
 */
import {
  OfflineRecheckScheduler,
  clampRecheckInterval,
} from '../../health/OfflineRecheckScheduler';
import { requestPycoreHttp } from './PycoreHttp';
import { PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';
import { StorageKeys, StorageManager } from '../../persistence';

export type PycoreReachability =
  | 'unknown'
  | 'probing'
  | 'http_unreachable'
  | 'healthy';

export interface PycoreHealthState {
  /** null until the first decisive check finishes (or while probing). */
  up: boolean | null;
  responseTime: number | null;
  timestamp: number | null;
  reachability: PycoreReachability;
}

export const PYCORE_HEALTH_EVENT = 'pycore-health-changed';

export const PYCORE_HEALTH_DEFAULTS = {
  /** Default ALL-Offline retry interval (ms). */
  healthCheckInterval: 60_000,
  /** ui/ping HTTP probe timeout (ms). Short — long enough to survive a
   *  cold Octane hit but not so long that a stalled bus locks the UI. */
  pingTimeoutMs: 3_000,
  /** Consecutive probe failures required before flipping to down.
   *  A single 3s miss on a busy machine is not enough evidence. */
  failuresBeforeDown: 2,
  /** Short gap between probe attempts while reachability is probing. */
  probeRetryMs: 750,
};

let lastState: PycoreHealthState = {
  up: null,
  responseTime: null,
  timestamp: null,
  reachability: 'unknown',
};
let inFlight: Promise<boolean> | null = null;
let consecutiveFailures = 0;
let probeRetryTimer: ReturnType<typeof setTimeout> | null = null;

export function getPycoreRecheckIntervalMs(): number {
  const raw = StorageManager.getRaw(StorageKeys.PYCORE_HEALTH_RECHECK_INTERVAL_MS);
  const parsed = raw === null ? NaN : Number(raw);
  return clampRecheckInterval(parsed, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
}

export function setPycoreRecheckIntervalMs(ms: number): void {
  const clamped = clampRecheckInterval(ms, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
  StorageManager.setRaw(StorageKeys.PYCORE_HEALTH_RECHECK_INTERVAL_MS, String(clamped));
}

function clearProbeRetry(): void {
  if (probeRetryTimer != null) {
    clearTimeout(probeRetryTimer);
    probeRetryTimer = null;
  }
}

function scheduleProbeRetry(): void {
  clearProbeRetry();
  probeRetryTimer = setTimeout(() => {
    probeRetryTimer = null;
    void checkPycoreNow();
  }, PYCORE_HEALTH_DEFAULTS.probeRetryMs);
}

/** Probe the HTTP controller and notify listeners. */
export function checkPycoreNow(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const start = performance.now();
    let httpOk = false;
    try {
      await requestPycoreHttp(PYCORE_HTTP_ROUTES.ping, {}, PYCORE_HEALTH_DEFAULTS.pingTimeoutMs);
      httpOk = true;
    } catch {
      httpOk = false;
    }
    const ms = Math.round(performance.now() - start);
    if (httpOk) {
      consecutiveFailures = 0;
      clearProbeRetry();
      applyReachability('healthy', ms);
      return true;
    }
    consecutiveFailures += 1;
    if (consecutiveFailures >= PYCORE_HEALTH_DEFAULTS.failuresBeforeDown) {
      clearProbeRetry();
      applyReachability('http_unreachable', ms);
      return false;
    }
    // First miss after ready: stay probing (up=null). Never retain a prior
    // eslint-disable-next-line no-console
    console.warn(
      `[pycore-health] ui/ping failed (attempt ${consecutiveFailures}/${PYCORE_HEALTH_DEFAULTS.failuresBeforeDown}); ` +
      'keeping probing state.',
    );
    applyReachability('probing', ms);
    scheduleProbeRetry();
    return false;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

const scheduler = new OfflineRecheckScheduler({
  recheck: checkPycoreNow,
  getIntervalMs: getPycoreRecheckIntervalMs,
});

function applyReachability(reachability: PycoreReachability, responseTime: number): void {
  const up =
    reachability === 'healthy'
      ? true
      : reachability === 'probing' || reachability === 'unknown'
        ? null
        : false;
  lastState = {
    up,
    responseTime,
    timestamp: Date.now(),
    reachability,
  };
  window.dispatchEvent(new CustomEvent(PYCORE_HEALTH_EVENT));
  if (up === true) {
    clearProbeRetry();
    scheduler.stop();
  } else if (up === false) {
    // Decisive offline — use the long offline recheck cadence.
    scheduler.start();
  } else {
    // probing / unknown — do not run the 60s offline loop.
    scheduler.stop();
  }
}

export function getPycoreHealth(): PycoreHealthState {
  return lastState;
}

/**
 * Manual re-check (PcSettingsPage button). Also re-syncs the loop.
 */
export async function recheckPycoreNow(): Promise<boolean> {
  const up = await checkPycoreNow();
  if (up) {
    clearProbeRetry();
    scheduler.stop();
  } else if (lastState.up === false) {
    scheduler.start();
  }
  return up;
}

/** Align the loop with current state: run only while the backend is down. */
export function syncPycoreOfflineRecheckLoop(): void {
  if (lastState.up === true) {
    clearProbeRetry();
    scheduler.stop();
  } else if (lastState.up === false) {
    scheduler.start();
  } else {
    scheduler.stop();
  }
}

export function stopPycoreOfflineRecheckLoop(): void {
  clearProbeRetry();
  scheduler.stop();
}
