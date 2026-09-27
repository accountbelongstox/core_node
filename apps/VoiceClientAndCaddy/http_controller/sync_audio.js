const { APP_TMP_DIR, APP_DATA_DIR, APP_DATA_CACHE_DIR } = require('#@global_dir');
const logger = require('#@logger');
const UploadTools = require('#@ncore/utils/rpc/http_rpc/libs/UploadTools.js');
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR, 
    IS_SERVER 
} = require('../provider/baseDir/BaseDirProvider.js');
const fs = require('fs');
const path = require('path');
const SUBMISSION_LOG_FILE = path.join(APP_DATA_CACHE_DIR, 'server_submissions.json');
let submissionsCache = null;


async function getDiffAudioTable(req, res) {
    const { fields } = await UploadTools.wrapFileDetails(req);
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
