/**
 * WordflowHealthRecheck — wordflow end glue for the all-Offline retry loop and
 * the manual Refresh action.
 *
 * One scheduler instance for the end. Path-prefix gating: WfApp (mounted only
 * under /wordflow) syncs the loop after its proactive endpoint detection and
 * stops it on unmount. The interval comes from
 * wordflowApiManager.getRecheckIntervalMs() (config default, overridable in
 * WfSettingsApiServerPage) and is read fresh on every tick.
 *
 * Note: unlike the laravel end there is no shared-base-URL re-point step —
 * WordflowApi resolves apiManager.getCurrentBaseUrl() on every request, so a
 * failover applied by recheckAndFailover() is picked up automatically.
 */
import { apiManager } from './WordflowApiManager';
import { OfflineRecheckScheduler } from '../../health/OfflineRecheckScheduler';

const scheduler = new OfflineRecheckScheduler({
  recheck: () => apiManager.recheckAndFailover(),
  getIntervalMs: () => apiManager.getRecheckIntervalMs(),
});

/**
 * Manual re-detect (settings page Refresh) — the stored-first pass: probes
 * the stored last-used endpoint alone, sweeps all endpoints only if it is
 * down. Also re-syncs the loop: still all-Offline → (re)start it, recovered
 * → stop it.
 */
export async function recheckWordflowEndpointsNow(): Promise<boolean> {
  const anyHealthy = await apiManager.recheckAndFailover();
  if (anyHealthy) scheduler.stop();
  else scheduler.start();
  return anyHealthy;
}

/** Align the loop with current health: run only while everything is Offline. */
export function syncWordflowOfflineRecheckLoop(): void {
  if (apiManager.hasHealthyEndpoint()) scheduler.stop();
  else scheduler.start();
}

export function stopWordflowOfflineRecheckLoop(): void {
  scheduler.stop();
}
