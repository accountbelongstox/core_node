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

  static getRaw(key: StorageKey): string | null {
    if (!this.isBrowser()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  static setRaw(key: StorageKey, value: string | null): void {
    if (!this.isBrowser()) return;
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* best-effort persistence */
    }
  }

  /** Read an unregistered key only for one-time migration into a canonical key. */
  static getLegacyRaw(key: string): string | null {
    if (!this.isBrowser()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /** Enumerate unregistered keys only for one-time prefix migrations. */
  static listLegacyRaw(prefix: string): Array<{ key: string; value: string }> {
    if (!this.isBrowser()) return [];
    const entries: Array<{ key: string; value: string }> = [];
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !key.startsWith(prefix)) continue;
        const value = window.localStorage.getItem(key);
        if (value !== null) entries.push({ key, value });
      }
    } catch {
      return entries;
    }
    return entries;
  }

  /** Remove unregistered keys after a successful one-time migration. */
  static removeLegacyRaw(keys: readonly string[]): void {
    if (!this.isBrowser()) return;
    try {
      for (const key of keys) window.localStorage.removeItem(key);
    } catch {
      /* best-effort migration cleanup */
    }
  }

  /** Move an existing serialized value without parsing or rewriting its shape. */
  static migrateRaw(sourceKey: StorageKey, targetKey: StorageKey): boolean {
    if (!this.isBrowser()) return false;
    try {
      if (window.localStorage.getItem(targetKey) !== null) return false;
      const raw = window.localStorage.getItem(sourceKey);
      if (raw === null) return false;
      window.localStorage.setItem(targetKey, raw);
      window.localStorage.removeItem(sourceKey);
      return true;
    } catch {
      return false;
    }
  }

  static getSession<T>(key: StorageKey, defaultValue?: T): T {
    if (typeof window === 'undefined' || !window.sessionStorage) return defaultValue as T;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return defaultValue as T;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch {
      return defaultValue as T;
    }
  }

  static getSessionRaw(key: StorageKey): string | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  static setSessionRaw(key: StorageKey, value: string | null): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      if (value === null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch {
      /* best-effort persistence */
    }
  }

  static setSession<T>(key: StorageKey, value: T): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* best-effort persistence */
    }
  }

  static hasSession(key: StorageKey): boolean {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    try {
      return window.sessionStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  static removeSession(key: StorageKey): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* best-effort persistence */
    }
  }
}

