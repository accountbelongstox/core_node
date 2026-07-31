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
import type { PycoreAppSettings, QueueItem } from '../../../core/api-libs/pycore/pycoreTypes';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

export function loadSettings(): Partial<PycoreAppSettings> | null {
  const settings = StorageManager.get<Partial<PycoreAppSettings> | null>(StorageKeys.PYCORE_CACHE_SETTINGS, null);
  if (!settings) {
    // Back-compat: the original app stored only the theme under this key.
    const legacyTheme = StorageManager.getRaw(StorageKeys.PYCORE_CACHE_THEME_LEGACY);
    if (legacyTheme === 'light' || legacyTheme === 'dark') return { theme: legacyTheme };
    return null;
  }
  return settings;
}

export function saveSettings(settings: PycoreAppSettings): void {
  StorageManager.set(StorageKeys.PYCORE_CACHE_SETTINGS, settings);
  // Keep the legacy theme key in sync for any older readers.
  StorageManager.setRaw(StorageKeys.PYCORE_CACHE_THEME_LEGACY, settings.theme);
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

