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

const { APP_TMP_DIR, APP_DATA_CACHE_DIR } = require('#@global_dir');
const logger = require('#@logger');
const { replaceSpaceToDash } = require('#@ncore/foundation/utilities/strtool.js');
const { ITEM_TYPE } = require('../provider/types/data_types.js');
const rpc = require('#@ncore/utils/rpc');
const UploadTools = rpc.getExpressServer().uploadTools;
const { fcopy } = require('#@ftools');
const { copyFileToDir } = fcopy;
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR,
} = require('../provider/baseDir/BaseDirProvider.js');
const { IS_SERVER } = require('../provider/constants/StaticData.js');
const fs = require('fs');
const path = require('path');
const SUBMISSION_LOG_FILE = path.join(APP_DATA_CACHE_DIR, 'server_submissions.json');
let submissionsCache = null;

function ensureSubmissionLog() {
    if (!fs.existsSync(APP_DATA_CACHE_DIR)) {
        fs.mkdirSync(APP_DATA_CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(SUBMISSION_LOG_FILE)) {
        fs.writeFileSync(SUBMISSION_LOG_FILE, JSON.stringify({
            submissions: [],
            count: 0
        }, null, 2));
    }
}

function loadSubmissionsCache() {
    try {
        ensureSubmissionLog();
        if (!submissionsCache) {
            const data = JSON.parse(fs.readFileSync(SUBMISSION_LOG_FILE, 'utf8'));
            submissionsCache = data;
            logger.info('Submissions cache loaded with', data.count, 'items');
        }
        return submissionsCache;
    } catch (error) {
        logger.error('Error loading submissions cache:', error);
        return {
            submissions: [],
            count: 0
        };
    }
}

async function recordSubmission(content) {
    try {
        const cache = loadSubmissionsCache();
        if (!cache.submissions.includes(content)) {
            cache.submissions.push(content);
            cache.count = cache.submissions.length;
            fs.writeFileSync(SUBMISSION_LOG_FILE, JSON.stringify(cache, null, 2));
        }
    } catch (error) {
        logger.error('Error recording submission:', error);
    }
}

async function getSubmissionServerList() {
    try {
        const cache = loadSubmissionsCache();
        return {
            count: cache.count,
            submissions: cache.submissions
        };
    } catch (error) {
        logger.error('Error getting submission stats:', error);
        return {
            count: 0,
            submissions: []
        };
    }
}

async function getSubmissionServerCount() {
    const stats = await getSubmissionServerList();
    return stats.count;
}

async function getRowWordByServer() {
    if (!IS_SERVER) {
        return {
            success: false,
            message: 'This is a client, not a server',
        };
    }
    return {
        success: false,
        message: 'No words are processed'
    };
    const wordCount = 0;
    if (wordCount > 0) {
        const word = ``;
        return {
            success: true,
            message: 'Get word',
            word: word,
            remainCount: wordCount,
        };
    } else {
        return {
            success: false,
            message: 'No words are processed'
        };
    }
}

const getVoiceDir = (type) => {
    return type == ITEM_TYPE.WORD ? DICT_SOUND_DIR : SENTENCES_SOUND_DIR;
}

const deleteFile = async (filePath) => {
    if (fs.existsSync(filePath)) {
        try {
            await fs.promises.unlink(filePath);
        } catch (removeError) {
        }
    }
}

async function submitAudio(req, res, next) {
    try {
        logger.info('\n=== Audio Submission Request ===');
        const { fields, files, filePaths } = await UploadTools.uploadAndKeepOriginName(req, APP_TMP_DIR);
        if (!fields.content || !fields.type) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: content and type'
            });
        }
        const content = replaceSpaceToDash(fields.content);
        // const hasItem = fields.type == ITEM_TYPE.SENTENCE ? hasSentence(content) : hasWord(content);
        const fileDetails = filePaths.fileDetails;
        // if (!hasItem) {
        //     fileDetails.forEach(file => {
        //         deleteFile(file.path);
        //     });
        //     return res.status(400).json({
        //         success: false,
        //         message: (fields.type == ITEM_TYPE.SENTENCE ? 'Sentence' : 'Word') + ' "' + content + '" not exists to current queue'
        //     });
        // }
        let is_copy_success = null;
        let all_copy_success = [];
        const voiceDir = getVoiceDir(fields.type);
        fileDetails.forEach(file => {
            if (file.size > 0) {
                all_copy_success.push(copyFileToDir(file.path, voiceDir, false, true));
            }
            deleteFile(file.path);
        });
        is_copy_success = all_copy_success.every(item => item != null);
        if (is_copy_success) {
            await recordSubmission(content);
        }
        const finishedAndRemoved = `removeByWord(content)`;
        const count = await getSubmissionServerCount();
        res.json({
            success: true,
            message: 'Files uploaded successfully',
            data: {
                fields,
                finishedAndRemoved,
                submissionCount: count
            }
        });
    } catch (error) {
        logger.error('Upload Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function submitAudioSimple(req, res, next) {
    const DICT_SOUND_WATCHER = `DICT_SOUND_WATCHER`;
    const SENTENCES_SOUND_WATCHER = `SENTENCES_SOUND_WATCHER`;
    try {
        logger.info('\n=== Audio Submission-Simple Request ===');
        const { fields, files, filePaths } = await UploadTools.uploadAndKeepOriginName(req, APP_TMP_DIR);
        if (!fields.type) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: content and type'
            });
        }
        const fileDetails = filePaths.fileDetails;
        const voiceDir = getVoiceDir(fields.type);
        const watcher = fields.type == ITEM_TYPE.WORD ? DICT_SOUND_WATCHER : SENTENCES_SOUND_WATCHER;
        const watcher_name = fields.type == ITEM_TYPE.WORD ? 'DICT_SOUND_WATCHER' : 'SENTENCES_SOUND_WATCHER';
        let copy_success_count = 0;
        let added_watcher_count = 0;
        fileDetails.forEach(file => {
            if (file.size > 0) {
                let is_copy_success = copyFileToDir(file.path, voiceDir, false, true);
                if (is_copy_success) {
                    copy_success_count++;
                    let is_added = watcher.addToIndex(file.path);
                    if (is_added) {
                        added_watcher_count++;
                    }
                    logger.info(`File submitted ${file.path} added to ${watcher_name}`);
                }
            }
            deleteFile(file.path);
        });
        res.json({
            success: true,
            message: 'Files uploaded successfully',
            data: {
                fields,
                copiedFilesCount: copy_success_count,
                watcher_name,
                added_watcher_count
            }
        });
    } catch (error) {
        logger.error('Upload Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}


module.exports = {
    getRowWordByServer,
    submitAudio,
    getSubmissionServerList,
    submitAudioSimple,
    getSubmissionServerCount,
    loadSubmissionsCache
};

