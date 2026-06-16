import type { StorageKey } from './StorageKeys';

/**
 * StorageManager
 * Small, type-friendly wrapper for browser localStorage.
 *
 * - Safe JSON parse/stringify
 * - Optional default values
 * - SSR/Non-browser guard
 */
export class StorageManager {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  static has(key: StorageKey): boolean {
    if (!this.isBrowser()) return false;
    try {
      return window.localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  static get<T>(key: StorageKey, defaultValue?: T): T {
    if (!this.isBrowser()) return defaultValue as T;

    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue as T;

      try {
        return JSON.parse(raw) as T;
      } catch {
        // Support legacy plain-string storage when JSON.parse fails
        return (defaultValue !== undefined ? defaultValue : (raw as unknown as T)) as T;
      }
    } catch (error) {
      console.error('[StorageManager] get failed:', { key, error });
      return defaultValue as T;
    }
  }

  static set<T>(key: StorageKey, value: T): void {
    if (!this.isBrowser()) return;

    try {
      // Treat undefined as "remove" to avoid storing invalid JSON.
      if (value === undefined) {
        window.localStorage.removeItem(key);
        return;
      }

      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('[StorageManager] set failed:', { key, error });
    }
  }

  static remove(key: StorageKey): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('[StorageManager] remove failed:', { key, error });
    }
  }
}

