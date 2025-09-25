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

const { OLD_DB_DIR } = require('../provider/baseDir/BaseDirProvider.js');
const { fpath, file } = require('#@btools');
const path = require('path');
const { CURLDownload } = require('#@downloader');
const logger = require('#@logger');
const gconfig = require('#@gconfig');
const dbUrl = gconfig.getConfig(`OLD_DB_URL`);
const dataOldName = gconfig.getConfig(`OLD_DB_NAME`);
const dbPath = path.join(OLD_DB_DIR, dataOldName);
const { decompress } = require('#@/ncore/foundation/utilities/zip-tool/best_decompressor.js');
const { WrapWordTransItemNotKeepIdKey } = require('../basetool/db-tool/trans_item_wrap.js');
const { addToMainWordsSet, hasWordInMainSet, getMainSet, diffToMainWordsSet } = require('../provider/constants/WordCounter.js');
const {
    getAllContentOldData,
    getOldDbLength,
    getOldDBRecords,
    closeAllOldDB,
    getRecordsFromOldData,
    initData
} = require('../middware/middb/oldDBMid.js');
const { setCacheDbDoneToken, checkCacheDbDone } = require('../middware/middb/cacheDbInputDone.js');
const { insertWordRecords } = require('../middware/middb/wordInsert.js');
const { refreshWordRecords } = require('../middware/middb/wordQuery.js');

async function finishCleanOldDB() {
    await closeAllOldDB();
}

async function intoOldDb() {
    const oldDbLength = await getOldDbLength();
    for (let i = 0; i < oldDbLength; i++) {
        const isInputDone = await checkCacheDbDone(i);
        if (!isInputDone) {
            await refreshWordRecords();
            const { dataPath, dataName } = await initData(i);
            logger.warn(`${dataName} is Not Input Done, start input olddb : ${dataPath}`);
            const oldDbContent = await getAllContentOldData(i);
            const diff = diffToMainWordsSet(oldDbContent);
            const batchSize = 10000;
            let offset = 0;
            const totalRecords = diff.length || 0;
            while (offset < totalRecords) {
                const diffBatch = diff.slice(offset, offset + batchSize);
                const recoreds = await getRecordsFromOldData(diffBatch, i);
                let NotInputRecords = [];
                for (let i = 0; i < recoreds.length; i++) {
                    const parsedRecord = recoreds[i];
                    if (parsedRecord.translation == '{}' || !parsedRecord.translation) {
                        parsedRecord.translation = null;
                    }
                    recoreds[i] = WrapWordTransItemNotKeepIdKey(recoreds[i]);
                    if (!hasWordInMainSet(parsedRecord.content)) {
                        addToMainWordsSet(parsedRecord.content);
                        NotInputRecords.push(parsedRecord)
                    }
                }
                const IsertWordRecords = [...NotInputRecords];
                NotInputRecords = []
                await insertWordRecords(IsertWordRecords);
                logger.progress(`olddb content:${oldDbContent.length} diff:${diff.length} recoreds:${recoreds.length}s...`, offset, totalRecords);

                offset += batchSize;
            }
        }
    }
}

async function startOldDbInput() {
    const isOldDatafile = file.checkFileSize(dbPath, 100)
    if (!isOldDatafile) {
        const zipFile = fpath.replaceExtension(dbPath, `7z`);
        await CURLDownload(dbUrl, zipFile);
        const decompressResult = await decompress(zipFile, path.dirname(dbPath));
        if (!decompressResult.success) {
            logger.error('Decompress olddb failed');
            return;
        }
        logger.success('Decompress olddb success');
    }
    await intoOldDb();
    await finishCleanOldDB();
    await refreshWordRecords();
}


module.exports = {
    startOldDbInput,
}