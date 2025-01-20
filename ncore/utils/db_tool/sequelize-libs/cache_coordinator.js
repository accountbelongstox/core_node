const logger = require('#@logger');

class CacheCoordinator {
    constructor() {
        this.memoryCache = new Map();
        this.operationStats = new Map();
    }

    /**
     * Initialize cache for a table
     * @param {string} tableName - Name of the table
     */
    initializeTable(tableName) {
        if (!this.operationStats.has(tableName)) {
            this.operationStats.set(tableName, {
                lastDeleteTime: null,
                lastInsertTime: null,
                lastUpdateTime: null,
                lastQueryTime: null,
                deleteCount: 0,
                insertCount: 0,
                updateCount: 0,
                queryCount: 0,
                hasOperations: false
            });
        }
    }

    /**
     * Check if cache needs update based on table operations
     * @param {string} tableName - Name of the table
     * @param {boolean} [ignoreChanges=false] - Whether to ignore changes and use cache anyway
     * @returns {boolean} - True if cache needs update
     */
    needsCacheUpdate(tableName, ignoreChanges = false) {
        this.initializeTable(tableName);
        const stats = this.operationStats.get(tableName);
        const cache = this.memoryCache.get(tableName);

        if (ignoreChanges && cache) {
            return false;
        }

        if (!cache) {
            return true;
        }

        return !!(stats.lastDeleteTime || stats.lastInsertTime || stats.lastUpdateTime);
    }

    /**
     * Record an operation on a table
     * @param {string} operationType - Type of operation (delete/insert/update/query)
     * @param {string} tableName - Name of the table
     */
    recordOperation(operationType, tableName) {
        this.initializeTable(tableName);
        const stats = this.operationStats.get(tableName);
        const now = Date.now();

        switch(operationType) {
            case 'delete':
                stats.lastDeleteTime = now;
                stats.deleteCount++;
                break;
            case 'insert':
                stats.lastInsertTime = now;
                stats.insertCount++;
                break;
            case 'update':
                stats.lastUpdateTime = now;
                stats.updateCount++;
                break;
            case 'query':
                stats.lastQueryTime = now;
                stats.queryCount++;
                break;
        }

        stats.hasOperations = true;
        this.operationStats.set(tableName, stats);
    }

    /**
     * Get operation statistics for a table
     * @param {string} tableName - Name of the table
     * @returns {Object} Operation statistics
     */
    getOperationStats(tableName) {
        this.initializeTable(tableName);
        return { ...this.operationStats.get(tableName) };
    }

    /**
     * Reset operation statistics for a table
     * @param {string} tableName - Name of the table
     */
    resetOperationStats(tableName) {
        const emptyStats = {
            lastDeleteTime: null,
            lastInsertTime: null,
            lastUpdateTime: null,
            lastQueryTime: null,
            deleteCount: 0,
            insertCount: 0,
            updateCount: 0,
            queryCount: 0,
            hasOperations: false
        };

        this.operationStats.set(tableName, emptyStats);
    }

    /**
     * Reset update conditions for a table
     * @param {string} tableName - Name of the table
     */
    resetUpdateConditions(tableName) {
        this.initializeTable(tableName);
        const stats = this.operationStats.get(tableName);
        stats.lastDeleteTime = null;
        stats.lastInsertTime = null;
        stats.lastUpdateTime = null;
        this.operationStats.set(tableName, stats);
        logger.info(`[Cache] Reset update conditions for ${tableName}`);
    }

    /**
     * Clear memory cache for all tables or a specific table
     * @param {string} [tableName] - Optional table name to clear specific cache
     */
    clearMemoryCache(tableName) {
        if (tableName) {
            this.memoryCache.delete(tableName);
            logger.info(`[Cache] Memory cache cleared for ${tableName}`);
        } else {
            this.memoryCache.clear();
            logger.info('[Cache] All memory cache cleared');
        }
    }

    /**
     * Get cache for a table
     * @param {string} tableName - Name of the table
     * @returns {Array|null} Cached data or null
     */
    getCache(tableName) {
        return this.memoryCache.get(tableName);
    }

    /**
     * Set cache for a table
     * @param {string} tableName - Name of the table
     * @param {Array} data - Data to cache
     */
    setCache(tableName, data) {
        this.memoryCache.set(tableName, data);
        logger.info(`[Cache] Cache set for ${tableName}`);
    }
}

// Create singleton instance
const cacheCoordinator = new CacheCoordinator();

module.exports = {
    cacheCoordinator,
    recordOperation: (operationType, tableName) => cacheCoordinator.recordOperation(operationType, tableName),
    getOperationStats: (tableName) => cacheCoordinator.getOperationStats(tableName),
    resetOperationStats: (tableName) => cacheCoordinator.resetOperationStats(tableName),
    clearMemoryCache: (tableName) => cacheCoordinator.clearMemoryCache(tableName),
    getCache: (tableName) => cacheCoordinator.getCache(tableName),
    setCache: (tableName, data) => cacheCoordinator.setCache(tableName, data),
    needsCacheUpdate: (tableName, ignoreChanges) => cacheCoordinator.needsCacheUpdate(tableName, ignoreChanges),
    resetUpdateConditions: (tableName) => cacheCoordinator.resetUpdateConditions(tableName)
}; 