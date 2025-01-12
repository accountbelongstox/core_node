const { APP_TMP_DIR, APP_DATA_DIR, APP_DATA_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
const logger = require('#@/ncore/utils/logger/index.js');
const { addWordBack, getWordCount, getWordFront, ITEM_TYPE, removeByWord, hasWord, hasSentence } = require('../../provider/QueueManager.js');
const { uploadAndKeepOriginName, wrapFileDetails } = require('#@/ncore/utils/express/libs/UploadTools.js');
const { copyFileToDir } = require('#@/ncore/utils/ftool/libs/fcopy.js');
const { DICT_SOUND_DIR, SENTENCES_SOUND_DIR, IS_SERVER, initializeWatcher } = require('../../provider/index.js');
const fs = require('fs');
const path = require('path');
const SUBMISSION_LOG_FILE = path.join(APP_DATA_CACHE_DIR, 'server_submissions.json');


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

/**
 * Record successful submission
 * @param {string} content - Submitted content
 */
async function recordSubmission(content) {
    try {
        ensureSubmissionLog();
        const data = JSON.parse(fs.readFileSync(SUBMISSION_LOG_FILE, 'utf8'));

        if (!data.submissions.includes(content)) {
            data.submissions.push(content);
            data.count = data.submissions.length;
            fs.writeFileSync(SUBMISSION_LOG_FILE, JSON.stringify(data, null, 2));
        }
    } catch (error) {
        logger.error('Error recording submission:', error);
    }
}

/**
 * Get submission statistics
 * @returns {Promise<{count: number, submissions: string[]}>}
 */
async function getSubmissionServerList() {
    try {
        ensureSubmissionLog();
        const data = JSON.parse(fs.readFileSync(SUBMISSION_LOG_FILE, 'utf8'));
        return {
            count: data.count,
            submissions: data.submissions
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

async function getRowWord() {
    if (!IS_SERVER) {
        return {
            success: false,
            message: 'This is a client, not a server',
            word: null
        };
    }
    const wordCount = getWordCount();
    if (wordCount > 0) {
        const word = getWordFront();
        addWordBack(word.content);
        return {
            success: true,
            message: 'Get word',
            word: word
        };
    } else {
        return {
            success: false,
            message: 'No words are processed',
            word: null
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

        const { fields, files, filePaths } = await uploadAndKeepOriginName(req, APP_TMP_DIR);

        if (!fields.content || !fields.type) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: content and type'
            });
        }

        const hasItem = fields.type == ITEM_TYPE.SENTENCE ? hasSentence(fields.content) : hasWord(fields.content);
        const fileDetails = filePaths.fileDetails;

        if (!hasItem) {
            fileDetails.forEach(file => {
                deleteFile(file.path);
            });
            return res.status(400).json({
                success: false,
                message: fields.type == ITEM_TYPE.SENTENCE ? 'Sentence' : 'Word' + ' "' + fields.content + '" not exists to current queue'
            });
        }

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
            await recordSubmission(fields.content);
        }

        const finished = removeByWord(fields.content);
        const count = await getSubmissionServerCount();

        res.json({
            success: true,
            message: 'Files uploaded successfully',
            data: {
                fields,
                finished,
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
    const { DICT_SOUND_WATCHER, SENTENCES_SOUND_WATCHER } = await initializeWatcher();
    try {
        logger.info('\n=== Audio Submission-Simple Request ===');
        const { fields, files, filePaths } = await uploadAndKeepOriginName(req, APP_TMP_DIR);
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
                    if(is_added){
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
    getRowWord,
    submitAudio,
    getSubmissionServerList,
    submitAudioSimple,
    getSubmissionServerCount
};

