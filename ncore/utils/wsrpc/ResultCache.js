const logger = require('#@logger');

class ResultCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 10000;
        this.ttl = options.ttl || 3600000;
        this.cleanupInterval = options.cleanupInterval || 60000;
        this.cache = new Map();
        this.startCleanup();
    }

    set(requestId, result, metadata = {}) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
            logger.debug(`Cache full, removed oldest entry: ${oldestKey}`);
        }

        this.cache.set(requestId, {
            result,
            metadata,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.ttl
        });

        logger.debug(`Cached result for request: ${requestId}`);
    }

    get(requestId) {
        const entry = this.cache.get(requestId);
        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(requestId);
            logger.debug(`Expired cache entry removed: ${requestId}`);
            return null;
        }

        return {
            result: entry.result,
            metadata: entry.metadata,
            timestamp: entry.timestamp
        };
    }

    has(requestId) {
        const entry = this.cache.get(requestId);
        if (!entry) {
            return false;
        }

        if (Date.now() > entry.expiresAt) {
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
        logger.debug('Cache cleared');
    }

    size() {
        return this.cache.size;
    }

    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            let removed = 0;

            for (const [requestId, entry] of this.cache.entries()) {
                if (now > entry.expiresAt) {
                    this.cache.delete(requestId);
                    removed++;
                }
            }

            if (removed > 0) {
                logger.debug(`Cleaned up ${removed} expired cache entries`);
            }
        }, this.cleanupInterval);
    }

    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    getStats() {
        const now = Date.now();
        let expired = 0;

        for (const entry of this.cache.values()) {
            if (now > entry.expiresAt) {
                expired++;
            }
        }

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            expired,
            active: this.cache.size - expired
        };
    }
}

module.exports = ResultCache;
