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

const { getProviderCacheTransData:GetProviDB } = require('../../provider/DataProvider.js');
const { dbInsertBulk, dbInsert, dbQuery } = require('#@dbtools');
const logger = require('#@logger');
const prefix = 'TransCache';
async function insertTransArray(transArray) {
    const {sequelize,wordModel} = await GetProviDB();
    const result = await dbInsertBulk(sequelize, {
        prefix: prefix,
        model: wordModel,
        data: transArray
    });
    return result;
}
async function getAllContentOldData() {
    const {sequelize,wordModel} = await GetProviDB();
    const result = await dbQuery(sequelize, {
        model: wordModel,
        where: { done: false },
        attributes: ['content'],
        prefix: prefix
    });
    if (result && result.length > 0) {
        return result.map(item => item.content);
    }
    return [];
}
async function getRecordsFromCacheTransData(contentsArray) {
    const {sequelize,wordModel} = await GetProviDB();
    const result = await dbQuery(sequelize, {
        model: wordModel,
        prefix: prefix,
        where: {
            content: { $in: contentsArray },
        }
    });
    if (result && result.length > 0) {
        return result;
    }
    return [];
}
async function closeCacheTransData() {
    const {close} = await GetProviDB();
    try {
        await close();
    } catch (error) {
        logger.error('Error closing cache trans data:', error);
    }
}
module.exports = {
    insertTransArray,
    getAllContentOldData,
    getRecordsFromCacheTransData,
    closeCacheTransData
}
