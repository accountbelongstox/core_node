/**
 * ApiHealthRecheck — laravel-manager end glue for the all-Offline retry loop
 * and the manual "Re-detect" action.
 *
 * One scheduler instance for the whole end. Path-prefix gating: App.tsx (the
 * Lm end root, mounted only under /laravel-manager) syncs the loop after its
 * startup pass and stops it on unmount, so leaving the end stops the retries.
 * The interval comes from apiManager.getRecheckIntervalMs() (config default,
 * overridable in the endpoint switcher UI) and is read fresh on every tick.
 */
import { apiManager } from './ApiManager';
import { api } from '../core/api';
import { OfflineRecheckScheduler } from '../core/health/OfflineRecheckScheduler';

/**
 * One stored-first detection pass (stored endpoint only → full sweep only if
 * it's down), then re-point the shared API client (idempotent).
 */
async function doRecheck(): Promise<boolean> {
  const anyHealthy = await apiManager.recheckEndpoints();
  api.updateBaseURL(apiManager.getCurrentBaseUrl());
  return anyHealthy;
}

const scheduler = new OfflineRecheckScheduler({
  recheck: doRecheck,
  getIntervalMs: () => apiManager.getRecheckIntervalMs(),
});

/**
 * Manual re-detect (endpoint switcher button). Also re-syncs the loop: still
 * all-Offline → (re)start it, recovered → stop it.
 */
export async function recheckApiEndpointsNow(): Promise<boolean> {
  const anyHealthy = await doRecheck();
  if (anyHealthy) scheduler.stop();
  else scheduler.start();
  return anyHealthy;
}

/** Align the loop with current health: run only while everything is Offline. */
export function syncOfflineRecheckLoop(): void {
  if (apiManager.hasHealthyEndpoint()) scheduler.stop();
  else scheduler.start();
}

export function stopOfflineRecheckLoop(): void {
  scheduler.stop();
}
