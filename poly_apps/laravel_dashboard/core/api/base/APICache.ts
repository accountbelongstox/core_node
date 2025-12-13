import { CacheEntry } from '../types';

/**
 * APICache - 简单的内存+localStorage缓存
 */
export class APICache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private localStoragePrefix = 'api_cache_';

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    // 先查内存缓存
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data as T;
    }

    // 查localStorage
    try {
      const stored = localStorage.getItem(this.localStoragePrefix + key);
      if (stored) {
        const entry: CacheEntry = JSON.parse(stored);
        if (!this.isExpired(entry)) {
          // 恢复到内存
          this.memoryCache.set(key, entry);
          return entry.data as T;
        }
        // 过期，删除
        localStorage.removeItem(this.localStoragePrefix + key);
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }

    return null;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // 存内存
    this.memoryCache.set(key, entry);

    // 存localStorage (仅存小数据)
    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length < 50000) { // 小于50KB
        localStorage.setItem(this.localStoragePrefix + key, serialized);
      }
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  /**
   * 删除缓存
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
   * 清空缓存
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

    // 按模式清除
    const keys = Array.from(this.memoryCache.keys()).filter(k => k.includes(pattern));
    keys.forEach(k => this.delete(k));
  }

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// 单例
export const apiCache = new APICache();
