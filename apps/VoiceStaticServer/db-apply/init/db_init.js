const { getDatabase } = require('#@/ncore/utils/db_tool/libs/sequelize_db.js');
const logger = require('#@logger');
const { defineModel } = require('../db-tools/db_utils.js');

const dbs = {};
const models = {};
let isInitialized = false;
let debugPrint = false;

async function initialize() {
    if (isInitialized) return;

    try {
        dbs.word = await getDatabase('word_content', debugPrint);
        models.word = await defineModel(dbs.word);

        dbs.sentence = await getDatabase('sentence_content', debugPrint);
        models.sentence = await defineModel(dbs.sentence);

        await models.word.sync();
        await models.sentence.sync();

        isInitialized = true;
    } catch (error) {
        logger.error('Failed to initialize databases:', error);
        return false;
    }
}

async function ensureInitialized() {
    if (!isInitialized) {
        await initialize();
    }
}

async function close() {
    if (!isInitialized) return;

    for (const db of Object.values(dbs)) {
        await db.close();
    }
    Object.keys(dbs).forEach(key => delete dbs[key]);
    Object.keys(models).forEach(key => delete models[key]);
    isInitialized = false;
}

function getModels() {
    return models;
}

module.exports = {
    initialize,
    ensureInitialized,
    close,
    getModels
}; 