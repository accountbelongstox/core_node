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
const { cacheCoordinator } = require('../../basetool/db-tool/cache_coordinator.js');
const { getProviderWordData, } = require('../../provider/DataProvider.js');
const {  dbQuery, dbQueryCount } = require('#@dbtools');
const {
    addToMainWordsSet, getMainWordsSetCountObject,
    showMainWordsSet,
} = require('../../provider/constants/WordCounter.js');

async function getAllContentByMainDB() {
    const { sequelize, wordModel } = await getProviderWordData();
    const result = await dbQuery(sequelize, {
        model: wordModel,
        attributes: ['content']
    });
    let allContent = [];
    if (result) {
        for (const item of result) {
            allContent.push(item.content);
        }
        return allContent;
    }
    return null;
}
async function getContent(wordOrMd5, isMd5 = false, multipleWords = false) {
    const { sequelize, wordModel } = await getProviderWordData();
    let where = {};
    if (multipleWords) {
        wordOrMd5 = typeof wordOrMd5 === 'string' ? wordOrMd5.split(',') : wordOrMd5;
        where = {
            content: {
                $in: wordOrMd5
            }
        };
    } else {
        where = isMd5 ? { md5: wordOrMd5 } : { content: wordOrMd5 };
    }
    const result = await dbQuery(sequelize, {
        model: wordModel,
        where: where
    });
    return result;
}
async function getContentFromMainDBByMd5(md5) {
    return await getContent(md5, true);
}
async function getContentFromMainDBByContent(content) {
    return await getContent(content, false);
}
async function getContentsFromMainDBByWordsArray(wordsArray) {
    return await getContent(wordsArray, false, true);
}

async function getAllLocalStaticByStatus(onlyGetContent = false, isExistLocal, offset = 0, limit = null) {
    const { sequelize, wordModel } = await getProviderWordData();
    const options = {
        model: wordModel,
        where: {
            isExistLocal
        }
    }
    if (onlyGetContent) {
        options.attributes = ['content'];
    }
    if (offset) {
        options.offset = offset;
    }
    if (limit) {
        options.limit = limit;
    }
    const result = await dbQuery(sequelize, options);
    return result;
}
async function getAllNotLocalStaticWordsOrRecords(onlyGetContent = false, start, end) {
    return await getAllLocalStaticByStatus(onlyGetContent, false, start, end);
}
async function getAllHasLocalStaticWordsOrRecords(onlyGetContent = false, start, end) {
    return await getAllLocalStaticByStatus(onlyGetContent, true, start, end);
}

async function getAllNotTranslateWords() {
    const { sequelize, wordModel } = await getProviderWordData();
    const result = await dbQuery(sequelize, {
        model: wordModel,
        // where: {
        //     isTranslation: false
        // },
        where: {
            translation: {
                $emptyJSON: true
            }
        }
    });
    return result;
}

async function getWordsByDB(start = 0, end = null) {
    const { sequelize, wordModel } = await getProviderWordData();
    try {
        const options = {
            // attributes: ['id', 'content', 'md5'],
            offset: start,
            order: [['id', 'ASC']],
            raw: true
        };

        if (end !== null) {
            options.limit = end - start;
        }
        const result = await dbQuery(sequelize, {
            model: wordModel,
            ...options
        });
        return result;
    } catch (error) {
        logger.error(`Failed to get all words: ${error.message}`);
        return [];
    }
}


async function getCountByMainDB() {
    const { sequelize, wordModel } = await getProviderWordData();
    const result = await dbQueryCount(sequelize, {
        model: wordModel
    });
    return result;
}

async function refreshWordRecords() {
    const allContent = await getAllContentByMainDB();
    allContent.forEach((content, index) => {
        addToMainWordsSet(content);
    });
    logger.success(`Refresh Server Main Words!`);
    const mainWordsSetCountObject = getMainWordsSetCountObject();
    for (const [key, value] of Object.entries(mainWordsSetCountObject)) {
        logger.success(`${key}: ${value}`);
    }
    showMainWordsSet();
    // logger.success(`Refresh Server Main Words Done!`);
}
module.exports = {
    refreshWordRecords,
    getContentFromMainDBByContent,
    getContentFromMainDBByMd5,
    getContentsFromMainDBByWordsArray,
    getAllNotLocalStaticWordsOrRecords,
    getAllHasLocalStaticWordsOrRecords,
    getWordsByDB,
    getCountByMainDB,
    getAllContentByMainDB,
    getAllNotTranslateWords,
}; 