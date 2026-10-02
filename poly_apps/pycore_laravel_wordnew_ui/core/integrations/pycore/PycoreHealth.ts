/**
 * PycoreHealth — shared Pycore reachability state and offline retry loop.
 *
 * Health belongs to the ACTIVE endpoint (pycoreTarget: direct, tailnet proxy
 * or relay) and is determined by a FastAPI HTTP controller probe
 * (`GET /api/status`, 3s timeout). Two consecutive failures are required before
 * flipping to down, so a single transient blip is tolerated. The live
 * connection (SSE / HTTP reachability) drives it: a drop re-probes at once
 * and a reconnect marks it healthy, so the state never outlives the backend.
 * Every result is also published to PycoreEndpointProbe under the active URL.
 *
 * Loop:
 *  - while DOWN (http_unreachable), re-ping at a
 *    configurable interval, read fresh on every tick;
 *  - while PROBING, retry failed pings on a short
 *    interval (not the 60s offline cadence);
 *  - the loop stops as soon as the backend answers — an up backend is
 *    never polled;
 *  - an application consumer owns the initial check and loop lifecycle.
 *
 * Listeners subscribe via PYCORE_HEALTH_EVENT on window; the interval
 * override lives in the shared browser persistence manager.
 */
import {
  OfflineRecheckScheduler,
  clampRecheckInterval,
} from '../../health/OfflineRecheckScheduler';
import { isHttpConnected, onHttpStatus, reportHttpDiag } from './PycoreEventClient';
import { requestPycoreStatus } from './PycoreHttp';
import { recordPycoreProbe } from './PycoreEndpointProbe';
import { pycoreLink } from './PycoreServiceLink';
import { isPycoreRelayMode, pycoreTargetBackendUrl } from './pycoreTarget';
import { laravelRelayDeviceId } from './RelayPairing';
import { laravelRelayRoster } from '../laravel/LaravelRelayRoster';
import { RELAY_CONTRACT } from '../../contracts/RelayContract';
import {
  PYCORE_HEALTH_DEFAULTS,
  PYCORE_HEALTH_EVENT,
  PYCORE_HTTP_PATHS,
} from './PycoreNetwork';
import { StorageManager } from '../../persistence';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';

export { PYCORE_HEALTH_DEFAULTS, PYCORE_HEALTH_EVENT } from './PycoreNetwork';

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
  /** Backend URL this state belongs to. */
  endpointUrl: string;
  /** Identity the backend reported in its last successful status. */
  hostname: string;
  instanceId: string;
}

let lastState: PycoreHealthState = {
  up: null,
  responseTime: null,
  timestamp: null,
  reachability: 'unknown',
  endpointUrl: '',
  hostname: '',
  instanceId: '',
};
let lastPayload: any = null;
let inFlight: Promise<boolean> | null = null;
let consecutiveFailures = 0;
let probeRetryTimer: ReturnType<typeof setTimeout> | null = null;
const RELAY_PING_TIMEOUT_MS = RELAY_CONTRACT.durations.stall_window_seconds * 1000;

/** Relay mode: the designated machine's presence (its heartbeat), never the Laravel stream, says the backend is alive. */
function relayDevicePresent(): boolean {
  const deviceId = laravelRelayDeviceId();
  return deviceId !== null && laravelRelayRoster.list().some((entry) => entry.device_id === deviceId && entry.online);
}

/** The live link vouching for the backend when a probe fails: the event socket (direct) or the machine's presence (relay). */
function liveLinkVouches(): boolean {
  return isPycoreRelayMode() ? relayDevicePresent() : isHttpConnected();
}

export function getPycoreRecheckIntervalMs(): number {
  const raw = StorageManager.getRaw(StorageKeys.HEALTH_RECHECK_INTERVAL_MS);
  const parsed = raw === null ? NaN : Number(raw);
  return clampRecheckInterval(parsed, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
}

export function setPycoreRecheckIntervalMs(ms: number): void {
  const clamped = clampRecheckInterval(ms, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
  StorageManager.setRaw(StorageKeys.HEALTH_RECHECK_INTERVAL_MS, String(clamped));
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
    let probeError = '';
    try {
      lastPayload = await requestPycoreStatus(isPycoreRelayMode() ? RELAY_PING_TIMEOUT_MS : PYCORE_HEALTH_DEFAULTS.pingTimeoutMs);
      httpOk = true;
    } catch (error: any) {
      httpOk = liveLinkVouches();
      probeError = error?.message || String(error);
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
    reportHttpDiag(
      'info',
      `[pycore-health] GET ${PYCORE_HTTP_PATHS.status} failed (attempt ${consecutiveFailures}/${PYCORE_HEALTH_DEFAULTS.failuresBeforeDown}); ` +
      `keeping probing state. ${probeError}`,
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

function applyReachability(reachability: PycoreReachability, responseTime: number | null): void {
  const up =
    reachability === 'healthy'
      ? true
      : reachability === 'probing' || reachability === 'unknown'
        ? null
        : false;
  const endpointUrl = pycoreTargetBackendUrl();
  lastState = {
    up,
    responseTime,
    timestamp: Date.now(),
    reachability,
    endpointUrl,
    hostname: up ? String(lastPayload?.hostname || lastState.hostname) : lastState.hostname,
    instanceId: up ? String(lastPayload?.instance_id || lastState.instanceId) : lastState.instanceId,
  };
  if (up !== null) recordPycoreProbe(endpointUrl, up ? 'up' : 'down', responseTime, up ? lastPayload : null);
  window.dispatchEvent(new CustomEvent(PYCORE_HEALTH_EVENT));
  if (up === true) {
    clearProbeRetry();
    scheduler.stop();
    pycoreLink.markOnline();
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
 * Manual re-check. Also re-syncs the loop.
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

// The live connection is the push signal of the active backend: a drop while
// healthy re-probes at once (down after the usual confirmation), a reconnect
// is healthy without waiting for the offline cadence.
onHttpStatus((connected) => {
  if (connected) {
    if (lastState.up === true) return;
    if (isPycoreRelayMode()) {
      void checkPycoreNow();
      return;
    }
    consecutiveFailures = 0;
    applyReachability('healthy', lastState.responseTime);
    return;
  }
  if (lastState.up === true) void checkPycoreNow();
});

// Relay mode: the designated machine coming or going (roster presence) re-probes at once.
laravelRelayRoster.onChange(() => {
  if (!isPycoreRelayMode()) return;
  if (relayDevicePresent() !== (lastState.up === true)) void checkPycoreNow();
});
