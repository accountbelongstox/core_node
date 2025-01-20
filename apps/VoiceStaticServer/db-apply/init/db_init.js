const { getDatabase } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const logger = require('#@logger');
const { sequelize_init_tables } = require('../../provider/types/index.js');

const dbs = {};
const models = {};
let isInitialized = false;
let debugPrint = false;
const options = { printStructure: true }

async function initialize() {
    if (isInitialized) return;

    try {
        const { sequelize: word_sequelize, model: word_model } = await getDatabase('word_content', sequelize_init_tables, options);
        dbs.word = word_sequelize;
        models.word = word_model;

        const { sequelize: sentence_sequelize, model: sentence_model } = await getDatabase('sentence_content', sequelize_init_tables, options);
        dbs.sentence = sentence_sequelize;
        models.sentence = sentence_model;

        isInitialized = true;
        logger.success('Database tables synchronized successfully');
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