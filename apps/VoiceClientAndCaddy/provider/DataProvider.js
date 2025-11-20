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

const { getDatabase,destroyDatabase } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const {
    cache_translate_schema,
    word_main_schema,
    old_tradata_schema,
} = require('./schemas/index.js');
const { fdir, fpath } = require('#@btools');
const path = require('path');
const logger = require('#@logger');
const { OLD_DB_DIR, DATA_DIR } = require('./baseDir/BaseDirProvider.js');
const gconfig = require('#@gconfig');
const {
    DictionariesTableName,
    CacheDbDoneTableName
} = require('./types/data_table_names.js');
const initMaps = {};

async function cleanDBProvideCache(dataName) {
    dataName = fpath.getBasenameWithoutExt(dataName);
    if (initMaps[dataName]) {
        await destroyDatabase(dataName)
        delete initMaps[dataName];
    }
}

async function getPublicDatabase(dataName, dbDir, schema, variablePrefix = '') {
    if (dbDir && path.isAbsolute(dataName)) {
        dataName = fpath.getBasenameWithoutExt(dataName);
    }
    let dataPath = path.join(dbDir, dataName);
    dataPath = dataPath.endsWith('.db') ? dataPath : `${dataPath}.db`;
    if (initMaps[dataPath]) {
        logger.debug(`getPublicDatabase ${dataName} from initMaps`);
        return initMaps[dataPath];
    }
    const {
        sequelize,
        tableModels,
        close
    } = await getDatabase(dataPath, schema)
    const wordModel = tableModels[DictionariesTableName]
    if (!wordModel) {
        logger.warn(`${dataName} database not found ${DictionariesTableName}`);
        logger.warn(`    ${dataPath}`);
    }
    const result = {
        tableModels,
        sequelize,
        dataPath,
        dataName,
        wordModel,
        close
    }
    initMaps[dataPath] = result;
    return result
}


async function getProviderCacheTransData() {
    return getPublicDatabase(`cache_translate`, DATA_DIR, cache_translate_schema, 'cacheTrans')
}
async function getProviderOldData() {
    if (initMaps.oldData) {
        return initMaps.oldData
    }
    const oldDbFiles = fdir.scanDirectory(OLD_DB_DIR, {
        onlyFiles: true,
        extensions: ['db']
    })
    const olddataresult = []
    for (const oldDbFile of oldDbFiles) {
        const db = await getPublicDatabase(oldDbFile, OLD_DB_DIR, old_tradata_schema, 'OldTraData')
        olddataresult.push(db)
    }
    initMaps.oldData = olddataresult
    return olddataresult
}
async function getProviderWordData() {
    const result = await getPublicDatabase(`main_words`, DATA_DIR, word_main_schema, 'word', `MainWord`)
    return {
        ...result,
        wordCacheDoneModel: result.tableModels[CacheDbDoneTableName]
    }
}
module.exports = {
    getProviderOldData,
    getProviderWordData,
    getProviderCacheTransData,
    cleanDBProvideCache
}