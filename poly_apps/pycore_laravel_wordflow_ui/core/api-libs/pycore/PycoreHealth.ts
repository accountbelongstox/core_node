/**
 * PycoreHealth — reachability state + all-Offline retry loop for the
 * pycore-manager end.
 *
 * The pycore end has a single "endpoint": the pycore backend on :59000
 * (direct). Health blends TWO signals:
 *   1. WS liveness (onWsStatus) — no upgrade means definitively down.
 *      onWsStatus(true) means RPC v2 welcome/ready, not bare WebSocket.OPEN.
 *   2. RPC probe (`ui.ping`, 3s timeout) — WS ready but RPC unresponsive
 *      is a real state; probing catches it while `isWsConnected()` alone
 *      cannot. Two consecutive probe failures are needed before flipping
 *      to down, so a single transient blip is tolerated.
 *
 * Loop:
 *  - while DOWN (ws_disconnected / rpc_unresponsive), re-ping at a
 *    configurable interval (default below, overridable in PcSettingsPage,
 *    read fresh on every tick);
 *  - while PROBING after WS becomes ready, retry failed pings on a short
 *    interval (not the 60s offline cadence);
 *  - the loop stops as soon as the backend answers — an up backend is
 *    never polled;
 *  - path-prefix gating: PcApp (mounted only under /pycore-manager) runs
 *    the initial check and owns start/stop of the loop.
 *
 * Listeners subscribe via PYCORE_HEALTH_EVENT on window; the interval
 * override lives in plain localStorage (per-browser UI config).
 */
import {
  OfflineRecheckScheduler,
  clampRecheckInterval,
} from '../../health/OfflineRecheckScheduler';
import { isWsConnected, onWsStatus, callRpc } from './PycoreWs';

export type PycoreReachability =
  | 'unknown'
  | 'probing'
  | 'ws_disconnected'
  | 'rpc_unresponsive'
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
  /** ui.ping RPC probe timeout (ms). Short — long enough to survive a
   *  cold Octane hit but not so long that a stalled bus locks the UI. */
  pingTimeoutMs: 3_000,
  /** Consecutive probe failures required before flipping to down.
   *  A single 3s miss on a busy machine is not enough evidence. */
  failuresBeforeDown: 2,
  /** Short gap between probe attempts while reachability is probing. */
  probeRetryMs: 750,
};

const RECHECK_INTERVAL_MS_KEY = 'pc_health_recheck_interval_ms';

let lastState: PycoreHealthState = {
  up: null,
  responseTime: null,
  timestamp: null,
  reachability: 'unknown',
};
let wsStatusBound = false;
let inFlight: Promise<boolean> | null = null;
let consecutiveFailures = 0;
let probeRetryTimer: ReturnType<typeof setTimeout> | null = null;

export function getPycoreRecheckIntervalMs(): number {
  const raw = localStorage.getItem(RECHECK_INTERVAL_MS_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return clampRecheckInterval(parsed, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
}

export function setPycoreRecheckIntervalMs(ms: number): void {
  const clamped = clampRecheckInterval(ms, PYCORE_HEALTH_DEFAULTS.healthCheckInterval);
  localStorage.setItem(RECHECK_INTERVAL_MS_KEY, String(clamped));
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

/** Read WS liveness + RPC probe and notify listeners. */
export function checkPycoreNow(): Promise<boolean> {
  ensureWsHealthSubscription();
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const start = performance.now();
    if (!isWsConnected()) {
      // Nothing to probe — WS / RPC ready handshake is not up.
      consecutiveFailures = 0;
      clearProbeRetry();
      applyReachability('ws_disconnected', Math.round(performance.now() - start));
      return false;
    }
    // WS is RPC-ready. Probe RPC to distinguish healthy from unresponsive.
    let rpcOk = false;
    try {
      await callRpc('ui.ping', {}, PYCORE_HEALTH_DEFAULTS.pingTimeoutMs);
      rpcOk = true;
    } catch {
      rpcOk = false;
    }
    const ms = Math.round(performance.now() - start);
    if (rpcOk) {
      consecutiveFailures = 0;
      clearProbeRetry();
      applyReachability('healthy', ms);
      return true;
    }
    consecutiveFailures += 1;
    if (consecutiveFailures >= PYCORE_HEALTH_DEFAULTS.failuresBeforeDown) {
      clearProbeRetry();
      applyReachability('rpc_unresponsive', ms);
      return false;
    }
    // First miss after ready: stay probing (up=null). Never retain a prior
    // ws_disconnected/false across a successful welcome handshake.
    // eslint-disable-next-line no-console
    console.warn(
      `[pycore-health] ui.ping failed (attempt ${consecutiveFailures}/${PYCORE_HEALTH_DEFAULTS.failuresBeforeDown}); ` +
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

function ensureWsHealthSubscription(): void {
  if (wsStatusBound) return;
  wsStatusBound = true;
  onWsStatus((connected) => {
    if (!connected) {
      consecutiveFailures = 0;
      clearProbeRetry();
      applyReachability('ws_disconnected', 0);
      return;
    }
    // WS became RPC-ready: clear offline state, enter probing, short-retry
    // probes — never keep the prior ws_disconnected/up=false snapshot.
    consecutiveFailures = 0;
    clearProbeRetry();
    scheduler.stop();
    applyReachability('probing', 0);
    void checkPycoreNow();
  });
}

export function getPycoreHealth(): PycoreHealthState {
  ensureWsHealthSubscription();
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
  ensureWsHealthSubscription();
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
