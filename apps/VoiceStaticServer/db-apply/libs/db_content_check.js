const logger = require('#@logger');
const { getDbModelByItemType } = require('../db-tools/db_utils.js');
const { ensureInitialized, getModels } = require('../init/db_init.js');
const { ITEM_TYPE, ensureQueueItem } = require('../../provider/types/index.js');
const logSpacename = 'db_check';

const { getWordsByDB, getSentencesByDB } = require('./db_query.js');
const { cacheCoordinator } = require('../db-tools/cache_coordinator.js');

// Cache hit counters
const cacheStats = {
    [ITEM_TYPE.WORD]: {
        hitCount: 0,
        cleanupTimer: null,
        lastLogTime: 0
    },
    [ITEM_TYPE.SENTENCE]: {
        hitCount: 0,
        cleanupTimer: null,
        lastLogTime: 0
    }
};

const CACHE_CLEANUP_DELAY = 120000; // 120 seconds

function setupCleanupTimer(type) {
    if (cacheStats[type].cleanupTimer) {
        clearTimeout(cacheStats[type].cleanupTimer);
    }
    
    cacheStats[type].cleanupTimer = setTimeout(() => {
        const cache = cacheCoordinator.getCache(type);
        if (cache) {
            const typeName = type === ITEM_TYPE.WORD ? 'Word' : 'Sentence';
            logger.info(`[Cache][${typeName}] Clearing cache after 120s inactivity | Total hits: ${cacheStats[type].hitCount}`);
            cacheCoordinator.setCache(type, null);
            cacheStats[type].hitCount = 0;
        }
    }, CACHE_CLEANUP_DELAY);
}

/**
 * Ensure memory cache is loaded and up-to-date for the specified type
 * @param {string} type - Type of content (word/sentence)
 * @param {boolean} ignoreChanges - Whether to ignore cache updates from operations
 */
async function ensureMemoryCache(type, ignoreChanges = false) {
    if (cacheCoordinator.needsCacheUpdate(type, ignoreChanges)) {
        const startTime = Date.now();
        const typeName = type === ITEM_TYPE.WORD ? 'Word' : 'Sentence';
        try {
            let items;
            if (type === ITEM_TYPE.WORD) {
                items = await getWordsByDB();
            } else if (type === ITEM_TYPE.SENTENCE) {
                items = await getSentencesByDB();
            }

            // Create a Map with content as key and full item as value
            const cacheMap = new Map(items.map(item => [item.content, item]));
            cacheCoordinator.setCache(type, cacheMap);
            
            logger.success(`[Cache][${typeName}] Initial cache load | Items: ${cacheMap.size} | Time: ${Date.now() - startTime}ms`);
            setupCleanupTimer(type);
        } catch (error) {
            logger.error(`[Cache][${typeName}] Failed to load cache: ${error.message}`);
        }
    }
}

/**
 * Check content existence directly in database without using cache
 * @param {string} content - Content to check
 * @param {string} type - Type of content (word/sentence)
 * @returns {Promise<boolean>} Whether content exists
 */
async function hasContentInDb(content, type) {
    const itemQueueItem = ensureQueueItem(content, type);
    await ensureInitialized();
    const models = getModels();
    const model = getDbModelByItemType(type, models);
    
    try {
        const result = await model.findOne({
            where: { content: itemQueueItem.content },
            attributes: ['id']
        });
        return !!result;
    } catch (error) {
        logger.error(`Failed to check content existence in DB: ${error.message}`);
        return false;
    }
}

/**
 * Check content existence in cache with optional property check
 * @param {string} content - Content to check
 * @param {string} type - Type of content (word/sentence)
 * @param {Object} [propertyCheck] - Optional property check criteria
 * @param {boolean} ignoreChanges - Whether to ignore cache updates
 * @returns {Promise<boolean>} Whether content exists and matches criteria
 */
async function hasContentInCache(content, type, propertyCheck = null, ignoreChanges = false) {
    await ensureMemoryCache(type, ignoreChanges);
    const cache = cacheCoordinator.getCache(type);
    
    if (!cache) {
        return false;
    }

    const item = cache.get(content);
    if (!item) {
        return false;
    }

    // If propertyCheck is provided, verify the properties
    if (propertyCheck) {
        return Object.entries(propertyCheck).every(([key, value]) => {
            if (typeof value === 'function') {
                return value(item[key]);
            }
            return item[key] === value;
        });
    }

    cacheStats[type].hitCount++;
    setupCleanupTimer(type);
    return true;
}

/**
 * Get cached item by content
 * @param {string} content - Content to retrieve
 * @param {string} type - Type of content (word/sentence)
 * @param {boolean} ignoreChanges - Whether to ignore cache updates
 * @returns {Promise<Object|null>} The cached item or null if not found
 */
async function getCachedItem(content, type, ignoreChanges = false) {
    await ensureMemoryCache(type, ignoreChanges);
    const cache = cacheCoordinator.getCache(type);
    
    if (!cache) {
        return null;
    }

    const item = cache.get(content);
    if (item) {
        cacheStats[type].hitCount++;
        setupCleanupTimer(type);
    }
    return item || null;
}

/**
 * Check content existence with optional property verification
 * @param {string} content - Content to check
 * @param {string} type - Type of content (word/sentence)
 * @param {Object} [propertyCheck] - Optional property check criteria
 * @param {boolean} useCache - Whether to use cache
 * @param {boolean} ignoreChanges - Whether to ignore cache updates
 * @returns {Promise<boolean>} Whether content exists and matches criteria
 */
async function hasContent(content, type, propertyCheck = null, useCache = true, ignoreChanges = false) {
    if (useCache) {
        const exists = await hasContentInCache(content, type, propertyCheck, ignoreChanges);
        if (exists) {
            return true;
        }
    }
    return await hasContentInDb(content, type);
}

/**
 * Clear cache for specified type
 * @param {string} type - Type of content (word/sentence)
 */
function clearCache(type) {
    const typeName = type === ITEM_TYPE.WORD ? 'Word' : 'Sentence';
    if (cacheStats[type].cleanupTimer) {
        clearTimeout(cacheStats[type].cleanupTimer);
        cacheStats[type].cleanupTimer = null;
    }
    cacheCoordinator.setCache(type, null);
    cacheStats[type].hitCount = 0;
    logger.info(`[Cache][${typeName}] Cache cleared manually`);
}

/**
 * Force refresh cache for specified type
 * @param {string} type - Type of content (word/sentence)
 * @returns {Promise<void>}
 */
async function forceRefreshCache(type) {
    const typeName = type === ITEM_TYPE.WORD ? 'Word' : 'Sentence';
    const startTime = Date.now();
    
    try {
        // Clear existing cache first
        clearCache(type);
        
        // Load fresh data
        let items;
        if (type === ITEM_TYPE.WORD) {
            items = await getWordsByDB();
        } else if (type === ITEM_TYPE.SENTENCE) {
            items = await getSentencesByDB();
        }

        // Create a new Map with content as key and full item as value
        const cacheMap = new Map(items.map(item => [item.content, item]));
        cacheCoordinator.setCache(type, cacheMap);
        
        logger.success(`[Cache][${typeName}] Force refresh completed | Items: ${cacheMap.size} | Time: ${Date.now() - startTime}ms`);
        setupCleanupTimer(type);
    } catch (error) {
        logger.error(`[Cache][${typeName}] Force refresh failed: ${error.message}`);
        throw error; // Re-throw to allow caller to handle the error
    }
}

module.exports = {
    hasContent,
    hasContentInDb,
    hasContentInCache,
    getCachedItem,
    ensureMemoryCache,
    clearCache,
    forceRefreshCache
}; 