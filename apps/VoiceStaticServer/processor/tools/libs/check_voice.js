const {
    printWordStatus,
    updateWordSuccessCount,
    updateWordFailedCount, } = require('../../../provider/index');

const log = require('#@/ncore/utils/logger/index.js');

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
