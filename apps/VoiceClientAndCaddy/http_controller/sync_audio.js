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

const { APP_TMP_DIR, APP_DATA_DIR, APP_DATA_CACHE_DIR } = require('#@global_dir');
const logger = require('#@logger');
const rpc = require('#@ncore/utils/rpc');
const UploadTools = rpc.getExpressServer().uploadTools;
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
