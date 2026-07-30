/**
 * OfflineRecheckScheduler — shared "all endpoints Offline → retry on an
 * interval" loop used by all three ends (laravel-manager / pycore-manager /
 * wordnew). This is what makes each end's configured `healthCheckInterval`
 * actually take effect.
 *
 * Contract:
 *  - The loop runs ONLY while the end's backend is fully offline. As soon as a
 *    recheck reports something healthy the loop stops itself — a healthy
 *    backend is never polled (the original probe-once-at-startup behaviour is
 *    preserved for the healthy path).
 *  - The interval is read fresh from the driver before every tick, so a value
 *    configured in the end's UI takes effect from the next tick, no restart.
 *  - Path-prefix gating: each end owns one scheduler and starts/stops it from
 *    its root component's mount/unmount (/laravel-manager → App.tsx,
 *    /pycore-manager → PcApp, /wordnew → WordNewApp), so only the active end
 *    re-probes its endpoints.
 */
export interface OfflineRecheckDriver {
  /** One full re-probe; resolve true when at least one endpoint is healthy. */
  recheck(): Promise<boolean>;
  /** Current retry interval (ms); read before every tick so UI config applies live. */
  getIntervalMs(): number;
}

/** Floor for configurable recheck intervals — keeps a typo like "1" (ms) from hammering the backend. */
export const MIN_RECHECK_INTERVAL_MS = 5_000;

/** Normalize a configured interval: non-finite/non-positive → fallback, else clamped to the floor. */
export function clampRecheckInterval(ms: number, fallback: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  return Math.max(MIN_RECHECK_INTERVAL_MS, Math.round(ms));
}

export class OfflineRecheckScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(private readonly driver: OfflineRecheckDriver) {}

  /**
   * Start the offline retry loop (idempotent). The first recheck fires after
   * one interval — callers are expected to have just run (or be about to run)
   * an initial probe themselves; this loop only owns the retries.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private schedule(): void {
    if (!this.running) return;
    const interval = clampRecheckInterval(this.driver.getIntervalMs(), 60_000);
    this.timer = setTimeout(() => {
      void this.tick();
    }, interval);
  }

  /** One retry: re-probe, stop on recovery, otherwise schedule the next tick. */
  private async tick(): Promise<void> {
    if (!this.running) return;
    let healthy = false;
    try {
      healthy = await this.driver.recheck();
    } catch {
      healthy = false;
    }
    if (!this.running) return;
    if (healthy) {
      this.stop();
      return;
    }
    this.schedule();
  }
}
