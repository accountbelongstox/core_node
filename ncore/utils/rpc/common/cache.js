const { encyclopedia } = require('#@global_vars');
const logger = require('#@logger');

class RpcCache {
    constructor(namespace = 'rpc') {
        this.namespace = namespace;
        this.memoryCache = new Map();
    }

    _getKey(key) {
        return `${this.namespace}:${key}`;
    }

    get(key, useMemory = true) {
        if (useMemory && this.memoryCache.has(key)) {
            const cached = this.memoryCache.get(key);
            if (cached.expiry === null || cached.expiry > Date.now()) {
                return cached.value;
            }
            this.memoryCache.delete(key);
        }

        const fullKey = this._getKey(key);
        const value = encyclopedia.get(fullKey);

        if (value && value.expiry && value.expiry <= Date.now()) {
            encyclopedia.delete(fullKey);
            return null;
        }

        return value ? value.data : null;
    }

    set(key, value, ttl = null, persist = true) {
        const cached = {
            value,
            expiry: ttl ? Date.now() + ttl : null,
            timestamp: Date.now()
        };

        this.memoryCache.set(key, cached);

        if (persist) {
            const fullKey = this._getKey(key);
            encyclopedia.set(fullKey, {
                data: value,
                expiry: cached.expiry,
                timestamp: cached.timestamp
            });
            encyclopedia.saveEncyclopedia();
        }

        return true;
    }

    has(key) {
        if (this.memoryCache.has(key)) {
            return true;
        }
        const fullKey = this._getKey(key);
        return encyclopedia.has(fullKey);
    }

    delete(key) {
        this.memoryCache.delete(key);
        const fullKey = this._getKey(key);
        encyclopedia.delete(fullKey);
        encyclopedia.saveEncyclopedia();
        return true;
    }

    clear(persistToo = false) {
        this.memoryCache.clear();

        if (persistToo) {
            const keys = encyclopedia.keys();
            const prefix = `${this.namespace}:`;
            keys.forEach(key => {
                if (key.startsWith(prefix)) {
                    encyclopedia.delete(key);
                }
            });
            encyclopedia.saveEncyclopedia();
        }

        return true;
    }

    keys() {
        const allKeys = Array.from(encyclopedia.keys());
        const prefix = `${this.namespace}:`;
        return allKeys
            .filter(key => key.startsWith(prefix))
            .map(key => key.substring(prefix.length));
    }

    size() {
        return this.keys().length;
    }

    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.memoryCache.entries()) {
            if (cached.expiry && cached.expiry <= now) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }

        const keys = this.keys();
        keys.forEach(key => {
            const value = this.get(key, false);
            if (value === null) {
                cleaned++;
            }
        });

        if (cleaned > 0) {
            logger.debug(`RpcCache: Cleaned ${cleaned} expired entries`);
        }

        return cleaned;
    }

    startAutoCleanup(interval = 300000) {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, interval);

        return this;
    }

    stopAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        return this;
    }
}

const defaultCache = new RpcCache('rpc_default');
defaultCache.startAutoCleanup();

module.exports = {
    RpcCache,
    defaultCache,
    createCache: (namespace) => new RpcCache(namespace)
};
