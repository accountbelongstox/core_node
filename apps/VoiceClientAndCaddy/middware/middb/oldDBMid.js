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

const { getProviderOldData, } = require('../../provider/DataProvider.js');
const { dbInsertBulk, dbInsert, dbQueryCount, dbQuery } = require('#@dbtools');
const logger = require('#@logger');
async function initData(dbIndex=0) {
    const providerData = await getProviderOldData();
    if(dbIndex == undefined) {
        dbIndex = 0;
    }
    const sequelize = providerData[dbIndex].sequelize;
    const wordModel = providerData[dbIndex].wordModel;
    const close = providerData[dbIndex].close;
    const dataPath = providerData[dbIndex].dataPath;
    const tableModels = providerData[dbIndex].tableModels;
    const dataName = providerData[dbIndex].dataName;
    return {
        sequelize,
        wordModel,
        close,
        dataPath,
        tableModels,
        dataName
    }
}

async function getOldDbLength() {
    const providerData = await getProviderOldData();
    return providerData.length;
}

async function getOldDBContentCount(dbIndex=0) {
    const {sequelize, wordModel} = await initData(dbIndex);
    const result = await dbQueryCount(sequelize, { model: wordModel });
    return result;
}

async function insertDoneToken(dbIndex=0) {
    const {sequelize, wordModel} = await initData(dbIndex);
    const result = await dbInsert(sequelize, {
        model: wordModel,
        data: {
            done: true,
            done_at: new Date()
        }
    });
    if (result) {
        return result;
    }
}

async function insertTransArray(transArray, dbIndex=0) {
    const {sequelize, wordModel} = await initData(dbIndex);
    await dbInsertBulk(sequelize, {
        model: wordModel,
        data: transArray
    });
}
async function getAllContentOldData(dbIndex=0) {
    const {sequelize, wordModel,dataName} = await initData(dbIndex);
    logger.debug(`getAllContentOldData ${dataName}`);
    const result = await dbQuery(sequelize, {
        model: wordModel,
        attributes: ['content']
    });
    if (result && result.length > 0) {
        return result.map(item => item.content);
    }
    return [];
}
async function getRecordsFromOldData(contentsArray, dbIndex=0) {
    const {sequelize, wordModel} = await initData(dbIndex);
    const result = await dbQuery(sequelize, {
        model: wordModel,
        where: { content: { $in: contentsArray } }
    });
    if (result && result.length > 0) {
        return result;
    }
    return [];
}

async function getOldDBRecords(offset, batchSize, dbIndex=0) {
    const {sequelize, wordModel} = await initData(dbIndex);
    const options = {
        model: wordModel,
    }
    if(batchSize) {
        options.limit = batchSize;
    }
    if(offset) {
        options.offset = offset;
    }
    const result = await dbQuery(sequelize, options);
    return result;
}

async function closeAllOldDB() {
    const providerData = await getProviderOldData();
    for(const oldDb of providerData) {
        try {
            const dbName = oldDb.dataName;
            await oldDb.close();
            logger.debug(`Old db closed ${dbName}`);
        } catch (error) {
            logger.error(`Error closing old db ${dbName}:`, error);
        }
    }
}
module.exports = {
    insertDoneToken,
    insertTransArray,
    getAllContentOldData,
    getRecordsFromOldData,
    getOldDBContentCount,
    getOldDBRecords,
    getOldDbLength,
    closeAllOldDB,
    initData
}
