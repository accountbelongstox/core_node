/** Central network timeout/TTL and UI duration constants (milliseconds). */

export const NETWORK_TIMEOUTS = {
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
} as const;

export const UI_DURATIONS = {
  /** "Copied" feedback badge reset. */
  copyFeedbackMs: 2_000,
} as const;
