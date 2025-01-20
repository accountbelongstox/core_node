const logger = require('#@logger');
const { sequelize_init_tables } = require('../../provider/types/index.js');
const logSpacename = 'DB-Utils';
const tableMaps = sequelize_init_tables.contents

function validateAndSetDefaults(obj) {
    // return obj
    const result = {};
    const validKeys = new Set(Object.keys(tableMaps));
    
    // // Check for unknown fields and remove them
    Object.keys(obj).forEach(key => {
        if (!validKeys.has(key)) {
            logger.interval(`Unknown field will be removed: ${key}`, 10, logSpacename, 'warn');
        } else {
            result[key] = obj[key];
        }
    });

    // Add missing timestamp fields
    const currentTime = Math.floor(Date.now() / 1000);  // Unix timestamp in seconds
    if (!result.hasOwnProperty('last_modified')) {
        result.last_modified = currentTime;
    }
    if (!result.hasOwnProperty('created_at')) {
        result.created_at = currentTime;
    }
    return result;
}

const ITEM_TYPE = {
    WORD: 'word',
    SENTENCE: 'sentence'
};

function detectContentTypeAndDbModel(itemQueueItem,models) {
    const model_name = itemQueueItem.type == ITEM_TYPE.WORD ? 'word' : 'sentence';
    const model = models[model_name];
    return model;
}

function getDbModelByItemType(itemType,models) {
    const model_name = itemType == ITEM_TYPE.WORD ? 'word' : 'sentence';
    const model = models[model_name];
    return model;
}


module.exports = {
    ITEM_TYPE,
    detectContentTypeAndDbModel,
    getDbModelByItemType,
    validateAndSetDefaults
};
