const { APP_TMP_DIR, APP_DATA_DIR, APP_DATA_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
const logger = require('#@/ncore/utils/logger/index.js');
const { replaceSpaceToDash } = require('../../processor/tools/mate_libs/string.js');
const { addWordBack, getWordCount, getWordFront, ITEM_TYPE, removeByWord, hasWord, hasSentence } = require('../../provider/QueueManager.js');
const { uploadAndKeepOriginName, wrapFileDetails } = require('#@/ncore/utils/express/libs/UploadTools.js');
const { copyFileToDir } = require('#@/ncore/utils/ftool/libs/fcopy.js');
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR, IS_SERVER, initializeWatcher, getWordStatus } = require('../../provider/index.js');
const fs = require('fs');
const path = require('path');
const SUBMISSION_LOG_FILE = path.join(APP_DATA_CACHE_DIR, 'server_submissions.json');
let submissionsCache = null;


async function getDiffAudioTable(req, res) {
    const { fields } = await wrapFileDetails(req);
    // 
    if (!fields.ClientAudioMeter) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: ClientAudioMeter and ServerAudioMeter'
        });
    }

    res.json({
        success: true,
        message: 'Files uploaded successfully',
        data: {
            clientIp: req.ip,
            fields,
            DICT_SOUND_DIR,
        }
    });

    DICT_SOUND_DIR

    const result = await getDiffAudioTable();
    return result;
}

module.exports = {
    getDiffAudioTable
}
