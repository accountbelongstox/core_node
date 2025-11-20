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

const { dbInsertBulk, dbInsert, dbQuery } = require('#@dbtools');
const { WORD_QUERY_CACHE_DIR } = require('../provider/baseDir/BaseDirProvider.js');
const { fpath, file, fwriter, strtool, freader } = require('#@btools');
const path = require('path');
const logger = require('#@logger');
const prefix = 'CacheMainMid';
const CACHE_EXPE5day = 1000 * 60 * 60 * 24 * 5;
const interval_print_seconds = 10;

function isFileExists(filePath) {
    return fs.existsSync(filePath);
}

function isExpired(filePathOrContent, md5) {
    let filePath = path.isAbsolute(filePathOrContent) ? filePathOrContent : generateCachePath(md5, filePathOrContent);
    if (!isFileExists(filePath)) {
        logger.interval(`${prefix} isExpired: ${filePath} not exists`, interval_print_seconds, `debug`);
        return true;
    }
    const modifyTime = getFileModifyTime(filePath);
    const now = Date.now();
    return now - modifyTime > CACHE_EXPE5day;
}

function generateCachePath(md5, content) {
    if (!md5) md5 = strtool.generateMd5(content);
    return path.join(WORD_QUERY_CACHE_DIR, `${md5}.json`);
}

async function putWordQueryCache(md5, content, data) {
    const cacheFile = generateCachePath(md5, content);
    if (!file.exists(cacheFile)) {
        await fwriter.saveCacheJSON(cacheFile, data, CACHE_EXPE5day);
    } else {
        if (isExpired(cacheFile)) {
            await fwriter.saveCacheJSON(cacheFile, data, CACHE_EXPE5day);
        }
    }
    logger.interval(`putWordQueryCache ${cacheFile}`, interval_print_seconds, `debug`);
}

async function queryWordQueryCache(content, md5) {
    if (!md5) md5 = strtool.generateMd5(content)
    const cacheFile = generateCachePath(md5, content);
    if (!file.exists(cacheFile)) {
        return false;
    }
    return await freader.readJson(cacheFile);
}

async function checkWordQueryCache(content) {
    const cacheFile = generateCachePath(null, content);
    let isExpired = false;
    if (!file.exists(cacheFile)) {
        isExpired = true;
    }else if (isExpired(cacheFile)) {
        isExpired = true;
    }
    logger.interval(`checkWordQueryCache ${cacheFile} ${isExpired ? 'expired' : 'not expired'}`, interval_print_seconds, `debug`);
    return isExpired;
}

module.exports = {
    putWordQueryCache,
    queryWordQueryCache,
    checkWordQueryCache,
    isExpired
}
