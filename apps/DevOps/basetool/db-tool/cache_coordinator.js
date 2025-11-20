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

const logger = require('#@logger');
const { ITEM_TYPE } = require(`../../provider/types/data_types.js`)

class CacheCoordinator {
    constructor() {
        this.memoryCache = {
            words: null,
            sentences: null,
        };
        
        // Maintain separate operation statistics for words and sentences
        this.operationStats = {
            [ITEM_TYPE.WORD]: {
                lastDeleteTime: null,
                lastInsertTime: null,
                lastUpdateTime: null,
                lastQueryTime: null,
                deleteCount: 0,
                insertCount: 0,
                updateCount: 0,
                queryCount: 0,
                hasOperations: false
            },
            [ITEM_TYPE.SENTENCE]: {
                lastDeleteTime: null,
                lastInsertTime: null,
                lastUpdateTime: null,
                lastQueryTime: null,
                deleteCount: 0,
                insertCount: 0,
                updateCount: 0,
                queryCount: 0,
                hasOperations: false
            }
        };
        
        this.subscribers = new Set();
    }

    /**
     * Check if cache needs update based on item type
     * @param {string} itemType - Type of content (word/sentence)
     * @returns {boolean} - True if cache needs update, false otherwise
     */
    needsCacheUpdate(itemType,ignoreChanges=false) {
        const stats = this.operationStats[itemType];
        if (!stats) {
            logger.warn(`Invalid item type for cache check: ${itemType}`);
            return true; // If invalid type, better to update cache
        }
        const cache = itemType === ITEM_TYPE.WORD ? this.memoryCache.words : this.memoryCache.sentences;
        if(ignoreChanges && cache){
            return false;
        }
        if (!cache) {
            return true;
        }

        return !!(stats.lastDeleteTime || stats.lastInsertTime);
    }

    /**
     * Reset update conditions for specified item type
     * @param {string} itemType - Type of content (word/sentence)
     */
    resetUpdateConditions(itemType) {
        const stats = this.operationStats[itemType];
        if (!stats) {
            logger.warn(`Invalid item type for resetting update conditions: ${itemType}`);
            return;
        }

        stats.lastDeleteTime = null;
        stats.lastInsertTime = null;
        logger.info(`[Cache] Reset update conditions for ${itemType}`);
    }

    recordOperation(operationType, itemType) {
        const stats = this.operationStats[itemType];
        if (!stats) {
            logger.warn(`Invalid item type for operation recording: ${itemType}`);
            return;
        }

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
    }

    getOperationStats(itemType) {
        if (itemType) {
            return { ...this.operationStats[itemType] };
        }
        return { ...this.operationStats };
    }

    resetOperationStats(itemType) {
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

        if (itemType) {
            this.operationStats[itemType] = { ...emptyStats };
        } else {
            this.operationStats = {
                [ITEM_TYPE.WORD]: { ...emptyStats },
                [ITEM_TYPE.SENTENCE]: { ...emptyStats }
            };
        }
    }

    clearMemoryCache() {
        this.memoryCache.words = null;
        this.memoryCache.sentences = null;
        logger.info('[Cache] Memory cache cleared');
    }

    async resetMemoryCache() {
        this.memoryCache.words = null;
        this.memoryCache.sentences = null;
        logger.info('[Cache] Memory cache manually reset');
    }

    getCache(type) {
        if (type === ITEM_TYPE.WORD) {
            return this.memoryCache.words;
        } else if (type === ITEM_TYPE.SENTENCE) {
            return this.memoryCache.sentences;
        }
        return this.memoryCache;
    }

    setCache(type, data) {
        if (type === ITEM_TYPE.WORD) {
            this.memoryCache.words = data;
        } else if (type === ITEM_TYPE.SENTENCE) {
            this.memoryCache.sentences = data;
        }
    }

    setIgnoreChanges(ignore) {
        this.memoryCache.ignoreChanges = ignore;
    }
}

// Create singleton instance
const cacheCoordinator = new CacheCoordinator();

module.exports = {
    cacheCoordinator,
    recordOperation: (operationType, itemType) => cacheCoordinator.recordOperation(operationType, itemType),
    getOperationStats: (itemType) => cacheCoordinator.getOperationStats(itemType),
    resetOperationStats: (itemType) => cacheCoordinator.resetOperationStats(itemType),
    resetMemoryCache: () => cacheCoordinator.resetMemoryCache(),
    getCache: (type) => cacheCoordinator.getCache(type),
    setCache: (type, data) => cacheCoordinator.setCache(type, data),
    setIgnoreChanges: (ignore) => cacheCoordinator.setIgnoreChanges(ignore),
    needsCacheUpdate: (itemType) => cacheCoordinator.needsCacheUpdate(itemType),
    resetUpdateConditions: (itemType) => cacheCoordinator.resetUpdateConditions(itemType)
}; 