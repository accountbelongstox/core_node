import { CacheEntry } from './TransportTypes';
import { StorageManager } from '../../../persistence';
import { LaravelStorageKeys } from '../LaravelStorageKeys';

const MAX_PERSISTED_ENTRY_BYTES = 50_000;

/** In-memory + localStorage response cache. */
export class APICache {
  private memoryCache: Map<string, CacheEntry> = new Map();

  private storageKey(key: string): string {
    return `${LaravelStorageKeys.API_CACHE_PREFIX}${key}`;
  }

  /**
   * Get a cache entry
   */
  get<T>(key: string): T | null {
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data as T;
    }

    const stored = StorageManager.get<CacheEntry | null>(this.storageKey(key), null);
    if (stored && typeof stored === 'object') {
      if (!this.isExpired(stored)) {
        this.memoryCache.set(key, stored);
        return stored.data as T;
      }
      StorageManager.remove(this.storageKey(key));
    }

    return null;
  }

  /**
   * Set a cache entry
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.memoryCache.set(key, entry);

    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length < MAX_PERSISTED_ENTRY_BYTES) {
        StorageManager.set(this.storageKey(key), entry);
      }
    } catch {
      /* best-effort persistence */
    }
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    StorageManager.remove(this.storageKey(key));
  }

  /**
   * Clear the cache
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.memoryCache.clear();
      StorageManager.keysWithPrefix(LaravelStorageKeys.API_CACHE_PREFIX)
        .forEach((key) => StorageManager.remove(key));
      return;
    }

    const keys = Array.from(this.memoryCache.keys()).filter(k => k.includes(pattern));
    keys.forEach(k => this.delete(k));
  }

  /**
   * Check whether an entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Check whether an entry exists
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// Singleton
export const apiCache = new APICache();
