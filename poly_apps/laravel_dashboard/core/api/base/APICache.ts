import { CacheEntry } from '../types';

/**
 * APICache - Simple in-memory + localStorage cache
 */
export class APICache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private localStoragePrefix = 'api_cache_';

  /**
   * Get a cache entry
   */
  get<T>(key: string): T | null {
    // Check the memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data as T;
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(this.localStoragePrefix + key);
      if (stored) {
        const entry: CacheEntry = JSON.parse(stored);
        if (!this.isExpired(entry)) {
          // Restore into memory
          this.memoryCache.set(key, entry);
          return entry.data as T;
        }
        // Expired, delete it
        localStorage.removeItem(this.localStoragePrefix + key);
      }
    } catch (error) {
      console.warn('Cache read error:', error);
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

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in localStorage (only small payloads)
    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length < 50000) { // Less than 50KB
        localStorage.setItem(this.localStoragePrefix + key, serialized);
      }
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(this.localStoragePrefix + key);
    } catch (error) {
      console.warn('Cache delete error:', error);
    }
  }

  /**
   * Clear the cache
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.memoryCache.clear();
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(this.localStoragePrefix))
          .forEach(k => localStorage.removeItem(k));
      } catch (error) {
        console.warn('Cache clear error:', error);
      }
      return;
    }

    // Clear by pattern
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
