// const { addWordBack, getWordFront, getWordCount, ITEM_TYPE } = require('../../provider/QueueManager.js');
const { OLD_DB_DIR, TRANSLATE_TMP_DIR, TRANSLATE_DIR } = require('../../provider/index');
const { query } = require('#@/ncore/utils/db_tool/sequelize-oporate/sequelize_query.js');
const { hardDelete } = require('#@/ncore/utils/db_tool/sequelize-oporate/sequelize_delete.js');
const path = require('path');
const fs = require('fs').promises;
const { downloadFile } = require('#@/ncore/basic/libs/downloader.js');
const { formatDurationToStr } = require('#@/ncore/utils/tool/libs/datetool.js');
const { getOldDatabase } = require('#@/ncore/utils/db_tool/sequelize_db.js');
const logger = require('#@logger');
const FileMonitor = require('#@/ncore/utils/ftool/libs/fmonitor.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const dbUrl = gconfig.getConfig(`OLD_DB_URL`);
const { writeJson, exists } = require('#@/ncore/basic/libs/fwriter.js');
const dataOldName = gconfig.getConfig(`OLD_DB_NAME`);
const dbPath = path.join(OLD_DB_DIR, dataOldName);
const { replaceExtension } = require('#@/ncore/utils/ftool/libs/fpath.js');
const { sequelize_init_tables } = require('../../provider/types/old_data_types.js');
const { smartDelayForEach, delayForEach } = require('#@/ncore/utils/tool/libs/arrtool.js');
const { generateMd5, wordToFileName } = require('#@/ncore/utils/tool/libs/strtool.js');
const zipTool = require('#@/ncore/utils/tool/zip-tool/task_index.js');

const { Worker, isMainThread, parentPort } = require('worker_threads');

async function serverTest() {
    let forLimit = 10;
    const files = await fs.readdir(TRANSLATE_TMP_DIR);
    const totalFiles = files.length;
    const startTime = Date.now();

    for(let i = 0; i < files.length; i++) {
        const file = files[i];
        const fullPath = path.join(TRANSLATE_TMP_DIR, file);
        const zipTargetPath = replaceExtension(path.join(TRANSLATE_DIR, file), 'j7son');
        
        zipTool.addFileCompressionTask(fullPath, zipTargetPath, {}, (err) => {
            if(err) {
                logger.error(`error: ${err}`);
            }
        }, false);

        if(i % 1000 === 0) {
            const currentDuration = formatDurationToStr(Date.now() - startTime);
            const progress = ((i / totalFiles) * 100).toFixed(2);
            logger.info(`Progress: ${i}/${totalFiles} (${progress}%) files processed in ${currentDuration}`);
        }
    }

    const totalDuration = formatDurationToStr(Date.now() - startTime);
    logger.info(`All ${totalFiles} files processed in ${totalDuration}`);
}

module.exports = {
    serverTest,
}