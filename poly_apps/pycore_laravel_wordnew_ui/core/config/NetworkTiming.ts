/** Central network timeout/TTL and UI duration constants (milliseconds). */

export const NETWORK_TIMEOUTS: Record<string, number> = {
  /** Fail-fast ceiling for a request with no configured timeout. */
  defaultRequestMs: 15_000,
  /** Long-running requests (cloud clipboard sync, account login). */
  longRequestMs: 60_000,
  /** Queue-center overview read. */
  queueCenterOverviewMs: 2_000,
  /** TTL of a coalesced identical read response. */
  coalescedResponseTtlMs: 5_000,
  /** Backend health re-probe cadence. */
  healthCheckIntervalMs: 60_000,
  /** Health probe abort (first-byte latency on cold Octane workers). */
  healthProbeTimeoutMs: 3_000,
  /** Wait before re-reading pycore's Laravel route health after it kicked a background sweep. */
  pycoreEndpointSweepMs: 7_000,
};

/** The one reconnect / retry backoff window (every socket, event client and compute retry). */
export const RECONNECT_BACKOFF_MS = {
  min: 1_000,
  max: 30_000,
} as const;

export const WEBSOCKET_TIMINGS = {
  /** Application heartbeat cadence (detects half-open sockets). */
  heartbeatIntervalMs: 20_000,
  /** Silence after a heartbeat that marks the socket dead. */
  heartbeatTimeoutMs: 10_000,
  /** Handshake ceiling before an attempt counts as failed. */
  openTimeoutMs: 10_000,
  /** Reconnect backoff bounds (full jitter between half and full step). */
  reconnectMinMs: RECONNECT_BACKOFF_MS.min,
  reconnectMaxMs: RECONNECT_BACKOFF_MS.max,
} as const;

export const UI_DURATIONS = {
  /** "Copied" feedback badge reset. */
  copyFeedbackMs: 2_000,
} as const;
