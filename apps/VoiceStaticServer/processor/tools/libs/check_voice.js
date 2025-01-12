const {
    printWordStatus,
    updateWordSuccessCount,
    updateWordFailedCount, } = require('../../../provider/index');

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

const {
    ensureQueueItem,
    generateAudioMa3Name,
    checkValidFile,
} = require('../mate_libs/voice_tool');

const updateWordCount = (ma3Path, type) => {
    const validFile = checkValidFile(ma3Path, type);
    let isSuccess = false;
    if (validFile) {
        log.success(`Generated and checked file: ${ma3Path}`);
        updateWordSuccessCount();
        isSuccess = true;
    } else {
        log.error(`Failed to generate valid audio file for '${ma3Path}'`);
        updateWordFailedCount();
    }
    printWordStatus();
    return isSuccess;
}

const checkVoice = async (input) => {
    try {
        const queueItem = ensureQueueItem(input);
        if (!queueItem) {
            log.error('Failed to create valid queue item from input');
            return false;
        }
        const audioMapName = await generateAudioMa3Name(queueItem);
        return await checkValidFile(audioMapName, queueItem.type);
    } catch (e) {
        log.error(`Error checking MP3 file: ${e.message} ${e.stack}`);
        return false;
    }
};

module.exports = {
    checkVoice,
    updateWordCount,
}
