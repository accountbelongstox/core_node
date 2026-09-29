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
