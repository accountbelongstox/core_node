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

const { getProviderWordData:GetProviDB,cleanDBProvideCache, getProviderOldData:GetProviOldDB } = require('../../provider/DataProvider.js');
const { dbInsertBulk, dbInsert, dbQuery } = require('#@dbtools');
const { fpath } = require('#@btools');
const logger = require('#@logger');
const prefix = 'CacheDbDone';


async function getCacheDbName(cache_db_name) {
    const providerOldData = await GetProviOldDB();
    if(typeof cache_db_name === 'object'){
        cache_db_name = cache_db_name.dataName;
        logger.debug(`setCacheDbDoneToken ${cache_db_name}`);
    }else if(typeof cache_db_name === 'number'){
        cache_db_name = providerOldData[cache_db_name].dataName;
        logger.debug(`setCacheDbDoneToken ${cache_db_name}`);
    }
    logger.info(`cache_db_name ${cache_db_name}`);
    cache_db_name = fpath.getBasenameWithoutExt(cache_db_name);
    return cache_db_name;
}

async function setCacheDbDoneToken(cache_db_name, isDone = false) {
    const {sequelize,wordCacheDoneModel} = await GetProviDB();
    cache_db_name = await getCacheDbName(cache_db_name);
    const result = await dbInsert(sequelize, {
        model: wordCacheDoneModel,
        data: {
            cache_db_name,
            done: isDone,
            createdAt: new Date()
        },
        prefix: prefix
    });
    if (result) {
        return result;
    }
}
async function checkCacheDbDone(cache_db_name) {
    const {sequelize,wordCacheDoneModel} = await GetProviDB();
    cache_db_name = await getCacheDbName(cache_db_name);
    const result = await dbQuery(sequelize, {
        model: wordCacheDoneModel,
        where: { cache_db_name, done: true },
        prefix: prefix
    });
    if (result && result.length > 0) {
        return result[0];
    }
    return false;
}
async function closeCacheDbDone(providerDataObject) {
    let close
    if(providerDataObject){
        close = providerDataObject.close;
        const dataName = providerDataObject.dataName;
        await cleanDBProvideCache(dataName);
    }
    try {
        if(close){
            await close();
            logger.debug('CacheDbDone closed');
        }else{
            logger.debug('CacheDbDone not closed');
        }
    } catch (error) {
        logger.error('CacheDbDone close failed', error);
    }
}
module.exports = {
    setCacheDbDoneToken,
    checkCacheDbDone,
    closeCacheDbDone
}
