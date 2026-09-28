/**
 * Pycore Manager cache for UI settings and queue snapshots.
 *
 * Ported from the original desktop-manager `src/store/cache.ts`. Persists a
 * snapshot of the voice/TTS queue + UI settings so pages paint instantly on boot
 * and survive a pycore backend hiccup (offline-tolerant). The pycore service
 * stays the source of truth; this is a cache layer only.
 *
 * The cache key prefix is `pycore_` (was `desktop_manager_`) to avoid collisions
 * with the other ends sharing this shell's localStorage.
 */
import type {
  PycoreAppSettings,
  QueueItem,
} from '../../../core/integrations/pycore/PycorePlatformTypes';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

export function loadSettings(): Partial<PycoreAppSettings> | null {
  return StorageManager.get<Partial<PycoreAppSettings> | null>(StorageKeys.PYCORE_CACHE_SETTINGS, null);
}

export function saveSettings(settings: PycoreAppSettings): void {
  StorageManager.set(StorageKeys.PYCORE_CACHE_SETTINGS, settings);
}

export function loadQueueCache(): QueueItem[] | null {
  const queue = StorageManager.get<QueueItem[] | null>(StorageKeys.PYCORE_CACHE_QUEUE, null);
  return Array.isArray(queue) ? queue : null;
}

export function saveQueueCache(items: QueueItem[]): void {
  StorageManager.set(StorageKeys.PYCORE_CACHE_QUEUE, items);
  StorageManager.set(StorageKeys.PYCORE_CACHE_QUEUE_TS, Date.now());
}

export function queueCacheAgeMs(): number | null {
  const timestamp = StorageManager.get<number | null>(StorageKeys.PYCORE_CACHE_QUEUE_TS, null);
  return timestamp ? Date.now() - timestamp : null;
}

// --- Generic TTL cache (frontend central cache library) ------------------- //
// Any UI probe with a expensive/slow backend answer (e.g. the ffmpeg probe)
// caches its last good value here so the panel paints instantly; callers pick
// a TTL and force a re-probe on explicit triggers (relay device change etc.).

const GENERIC_CACHE_PREFIX = 'pycore_ttl_cache:';

export interface TtlCachedValue<T> {
  value: T;
  cachedAt: number;
}

export function saveTtlCache<T>(name: string, value: T): void {
  StorageManager.set<TtlCachedValue<T>>(`${GENERIC_CACHE_PREFIX}${name}`, {
    value,
    cachedAt: Date.now(),
  });
}

/** Returns the cached entry, or null when missing or older than maxAgeMs. */
export function loadTtlCache<T>(name: string, maxAgeMs?: number): TtlCachedValue<T> | null {
  const entry = StorageManager.get<TtlCachedValue<T> | null>(`${GENERIC_CACHE_PREFIX}${name}`, null);
  if (!entry || typeof entry.cachedAt !== 'number') return null;
  if (maxAgeMs !== undefined && Date.now() - entry.cachedAt > maxAgeMs) return null;
  return entry;
}

/** Last good value regardless of age (stale-while-revalidate rendering). */
export function loadTtlCacheStale<T>(name: string): TtlCachedValue<T> | null {
  return loadTtlCache<T>(name);
}
