export { StorageManager } from './StorageManager';
export { StorageKeys } from './StorageKeys';
export type { StorageKey } from './StorageKeys';

/**
 * Client-side persistence (localStorage with safe fallback).
 *
 * NOTE:
 * - Always JSON-serializes values.
 * - Uses a prefixed keyspace to avoid collisions.
 * - Reads legacy (unprefixed) keys and migrates them on first access.
 */

const STORAGE_PREFIX = 'laravel_dashboard:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>;

const memoryStorage = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => {
      m.clear();
    }
  } satisfies StorageLike;
})();

function resolveStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // sanity check (can throw in some privacy modes)
      const t = '__storage_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    }
  } catch {
    // ignore
  }
  return memoryStorage;
}

function withPrefix(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function tryParseJson<T>(raw: string | null): T | null {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Some older/hand-written values may be plain strings
    return raw as unknown as T;
  }
}

/**
 * Centralized storage keys.
 * Keep keys stable; changing them breaks persisted data.
 */
export const StorageKeys = {
  // Unified app state
  APP_STATE: 'app_state',
  USER: 'user',
  SETTINGS: 'settings',
  THEME: 'theme',
  LANGUAGE: 'language',

  // ServerManagerV1 cache
  SERVER_MANAGER_NGINX_SITES: 'server_manager_v1:nginx_sites',
  SERVER_MANAGER_SSL_CERTS: 'server_manager_v1:ssl_certs',
  SERVER_MANAGER_CERTBOT_STATUS: 'server_manager_v1:certbot_status',
  SERVER_MANAGER_UNIFIED_APPS: 'server_manager_v1:unified_apps',
  SERVER_MANAGER_SCRIPTS: 'server_manager_v1:scripts',
  SERVER_MANAGER_FILE_CURRENT_PATH: 'server_manager_v1:file_current_path',
  SERVER_MANAGER_FILE_ALLOWED_PATHS: 'server_manager_v1:file_allowed_paths'
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export class StorageManager {
  private static storage(): StorageLike {
    return resolveStorage();
  }

  private static getRaw(key: string): string | null {
    const store = StorageManager.storage();

    // Prefer prefixed namespace
    const prefixed = store.getItem(withPrefix(key));
    if (prefixed != null) return prefixed;

    // Legacy fallback (unprefixed), with migration
    const legacy = store.getItem(key);
    if (legacy != null) {
      try {
        store.setItem(withPrefix(key), legacy);
        store.removeItem(key);
      } catch {
        // ignore migration errors
      }
    }
    return legacy;
  }

  static get<T>(key: StorageKey, defaultValue: T): T {
    try {
      const parsed = tryParseJson<T>(StorageManager.getRaw(key));
      return parsed == null ? defaultValue : parsed;
    } catch (error) {
      console.warn('[StorageManager] get failed:', key, error);
      return defaultValue;
    }
  }

  static set<T>(key: StorageKey, value: T): boolean {
    try {
      StorageManager.storage().setItem(withPrefix(key), JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[StorageManager] set failed:', key, error);
      return false;
    }
  }

  static remove(key: StorageKey): boolean {
    try {
      const store = StorageManager.storage();
      store.removeItem(withPrefix(key));
      // also try legacy key just in case
      store.removeItem(key);
      return true;
    } catch (error) {
      console.warn('[StorageManager] remove failed:', key, error);
      return false;
    }
  }

  static clearAll(): boolean {
    try {
      // Only clear prefixed keys to avoid wiping unrelated app data.
      const store = StorageManager.storage() as Storage;
      const keysToRemove: string[] = [];

      if (typeof store.length === 'number' && typeof store.key === 'function') {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => store.removeItem(k));
        return true;
      }

      // Fallback: if it's not a real Storage, just clear it.
      StorageManager.storage().clear();
      return true;
    } catch (error) {
      console.warn('[StorageManager] clearAll failed:', error);
      return false;
    }
  }
}

