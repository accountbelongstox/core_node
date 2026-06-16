/**
 * PycoreCache — local (localStorage) cache for the dashboard's pycore-manager end.
 *
 * Ported from the original desktop-manager `src/store/cache.ts`. Persists a
 * snapshot of the voice/TTS queue + UI settings so pages paint instantly on boot
 * and survive a pycore backend hiccup (offline-tolerant). The pycore service
 * stays the source of truth; this is a cache layer only.
 *
 * The cache key prefix is `pycore_` (was `desktop_manager_`) to avoid collisions
 * with the other ends sharing this shell's localStorage.
 */
import type { AppSettings, QueueItem } from './pycoreTypes';

const PREFIX = 'pycore_';
const K_SETTINGS = PREFIX + 'settings';
const K_QUEUE = PREFIX + 'queue_cache';
const K_QUEUE_TS = PREFIX + 'queue_cache_ts';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* quota / disabled - ignore */ }
}

export function loadSettings(): Partial<AppSettings> | null {
  const raw = safeGet(K_SETTINGS);
  if (!raw) {
    // Back-compat: the original app stored only the theme under this key.
    const legacyTheme = safeGet(PREFIX + 'theme');
    if (legacyTheme === 'light' || legacyTheme === 'dark') return { theme: legacyTheme };
    return null;
  }
  try { return JSON.parse(raw) as Partial<AppSettings>; } catch { return null; }
}

export function saveSettings(settings: AppSettings): void {
  safeSet(K_SETTINGS, JSON.stringify(settings));
  // Keep the legacy theme key in sync for any older readers.
  safeSet(PREFIX + 'theme', settings.theme);
}

export function loadQueueCache(): QueueItem[] | null {
  const raw = safeGet(K_QUEUE);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as QueueItem[]) : null;
  } catch { return null; }
}

export function saveQueueCache(items: QueueItem[]): void {
  safeSet(K_QUEUE, JSON.stringify(items));
  safeSet(K_QUEUE_TS, String(Date.now()));
}

export function queueCacheAgeMs(): number | null {
  const ts = safeGet(K_QUEUE_TS);
  return ts ? Date.now() - parseInt(ts, 10) : null;
}
