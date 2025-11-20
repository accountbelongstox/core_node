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

const { OLD_DB_DIR, TRANSLATE_TMP_DIR, TRANSLATE_DIR } = require('../provider/baseDir/BaseDirProvider.js');
const { fdir, dcopy, file, arrtool, freader, strtool } = require('#@btools');
const path = require('path');
const fs = require('fs');
const { scanDirectory } = fdir;
const logger = require('#@logger');
const { decompress } = require('#@/ncore/foundation/utilities/zip-tool/best_decompressor.js');
const { APP_DATA_CACHE_DIR } = require('#@global_dir');
const preExt = `.expected_ext_marker.j7son.js`;
const splitTokenText = `------------------------------TokenLine-----------------------------`;
const translationDictionaryFile = `olddb.txt`;
const translationDictionaryFilePath = path.join(TRANSLATE_TMP_DIR, translationDictionaryFile);
const { WrapWordTransItemNotKeepIdKey } = require('../basetool/db-tool/trans_item_wrap.js');
const { diffToMainWordsSet, hasWordInMainSet, addToMainWordsSet } = require('../provider/constants/WordCounter.js');
const { insertWordRecords } = require('../middware/middb/wordInsert.js');
const { checkCacheDbDone, setCacheDbDoneToken } = require('../middware/middb/cacheDbInputDone.js');
const {
    insertTransArray,
    getRecordsFromCacheTransData,
    getAllContentOldData
} = require('../middware/middb/cacheTransDbMid.js');
const { getProviderCacheTransData } = require('../provider/DataProvider.js');
const { refreshWordRecords } = require('../middware/middb/wordQuery.js');
async function readCacheTransDataFromDB() {
    const contentArray = await getAllContentOldData();
    const diff = diffToMainWordsSet(contentArray);
    const recoreds = await getRecordsFromCacheTransData(diff)
    let notIncludeMainWordsRecords = [];
    for (const record of recoreds) {
        const parsedRecord = WrapWordTransItemNotKeepIdKey(record);
        notIncludeMainWordsRecords.push(parsedRecord);
    }
    if (notIncludeMainWordsRecords.length > 0) {
        logger.success(`Old Translate-Text Inserting ${notIncludeMainWordsRecords.length} records`);
        await insertWordRecords(notIncludeMainWordsRecords);
    }
    await refreshWordRecords();
    return notIncludeMainWordsRecords;
}

async function startHistoryTrans() {
    let readLargeTextDone = false;
    await readLargeHistoryTrans(async () => {
        readLargeTextDone = true;
        await refreshWordRecords();
    });
    while (!readLargeTextDone) {
        logger.info('waiting readLargeTextDone');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    await readCacheTransDataFromDB();
}

async function readLargeHistoryTrans(callback) {
    const oldLargeTextPreLenght = 100000;
    const olddbDir = path.join(APP_DATA_CACHE_DIR, `olddb`);
    const oldZipFile = path.join(olddbDir, `olddb.7z.001`);
    let notIncludeMainWordsRecords = [];
    const files = scanDirectory(TRANSLATE_DIR, {
        onlyFiles: true,
        withStats: true
    });

    if (files.length == 0) {
        logger.success('No files to translate');
        callback && await callback(notIncludeMainWordsRecords);
        return;
    }
    if (!file.exists(translationDictionaryFilePath)) {
        await dcopy.copyDirectory(TRANSLATE_DIR, olddbDir);
        logger.success('Copy files to olddb success', olddbDir);
        const olddbFiles = scanDirectory(olddbDir, {
            onlyFiles: true,
            withStats: false
        });
        for (const file of olddbFiles) {
            if (file.endsWith(preExt)) {
                const newFile = file.replace(preExt, ``);
                fs.rename(file, newFile, (err) => {
                    if (err) {
                        logger.error('Rename file failed', err, file, newFile);
                    }
                });
            }
        }
        const decompressResult = await decompress(oldZipFile, TRANSLATE_TMP_DIR);
        if (!decompressResult.success) {
            logger.error('Decompress olddb failed');
            callback && await callback(notIncludeMainWordsRecords);
            return;
        }
        logger.success('Decompress olddb success');
    }

    if (!file.exists(translationDictionaryFilePath)) {
        logger.error('After decompress olddb, translationDictionaryFileExists failed');
        logger.error('Plese check the olddb.7z.001 file');
        logger.error(`olddbDir:${olddbDir}`);
        logger.error(`oldZipFile:${oldZipFile}`);
        logger.error(`translationDictionaryFilePath:${translationDictionaryFilePath}`);
    }
    const contentArray = await getAllContentOldData();
    if (contentArray.length < oldLargeTextPreLenght) {
        const cacheTransSet = new Set();
        logger.success('translationDictionaryFileExists success and start read');
        let textContent = '';
        let successCount = 0;
        let errorCount = 0;
        let skipCount = 0;
        let insertCount = 0;
        freader.readLargeText(translationDictionaryFilePath, async (result) => {
            if (!result.done) {
                textContent += result.content;
                textContent = strtool.forceUtf8(textContent);
                if (textContent.includes(splitTokenText)) {
                    const alreadyReadTextCanSplit = textContent.split(splitTokenText);
                    const tailText = alreadyReadTextCanSplit[alreadyReadTextCanSplit.length - 1];
                    alreadyReadTextCanSplit.forEach(item => {
                        try {
                            item = strtool.forceUtf8(item);
                            item = item.trim();
                            const transJson = JSON.parse(item);
                            const content = strtool.cleanWord(transJson.content)
                            if (!cacheTransSet.has(content)) {
                                cacheTransSet.add(content);
                                successCount++;
                                notIncludeMainWordsRecords.push({
                                    content,
                                    translation: transJson
                                });
                            }else {
                                skipCount++;
                            }
                        } catch (error) {
                            errorCount++;
                        }
                    })
                    textContent = tailText;
                }
                // processCallback && await processCallback(notIncludeMainWordsRecords);
                logger.refresh(`From OldTranslate to CacheDB,success: ${successCount} error: ${errorCount} skip: ${skipCount}`)
                if (notIncludeMainWordsRecords.length > 10000) {
                    const waitInsertToTransCacheDb = [...notIncludeMainWordsRecords]
                    notIncludeMainWordsRecords = []
                    const result = await insertTransArray(waitInsertToTransCacheDb);
                    const insertSuccessCount = result ? result.count : 0;
                    insertCount += insertSuccessCount;
                    logger.success(`Inserting to TransCacheDB :${insertSuccessCount} total:${insertCount}\n`);
                    notIncludeMainWordsRecords = []
                }
            } else {
                await insertTransArray(notIncludeMainWordsRecords);
                logger.success(`Inserting to TransCacheDB done,wait 5s to insert done token`);
                setTimeout(async () => {
                    await setCacheDbDoneToken(dataName);
                    logger.success(`Insert done token to TransCacheDB done`);
                    callback && await callback(notIncludeMainWordsRecords);
                }, 5000);
                logger.refresh(`Loaded ${translationDictionaryFilePath},success: ${successCount} error: ${errorCount}`);
            }
        });
    } else {
        callback && await callback(notIncludeMainWordsRecords);
        logger.success('Done token found, skip translate Text input to DB');
    }
}

module.exports = {
    startHistoryTrans,
    readCacheTransDataFromDB
}