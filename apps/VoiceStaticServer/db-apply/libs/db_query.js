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

async function getContent(contentOrObject, rawItemType) {
    await ensureInitialized();
    const models = getModels();
    let content, model;
    
    if (typeof contentOrObject === "string") {
        const itemQueueItem = ensureQueueItem(contentOrObject, rawItemType);
        rawItemType = itemQueueItem.type;
        model = detectContentTypeAndDbModel(itemQueueItem, models);
        content = itemQueueItem.content;
    } else {
        model = getDbModelByItemType(rawItemType, models);
        content = contentOrObject.content;
    }

    try {
        const result = await model.findOne({
            where: { content }
        });
        if (result) {
            cacheCoordinator.recordOperation('query', rawItemType);
        }
        return result;
    } catch (error) {
        logger.error(`Failed to get content: ${error.message}`);
        return null;
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