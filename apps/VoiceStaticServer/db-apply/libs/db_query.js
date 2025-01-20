const { Op } = require('sequelize');
const logger = require('#@logger');
const { ITEM_TYPE, detectContentTypeAndDbModel, getDbModelByItemType } = require('../db-tools/db_utils.js');
const { ensureQueueItem } = require('../../provider/types/index.js');
const { ensureInitialized, getModels } = require('../init/db_init.js');
const { cacheCoordinator } = require('../db-tools/cache_coordinator.js');

async function getContentByMd5(md5) {
    await ensureInitialized();
    const models = getModels();
    const types = ['word', 'sentence'];
    for (const type of types) {
        const result = await models[type].findOne({
            where: { md5 },
            attributes: ['content']
        });

        if (result) {
            const itemType = type === 'word' ? ITEM_TYPE.WORD : ITEM_TYPE.SENTENCE;
            cacheCoordinator.recordOperation('query', itemType);
            return {
                content: result.content,
                type: type
            };
        }
    }
    return null;
}

/**
 * Enhanced getContent function with flexible query conditions
 * @param {string|object} contentOrObject - Content string or query conditions
 * @param {string} rawItemType - Type of content (word/sentence)
 * @param {object} options - Additional query options
 * @returns {Promise<Array>} Query results
 * 
 * Example usage:
 * 1. Simple content query:
 *    getContent("hello", ITEM_TYPE.WORD)
 * 
 * 2. Multiple exact matches:
 *    getContent({ content: ["hello", "world"] }, ITEM_TYPE.WORD)
 * 
 * 3. Like query:
 *    getContent({ content: { like: "%hello%" } }, ITEM_TYPE.WORD)
 * 
 * 4. Range query:
 *    getContent({ 
 *      last_modified: { 
 *        between: [startTime, endTime] 
 *      }
 *    }, ITEM_TYPE.WORD)
 * 
 * 5. Complex conditions:
 *    getContent({
 *      content: { like: "%hello%" },
 *      last_modified: { gt: timestamp },
 *      voice_files: { not: null }
 *    }, ITEM_TYPE.WORD)
 * 
 * 6. Pagination:
 *    getContent("hello", ITEM_TYPE.WORD, { limit: 10, offset: 0 })
 */
async function getContent(contentOrObject, rawItemType, options = {}) {
    if (!rawItemType) {
        logger.error('rawItemType is required for getContent');
        return [];
    }

    await ensureInitialized();
    const models = getModels();
    const model = getDbModelByItemType(rawItemType, models);

    try {
        let where = {};

        // Handle different types of content queries
        if (typeof contentOrObject === 'string') {
            where.content = contentOrObject;
        } else if (typeof contentOrObject === 'object') {
            // Process each field in the query object
            for (const [field, condition] of Object.entries(contentOrObject)) {
                if (typeof condition === 'object' && !Array.isArray(condition)) {
                    // Handle special operators
                    const processedCondition = {};
                    for (const [op, value] of Object.entries(condition)) {
                        switch (op.toLowerCase()) {
                            case 'like':
                                processedCondition[Op.like] = value;
                                break;
                            case 'between':
                                processedCondition[Op.between] = value;
                                break;
                            case 'in': // in
                                processedCondition[Op.in] = value;
                                break;
                            case 'gt': // greater than
                                processedCondition[Op.gt] = value;
                                break;
                            case 'gte': // greater than or equal to
                                processedCondition[Op.gte] = value;
                                break;
                            case 'lt': // less than
                                processedCondition[Op.lt] = value;
                                break;
                            case 'lte': // less than or equal to
                                processedCondition[Op.lte] = value;
                                break;
                            case 'not': // not
                                processedCondition[Op.not] = value;
                                break;
                            default:
                                processedCondition[op] = value;
                        }
                    }
                    where[field] = processedCondition;
                } else if (Array.isArray(condition)) {
                    // Handle array of values as IN condition
                    where[field] = { [Op.in]: condition };
                } else {
                    // Simple equality condition
                    where[field] = condition;
                }
            }
        }

        const queryOptions = {
            where,
            ...options
        };

        const results = await model.findAll(queryOptions);

        if (results.length > 0) {
            cacheCoordinator.recordOperation('query', rawItemType);
        }

        return results;
    } catch (error) {
        logger.error(`Failed to get content: ${error.message}`);
        return [];
    }
}

async function getWordsByDB(start = 0, end = null) {
    await ensureInitialized();
    const models = getModels();
    try {
        const query = {
            // attributes: ['id', 'content', 'md5'],
            offset: start,
            order: [['id', 'ASC']],
            raw: true
        };

        if (end !== null) {
            query.limit = end - start;
        }

        const results = await models.word.findAll(query);
        if (results.length > 0) {
            cacheCoordinator.recordOperation('query', ITEM_TYPE.WORD);
        }
        return results;
    } catch (error) {
        logger.error(`Failed to get all words: ${error.message}`);
        return [];
    }
}

async function getSentencesByDB(start = 0, end = null) {
    await ensureInitialized();
    const models = getModels();
    try {
        const query = {
            // attributes: ['id', 'content', 'md5'],
            offset: start,
            order: [['id', 'ASC']],
            raw: true
        };

        if (end !== null) {
            query.limit = end - start;
        }

        const results = await models.sentence.findAll(query);
        if (results.length > 0) {
            cacheCoordinator.recordOperation('query', ITEM_TYPE.SENTENCE);
        }
        return results;
    } catch (error) {
        logger.error(`Failed to get all sentences: ${error.message}`);
        return [];
    }
}

async function getContentCount(itemType) {
    await ensureInitialized();
    const models = getModels();
    const model = getDbModelByItemType(itemType, models);
    if (!model) {
        logger.error(`Invalid content type: ${itemType}`);
        return 0;
    }

    try {
        const count = await model.count();
        if (count > 0) {
            cacheCoordinator.recordOperation('query', itemType);
        }
        return count;
    } catch (error) {
        logger.error(`Failed to get content count: ${error.message}`);
        return 0;
    }
}

module.exports = {
    getContentByMd5,
    getContent,
    getWordsByDB,
    getSentencesByDB,
    getContentCount
}; 