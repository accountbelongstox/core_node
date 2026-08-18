/**
 * Bing worker MV3 lifecycle hooks.
 *
 * Registers chrome.alarms + chrome.runtime event listeners that resurrect the
 * translation worker after the service worker is terminated mid-session. The
 * run intent lives in session storage (wiped on browser close) so a fresh
 * browser launch never auto-reopens Bing tabs.
 *
 * Extracted from bing-dictionary-worker-service.ts to keep that file focused
 * on the orchestration + batch-processing logic.
 */

import { logger } from '@/utils/logger';
import { STORAGE_KEYS } from '@/utils/storage-keys';

const LOG = 'Bing Worker';

/** Storage key for the persisted run intent (session storage). */
export const RUNTIME_STORAGE_KEY = STORAGE_KEYS.BING_WORKER_RUNTIME;

/** Alarm name for the periodic watchdog that resurrects the worker. */
export const WATCHDOG_ALARM = STORAGE_KEYS.BING_WATCHDOG_ALARM;

// 1 min: above the 30s production floor, frequent enough to recover quickly.
export const WATCHDOG_PERIOD_MINUTES = 1;

/**
 * Register the MV3 lifecycle hooks that keep the translation assist alive
 * ACROSS service-worker termination WITHIN a browser session.
 *
 * Per the official service-worker lifecycle guidance, event listeners must be
 * registered synchronously at the top level of the SW so they are present when
 * the worker is revived. This wires:
 *   - chrome.alarms.onAlarm  -> watchdog resurrection (also wakes a terminated SW)
 *   - chrome.runtime.onStartup / onInstalled -> recover if a session was active
 * plus an immediate resume() for SWs revived by any other event.
 *
 * resume() reads the run intent from session storage (wiped on browser close),
 * so none of these hooks auto-start crawling or open Bing tabs after a fresh
 * browser launch — only an explicit user Start does that.
 */
export function initBingWorkerLifecycle(
  resume: () => Promise<void>,
): void {
  // Load any persisted global logs so the background buffer continues across
  // service-worker restarts (best-effort; logging never blocks startup).
  logger.init().catch(() => undefined);

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === WATCHDOG_ALARM) {
      resume().catch(() => undefined);
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    resume().catch(() => undefined);
  });

  chrome.runtime.onInstalled.addListener(() => {
    resume().catch(() => undefined);
  });

  // The SW may have just been revived by an unrelated event; re-establish the
  // worker immediately if the user had it assisting.
  resume().catch(() => undefined);
}
