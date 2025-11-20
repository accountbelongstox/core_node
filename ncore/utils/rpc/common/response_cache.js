const logger = require('#@logger');

class ResponseCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 10000;
        this.defaultTTL = options.defaultTTL || 1800000;
        this.cleanupInterval = options.cleanupInterval || 60000;

        this.startAutoCleanup();
    }

    set(requestId, data, ttl = null) {
        if (this.cache.size >= this.maxSize) {
            this.cleanOldest();
        }

        this.cache.set(requestId, {
            data,
            createdAt: Date.now(),
            expiresAt: Date.now() + (ttl || this.defaultTTL),
            accessed: 0
        });

        return true;
    }

    get(requestId, remove = false) {
        const cached = this.cache.get(requestId);

        if (!cached) {
            return null;
        }

        if (Date.now() > cached.expiresAt) {
            this.cache.delete(requestId);
            return null;
        }

        cached.accessed++;
        cached.lastAccessedAt = Date.now();

        if (remove) {
            this.cache.delete(requestId);
        }

        return cached.data;
    }

    has(requestId) {
        const cached = this.cache.get(requestId);
        if (!cached) {
            return false;
        }

        if (Date.now() > cached.expiresAt) {
            this.cache.delete(requestId);
            return false;
        }

        return true;
    }

    delete(requestId) {
        return this.cache.delete(requestId);
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }

    cleanOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, value] of this.cache.entries()) {
            if (value.createdAt < oldestTime) {
                oldestTime = value.createdAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            logger.debug(`ResponseCache: Removed oldest entry ${oldestKey}`);
        }
    }

    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, value] of this.cache.entries()) {
            if (now > value.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`ResponseCache: Cleaned ${cleaned} expired entries`);
        }

        if (this.cache.size > this.maxSize) {
            const toRemove = this.cache.size - this.maxSize;
            logger.warn(`ResponseCache: Size ${this.cache.size} exceeds max ${this.maxSize}, removing ${toRemove} oldest entries`);

            for (let i = 0; i < toRemove; i++) {
                this.cleanOldest();
            }
        }

        return cleaned;
    }

    startAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);

        return this;
    }

    stopAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        return this;
    }

    getStats() {
        const now = Date.now();
        const stats = {
            size: this.cache.size,
            maxSize: this.maxSize,
            expired: 0,
            active: 0
        };

        for (const value of this.cache.values()) {
            if (now > value.expiresAt) {
                stats.expired++;
            } else {
                stats.active++;
            }
        }

        return stats;
    }
}

const defaultResponseCache = new ResponseCache();

module.exports = {
    ResponseCache,
    defaultResponseCache
};
