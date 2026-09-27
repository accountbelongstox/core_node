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
