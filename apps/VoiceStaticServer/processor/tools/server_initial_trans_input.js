// const { addWordBack, getWordFront, getWordCount, ITEM_TYPE } = require('../../provider/QueueManager.js');
const { OLD_DB_DIR, TRANSLATE_TMP_DIR, TRANSLATE_DIR } = require('../../provider/index');
const { query } = require('#@/ncore/utils/db_tool/sequelize-oporate/sequelize_query.js');
const { hardDelete } = require('#@/ncore/utils/db_tool/sequelize-oporate/sequelize_delete.js');
const path = require('path');
const fs = require('fs');
const { downloadFile } = require('#@/ncore/basic/libs/downloader.js');
const { formatDurationToStr } = require('#@/ncore/utils/tool/libs/datetool.js');
const { scanDirectory, clearDirectory } = require('#@/ncore/utils/ftool/libs/fdir.js');
const { readJson } = require('#@/ncore/basic/libs/freader.js');
const { copyDirectory } = require('#@/ncore/utils/ftool/libs/dcopy.js');
const { getOldDatabase } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const logger = require('#@logger');
const FileMonitor = require('#@/ncore/utils/ftool/libs/fmonitor.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const dbUrl = gconfig.getConfig(`OLD_DB_URL`);
const { writeJson, exists } = require('#@/ncore/basic/libs/fwriter.js');
const { fsrename, fsexists } = require('#@/ncore/utils/ftool/libs/file.js');
const dataOldName = gconfig.getConfig(`OLD_DB_NAME`);
const dbPath = path.join(OLD_DB_DIR, dataOldName);
const { sequelize_init_tables } = require('../../provider/types/old_data_types.js');
const { smartDelayForEach, delayForEach } = require('#@/ncore/utils/tool/libs/arrtool.js');
const { generateMd5, wordToFileName } = require('#@/ncore/utils/tool/libs/strtool.js');
const zipTool = require('#@/ncore/utils/tool/zip-tool/task_index.js');
const { generateWorkerTimer } = require('#@/ncore/utils/tool/thread/timer_worker.js');
const { decompress } = require('#@/ncore/utils/tool/zip-tool/best_decompressor.js');
const { APP_DATA_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
const preExt = `.expected_ext_marker.j7son.js`;
const translationDictionaryFile = `translation_dictionary.json`;
const translationDictionaryFilePath = path.join(TRANSLATE_TMP_DIR, translationDictionaryFile);

async function startInputOldDataTranslate() {
    const files = scanDirectory(TRANSLATE_DIR, {
        onlyFiles: true,
        withStats: true
    });

    if (files.length == 0) {
        logger.success('No files to translate');
        return;
    }

    const olddbDir = path.join(APP_DATA_CACHE_DIR, `olddb`);
    await copyDirectory(TRANSLATE_DIR, olddbDir);
    logger.success('Copy files to olddb success');
    const olddbFiles = scanDirectory(olddbDir, {
        onlyFiles: true,
        withStats: false
    });
    for (const file of olddbFiles) {
        if (file.endsWith(preExt)) {
            const newFile = file.replace(preExt, ``);
            fsrename(file, newFile);
        }
    }
    const oldZipFile = path.join(olddbDir, `olddb.7z.001`);
    await clearDirectory(TRANSLATE_TMP_DIR);
    if (!fsexists(translationDictionaryFilePath)) {
        const decompressResult = await decompress(oldZipFile, TRANSLATE_TMP_DIR);
        if (!decompressResult.success) {
            logger.error('Decompress olddb failed');
            return;
        }
        logger.success('Decompress olddb success');
    }
    logger.success('translationDictionaryFileExists success and start read');
    const translationDictionary = readJson(translationDictionaryFilePath);
    logger.success(`read translationDictionary success len ${Object.keys(translationDictionary).length}`);
    for (const [key, value] of Object.entries(translationDictionary)) {
        console.log(key);
    }
}


module.exports = {
    startInputOldDataTranslate
}