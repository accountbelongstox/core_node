/**
 * CacheManager - Unified Cache Management
 * Provides in-memory and localStorage caching with TTL support
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface CacheStats {
  size: number;
  keys: string[];
  memorySize: number;
  localStorageSize: number;
}

class CacheManagerClass {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private localStoragePrefix = 'nexus_cache_';
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get data from cache (memory first, then localStorage)
   */
  get<T>(key: string): T | null {
    // Check memory cache first
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
          // Restore to memory
          this.memoryCache.set(key, entry);
          return entry.data as T;
        }
        // Expired, remove
        localStorage.removeItem(this.localStoragePrefix + key);
      }
    } catch (error) {
      console.warn('[CacheManager] Read error:', error);
    }

    return null;
  }

  /**
   * Set data in cache (both memory and localStorage)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in localStorage
    try {
      localStorage.setItem(
        this.localStoragePrefix + key,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.warn('[CacheManager] Write error (localStorage full?):', error);
      // If localStorage is full, at least keep it in memory
    }
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(this.localStoragePrefix + key);
    } catch (error) {
      console.warn('[CacheManager] Remove error:', error);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.localStoragePrefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[CacheManager] Clear error:', error);
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      return true;
    }

    try {
      const stored = localStorage.getItem(this.localStoragePrefix + key);
      if (stored) {
        const entry: CacheEntry = JSON.parse(stored);
        if (!this.isExpired(entry)) {
          return true;
        }
      }
    } catch (error) {
      // Ignore
    }

    return false;
  }

  /**
   * Get or set pattern (get from cache, or fetch and cache)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Invalidate cache (mark as expired)
   */
  invalidate(key: string): void {
    this.remove(key);
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    
    // Memory cache
    this.memoryCache.forEach((_, key) => {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    });

    // localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.localStoragePrefix) && regex.test(key.replace(this.localStoragePrefix, ''))) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[CacheManager] Invalidate pattern error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const keys: string[] = [];
    
    // Memory keys
    this.memoryCache.forEach((_, key) => {
      if (!this.isExpired(this.memoryCache.get(key)!)) {
        keys.push(key);
      }
    });

    // localStorage keys
    try {
      const lsKeys = Object.keys(localStorage);
      lsKeys.forEach((key) => {
        if (key.startsWith(this.localStoragePrefix)) {
          const cacheKey = key.replace(this.localStoragePrefix, '');
          if (!keys.includes(cacheKey)) {
            try {
              const entry: CacheEntry = JSON.parse(localStorage.getItem(key)!);
              if (!this.isExpired(entry)) {
                keys.push(cacheKey);
              }
            } catch {
              // Ignore invalid entries
            }
          }
        }
      });
    } catch (error) {
      // Ignore
    }

    return {
      size: keys.length,
      keys,
      memorySize: this.memoryCache.size,
      localStorageSize: 0, // Could calculate, but expensive
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    // Clean memory
    this.memoryCache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    });

    // Clean localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.localStoragePrefix)) {
          try {
            const entry: CacheEntry = JSON.parse(localStorage.getItem(key)!);
            if (this.isExpired(entry)) {
              localStorage.removeItem(key);
            }
          } catch {
            // Remove invalid entries
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('[CacheManager] Clean error:', error);
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }
}

// Singleton instance
export const cacheManager = new CacheManagerClass();

// Auto-clean expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheManager.cleanExpired();
  }, 5 * 60 * 1000);
}

