/**
 * Simple LRU Cache Implementation
 * Lightweight alternative to lru-cache package
 */
class SimpleLRUCache {
  constructor(options = {}) {
    this.max = options.max || 500 // 最多缓存500条
    this.maxSize = options.maxSize || 5000 * 1024 // 最大5MB
    this.ttl = options.ttl || 1000 * 60 * 60 // 1小时过期
    this.updateAgeOnGet = options.updateAgeOnGet !== false // 默认访问时更新时间

    this.cache = new Map()
    this.size = 0
    this.calculatedSize = 0
  }

  /**
   * Calculate size of value in bytes
   */
  _calculateSize(value) {
    if (typeof value === 'string') {
      return value.length
    }
    return JSON.stringify(value).length
  }

  /**
   * Check if entry is expired
   */
  _isExpired(entry) {
    if (!entry.expires) {
      return false
    }
    return Date.now() > entry.expires
  }

  /**
   * Remove oldest entry
   */
  _evict() {
    let oldestKey = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  /**
   * Get value from cache
   */
  get(key) {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (this._isExpired(entry)) {
      this.delete(key)
      return undefined
    }

    // Update timestamp if configured
    if (this.updateAgeOnGet) {
      entry.timestamp = Date.now()
      entry.expires = Date.now() + this.ttl
    }

    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key, value) {
    const valueSize = this._calculateSize(value)

    // Check if single value exceeds max size
    if (valueSize > this.maxSize) {
      return false
    }

    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.delete(key)
    }

    // Evict entries until we have space
    while (this.cache.size >= this.max || this.calculatedSize + valueSize > this.maxSize) {
      this._evict()
    }

    // Add new entry
    const entry = {
      value,
      timestamp: Date.now(),
      expires: Date.now() + this.ttl,
      size: valueSize
    }

    this.cache.set(key, entry)
    this.calculatedSize += valueSize
    this.size = this.cache.size

    return true
  }

  /**
   * Check if key exists
   */
  has(key) {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    if (this._isExpired(entry)) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete key from cache
   */
  delete(key) {
    const entry = this.cache.get(key)

    if (entry) {
      this.calculatedSize -= entry.size
      this.cache.delete(key)
      this.size = this.cache.size
      return true
    }

    return false
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear()
    this.calculatedSize = 0
    this.size = 0
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.size,
      calculatedSize: this.calculatedSize,
      maxSize: this.maxSize,
      maxEntries: this.max,
      usage: `${((this.calculatedSize / this.maxSize) * 100).toFixed(2)}%`,
      entries: this.size
    }
  }

  /**
   * Clean expired entries
   */
  prune() {
    let prunedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry)) {
        this.delete(key)
        prunedCount++
      }
    }

    return prunedCount
  }
}

module.exports = SimpleLRUCache
