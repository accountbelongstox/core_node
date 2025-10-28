// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');

class CacheManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.ttl = new Map();
        this.maxSize = options.maxSize || 1000;
        this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
        this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
        this.isInitialized = false;
        this.metrics = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            cleanups: 0
        };
        this.cleanupTimer = null;
    }

    async initialize() {
        try {
            this.startCleanupTimer();
            this.isInitialized = true;
            logger.info('CacheManager initialized');
        } catch (error) {
            logger.error('Failed to initialize CacheManager:', error);
            throw error;
        }
    }

    set(key, value, ttl = null) {
        try {
            const actualTTL = ttl || this.defaultTTL;
            
            // Check if cache is full
            if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
                this.evictOldest();
            }
            
            this.cache.set(key, value);
            this.ttl.set(key, Date.now() + actualTTL);
            this.metrics.sets++;
            
            logger.debug(`Cache set: ${key} (TTL: ${actualTTL}ms)`);
        } catch (error) {
            logger.error(`Failed to set cache key ${key}:`, error);
            throw error;
        }
    }

    get(key) {
        try {
            if (!this.cache.has(key)) {
                this.metrics.misses++;
                logger.debug(`Cache miss: ${key}`);
                return null;
            }
            
            const expiry = this.ttl.get(key);
            if (Date.now() > expiry) {
                this.cache.delete(key);
                this.ttl.delete(key);
                this.metrics.misses++;
                logger.debug(`Cache expired: ${key}`);
                return null;
            }
            
            this.metrics.hits++;
            logger.debug(`Cache hit: ${key}`);
            return this.cache.get(key);
        } catch (error) {
            logger.error(`Failed to get cache key ${key}:`, error);
            return null;
        }
    }

    has(key) {
        try {
            if (!this.cache.has(key)) {
                return false;
            }
            
            const expiry = this.ttl.get(key);
            if (Date.now() > expiry) {
                this.cache.delete(key);
                this.ttl.delete(key);
                return false;
            }
            
            return true;
        } catch (error) {
            logger.error(`Failed to check cache key ${key}:`, error);
            return false;
        }
    }

    delete(key) {
        try {
            const deleted = this.cache.delete(key);
            this.ttl.delete(key);
            
            if (deleted) {
                this.metrics.deletes++;
                logger.debug(`Cache deleted: ${key}`);
            }
            
            return deleted;
        } catch (error) {
            logger.error(`Failed to delete cache key ${key}:`, error);
            return false;
        }
    }

    clear() {
        try {
            this.cache.clear();
            this.ttl.clear();
            logger.info('Cache cleared');
        } catch (error) {
            logger.error('Failed to clear cache:', error);
            throw error;
        }
    }

    evictOldest() {
        try {
            if (this.cache.size === 0) {
                return;
            }
            
            let oldestKey = null;
            let oldestTime = Infinity;
            
            for (const [key, time] of this.ttl) {
                if (time < oldestTime) {
                    oldestTime = time;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                this.cache.delete(oldestKey);
                this.ttl.delete(oldestKey);
                this.metrics.evictions++;
                logger.debug(`Cache evicted: ${oldestKey}`);
            }
        } catch (error) {
            logger.error('Failed to evict oldest cache entry:', error);
        }
    }

    cleanup() {
        try {
            const now = Date.now();
            const expiredKeys = [];
            
            for (const [key, expiry] of this.ttl) {
                if (now > expiry) {
                    expiredKeys.push(key);
                }
            }
            
            for (const key of expiredKeys) {
                this.cache.delete(key);
                this.ttl.delete(key);
            }
            
            this.metrics.cleanups++;
            logger.debug(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
        } catch (error) {
            logger.error('Failed to cleanup cache:', error);
        }
    }

    startCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
        
        logger.debug(`Cache cleanup timer started (interval: ${this.cleanupInterval}ms)`);
    }

    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            logger.debug('Cache cleanup timer stopped');
        }
    }

    getStats() {
        const hitRate = this.metrics.hits + this.metrics.misses > 0 
            ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100).toFixed(2)
            : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: `${hitRate}%`,
            metrics: this.metrics
        };
    }

    async shutdown() {
        try {
            this.stopCleanupTimer();
            this.clear();
            this.isInitialized = false;
            logger.info('CacheManager shutdown');
        } catch (error) {
            logger.error('Failed to shutdown CacheManager:', error);
            throw error;
        }
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            size: this.cache.size,
            maxSize: this.maxSize,
            defaultTTL: this.defaultTTL,
            cleanupInterval: this.cleanupInterval,
            stats: this.getStats()
        };
    }
}

module.exports = CacheManager;
