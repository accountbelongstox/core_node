const { getDatabase, DataTypes } = require('#@/ncore/utils/db_tool/libs/sequelize_db.js');
const logger = require('#@/ncore/utils/logger/index.js');
const dbs = {};
const models = {};
let isInitialized = false;
const { generateMd5 } = require('./string.js');

function defineModel(sequelize) {
    return sequelize.define('contents', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true
        },
        md5: {
            type: DataTypes.STRING(32),
            allowNull: false,
            unique: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        timestamps: false,
        freezeTableName: true
    });
}


async function initialize() {
    if (isInitialized) return;

    try {
        dbs.word = await getDatabase('word_content');
        models.word = await defineModel(dbs.word);

        dbs.sentence = await getDatabase('sentence_content');
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

async function getMd5(content, type) {
    await ensureInitialized();

    if (!models[type]) {
        logger.error(`Invalid content type: ${type}`);
        return null;
    }

    const result = await models[type].findOne({
        where: {
            content: content.toLowerCase().trim()
        },
        attributes: ['md5']
    });

    return result ? result.md5 : null;
}

async function getContentByMd5(md5) {
    await ensureInitialized();

    const types = ['word', 'sentence'];
    for (const type of types) {
        const result = await models[type].findOne({
            where: { md5 },
            attributes: ['content']
        });

        if (result) {
            return {
                content: result.content,
                type: type
            };
        }
    }
    return null;
}

async function addOrGetMd5(content, type) {
    await ensureInitialized();
    if (!models[type]) {
        logger.error(`Invalid content type: ${type}`);
        return null;
    }

    const existingMd5 = await getMd5(content, type);
    if (existingMd5) {
        return existingMd5;
    }

    const md5 = generateMd5(content, type);
    const normalizedContent = content.toLowerCase().trim();

    try {
        await models[type].create({
            content: normalizedContent,
            md5: md5
        });
        return md5;
    } catch (error) {
        logger.error(`Failed to create content record: ${error.message}`);
        return null;
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

module.exports = {
    initialize,
    getMd5,
    getContentByMd5,
    addOrGetMd5,
    close
};

