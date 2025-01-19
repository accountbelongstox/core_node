const logger = require('#@logger');
const { ITEM_TYPE, detectContentTypeAndDbModel, getDbModelByItemType } = require('../db-tools/db_utils.js');
const { ensureQueueItem } = require('../../provider/types/index.js');
const { ensureInitialized, getModels } = require('../init/db_init.js');
const { cleanWord } = require('#@/ncore/utils/tool/libs/strtool.js');
const { validateAndSetDefaults } = require('../db-tools/db_utils.js');
const { cacheCoordinator } = require('../db-tools/cache_coordinator.js');


async function insertContent(contentOrObject, rawItemType) {
    await ensureInitialized();
    const models = getModels();
    let data, model;
    if (typeof contentOrObject == "string") {
        const itemQueueItem = ensureQueueItem(contentOrObject, rawItemType);
        model = detectContentTypeAndDbModel(itemQueueItem, models);
        data = validateAndSetDefaults({...itemQueueItem});
    } else {
        data = validateAndSetDefaults(contentOrObject);
        model = getDbModelByItemType(rawItemType, models);
    }
    try {
        const result = await model.create(data);
        cacheCoordinator.recordOperation('insert', rawItemType);
        const resultData = {
            content: data.content,
            id: result.id
        }
        return resultData;
    } catch (error) {
        logger.error(error);
        console.log(data);
        logger.error(`<--------------------------------------`);
        return null;
    }
}

/**
 * Process a chunk of content with transaction
 * @param {Array} chunk - Array of content to insert
 * @param {string} rawItemType - Type of content
 * @param {Object} model - Sequelize model
 * @returns {Promise<Array>} Array of successfully inserted items
 */
async function processChunkWithTransaction(chunk, rawItemType, model) {
    const transaction = await model.sequelize.transaction();
    try {
        const results = await Promise.all(chunk.map(async (contentOrObject) => {
            let data;
            if (typeof contentOrObject === "string") {
                const itemQueueItem = ensureQueueItem(contentOrObject, rawItemType);
                data = validateAndSetDefaults({...itemQueueItem});
            } else {
                data = validateAndSetDefaults(contentOrObject);
            }
            return await model.create(data, { transaction });
        }));

        await transaction.commit();
        cacheCoordinator.recordOperation('insert', rawItemType);
        return results.map(result => ({
            content: result.content,
            id: result.id
        }));
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * Determine appropriate chunk size based on array length
 * @param {number} length - Length of array
 * @returns {number} Appropriate chunk size
 */
function determineChunkSize(length) {
    if (length > 1000) return 1000;
    if (length > 100) return 100;
    return length;
}

/**
 * Recursively process content array with dynamic chunk sizes
 * @param {Array} contentArray - Array of content to insert
 * @param {string} rawItemType - Type of content
 * @param {Object} model - Sequelize model
 * @returns {Promise<Array>} Array of successfully inserted items
 */
async function processContentArrayRecursively(contentArray, rawItemType, model) {
    // Base case: empty array
    if (!contentArray.length) {
        return [];
    }

    // Base case: single item
    if (contentArray.length === 1) {
        const result = await insertContent(contentArray[0], rawItemType);
        return result ? [result] : [];
    }

    const chunkSize = determineChunkSize(contentArray.length);
    const results = [];

    // Split array into chunks
    for (let i = 0; i < contentArray.length; i += chunkSize) {
        const chunk = contentArray.slice(i, i + chunkSize);
        try {
            // Try to process current chunk with transaction
            const chunkResults = await processChunkWithTransaction(chunk, rawItemType, model);
            results.push(...chunkResults);
        } catch (error) {
            logger.warn(`Chunk insertion failed (size: ${chunk.length}), splitting into smaller chunks: ${error.message}`);
            
            if (chunk.length <= 100) {
                // If chunk is small enough, fall back to individual inserts
                logger.warn(`Processing ${chunk.length} items individually`);
                for (const item of chunk) {
                    const result = await insertContent(item, rawItemType);
                    if (result) {
                        results.push(result);
                    }
                }
            } else {
                // Recursively process smaller chunks
                const newChunkSize = determineChunkSize(chunk.length / 2);
                const subChunks = [];
                for (let j = 0; j < chunk.length; j += newChunkSize) {
                    subChunks.push(chunk.slice(j, j + newChunkSize));
                }
                
                for (const subChunk of subChunks) {
                    const subResults = await processContentArrayRecursively(subChunk, rawItemType, model);
                    results.push(...subResults);
                }
            }
        }
    }

    return results;
}

/**
 * Insert an array of content items with recursive retry
 * @param {Array} contentArray - Array of content to insert
 * @param {string} rawItemType - Type of content
 * @returns {Promise<Array>} Array of successfully inserted items
 */
async function insertContentArrayWithRetry(contentArray, rawItemType) {
    if (!Array.isArray(contentArray) || contentArray.length === 0) {
        return [];
    }

    await ensureInitialized();
    const models = getModels();

    try {
        const firstItem = contentArray[0];
        let model;
        if (typeof firstItem === "string") {
            const itemQueueItem = ensureQueueItem(firstItem, rawItemType);
            model = detectContentTypeAndDbModel(itemQueueItem, models);
        } else {
            model = getDbModelByItemType(rawItemType, models);
        }

        return await processContentArrayRecursively(contentArray, rawItemType, model);
    } catch (error) {
        logger.error(`Failed to process content array: ${error.message}`);
        return [];
    }
}

// Keep the original insertContentArray implementation
async function insertContentArray(contentArray, rawItemType) {
    if (!Array.isArray(contentArray) || contentArray.length === 0) {
        return [];
    }
    await ensureInitialized();
    const models = getModels();
    try {
        const firstItem = contentArray[0];
        let model;
        if (typeof firstItem === "string") {
            const itemQueueItem = ensureQueueItem(firstItem, rawItemType);
            model = detectContentTypeAndDbModel(itemQueueItem, models);
        } else {
            model = getDbModelByItemType(rawItemType, models);
        }

        const transaction = await model.sequelize.transaction();

        try {
            const results = await Promise.all(contentArray.map(async (contentOrObject) => {
                let data;
                if (typeof contentOrObject === "string") {
                    const itemQueueItem = ensureQueueItem(contentOrObject, rawItemType);
                    data = validateAndSetDefaults({...itemQueueItem});
                } else {
                    data = validateAndSetDefaults(contentOrObject);
                }
                const result = await model.create(data, { transaction });
                return result;
            }));

            await transaction.commit();
            cacheCoordinator.recordOperation('insert', rawItemType);
            const resultData = results.map(result => ({
                content: result.content,
                id: result.id
            }));
            return resultData;
        } catch (error) {
            await transaction.rollback();
            logger.warn(`Transaction failed, falling back to individual inserts: ${error.message}`);
            const results = [];
            for (const item of contentArray) {
                const resultData = await insertContent(item, rawItemType);
                if (resultData) {
                    results.push(resultData);
                }
            }
            return results;
        }
    } catch (error) {
        logger.error(`Failed to process content array: ${error.message}`);
        return [];
    }
}

module.exports = {
    insertContent,
    insertContentArray,
    insertContentArrayWithRetry
};

