/**
 * Backend request timeout — the SINGLE source of truth for how long a worker
 * HTTP call may run before it aborts.
 *
 * Persisted in chrome.storage.local under `backendTimeoutMs`. The Settings popup
 * writes it; BaseApiClient (and WorkerApiClient.submitResult) read it so a live
 * change takes effect without reconstructing any client. Mirrors the tolerant
 * get / best-effort set idiom of task-center/run-intent.ts, plus a SYNC cached
 * accessor for the request hot path (a fetch cannot await a storage read).
 */

export const BACKEND_TIMEOUT_STORAGE_KEY = 'backendTimeoutMs';
export const DEFAULT_BACKEND_TIMEOUT_MS = 600000; // 10 minutes
export const MIN_BACKEND_TIMEOUT_MS = 1000; // 1 second
export const MAX_BACKEND_TIMEOUT_MS = 3600000; // 1 hour

// Last-known value for the synchronous hot-path accessor. Seeded by
// initBackendTimeoutCache() and refreshed by the storage.onChanged listener.
let cachedTimeoutMs: number = DEFAULT_BACKEND_TIMEOUT_MS;

/** Clamp to [MIN,MAX]; a non-finite input falls back to the default. */
function clampTimeout(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_BACKEND_TIMEOUT_MS;
  return Math.max(MIN_BACKEND_TIMEOUT_MS, Math.min(MAX_BACKEND_TIMEOUT_MS, Math.floor(ms)));
}

/** Read the persisted timeout (clamped, defaulted when absent/malformed). */
export async function getBackendTimeoutMs(): Promise<number> {
  try {
    const result = await chrome.storage.local.get(BACKEND_TIMEOUT_STORAGE_KEY);
    const ms = clampTimeout(Number(result?.[BACKEND_TIMEOUT_STORAGE_KEY]));
    cachedTimeoutMs = ms;
    return ms;
  } catch {
    return cachedTimeoutMs;
  }
}

/** Persist a new timeout (clamped). Updates the sync cache immediately. */
export async function setBackendTimeoutMs(ms: number): Promise<void> {
  const clamped = clampTimeout(Number(ms));
  cachedTimeoutMs = clamped;
  try {
    await chrome.storage.local.set({ [BACKEND_TIMEOUT_STORAGE_KEY]: clamped });
  } catch {
    /* best-effort */
  }
}

/** SYNC accessor for the request hot path: last-known value or the default. */
export function getCachedBackendTimeoutMs(): number {
  return cachedTimeoutMs;
}

/**
 * Seed the cache once (async) and keep it live via a storage.onChanged listener,
 * so a settings change from the popup is reflected in every client without a
 * restart. Call once at background startup.
 */
export function initBackendTimeoutCache(): void {
  void getBackendTimeoutMs().catch(() => {});
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const change = changes[BACKEND_TIMEOUT_STORAGE_KEY];
      if (!change) return;
      cachedTimeoutMs = clampTimeout(Number(change.newValue));
    });
  } catch {
    /* onChanged may be unavailable in some contexts */
  }
}
