const axios = require('axios');
const { initializeWatcher, GET_ROW_WORD_URL } = require('../../provider/index');
const logger = require('#@/ncore/utils/logger/index.js');
const { getWordFront, getWordCount,ITEM_TYPE } = require('../../provider/QueueManager.js');
const { getOrGenerateAudioPy } = require('./edge_tts_py');
const CLIENT_SUBMIT_TO_SERVER_FILES_MAP = new Map();
const { submitSimpleAudio, checkSimpleSubmission, recordSimpleSubmission } = require('../../http/controller/dict_simple_client.js');
const path = require('path');

async function initialize_client() {
    const {
        DICT_SOUND_WATCHER,
        SENTENCES_SOUND_WATCHER
    } = await initializeWatcher();
    let once_loopCount = 0
    let count_size = 1
    while (once_loopCount < 1 && count_size > 0) {
        const { file, index, loopCount, size } = await DICT_SOUND_WATCHER.getNextFileAndIndex();
        const submission = await checkSimpleSubmission(file);
        if (!submission) {
            CLIENT_SUBMIT_TO_SERVER_FILES_MAP.set(file, true);
        }
        once_loopCount = loopCount;
        count_size = size;
    }

    if (CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size > 0) {
        logger.info(`Submit ${CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size} files to server`);
        submitSimpleAudioToServer()
    }
}

async function submitSimpleAudioToServer() {
    const BATCH_SIZE = 100; 

    async function processNextBatch() {
        if (CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size === 0) {
            logger.success('All files have been processed');
            return;
        }

        const files = Array.from(CLIENT_SUBMIT_TO_SERVER_FILES_MAP.keys()).slice(0, BATCH_SIZE);
        if (files.length === 0) {
            logger.warn('No valid files found');
            return;
        }

        const totalFiles = CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size + files.length;
        const currentBatch = totalFiles - CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size;
        const progressPercent = ((currentBatch / totalFiles) * 100).toFixed(1);

        logger.info(`\nProcessing batch ${currentBatch}-${currentBatch + files.length - 1}/${totalFiles} (${progressPercent}%)`);
        logger.info(`Current batch size: ${files.length} files`);
        logger.info('Files in current batch:', files.map(f => path.basename(f)).join(', '));

        try {
            await submitSimpleAudio(files, ITEM_TYPE.WORD, (result) => {
                if (result.success) {
                    logger.success(`Successfully processed batch of ${files.length} files`);
                } else {
                    logger.error(`Failed to process batch ${files.length} files`);
                }
            });

            files.forEach(file => {
                CLIENT_SUBMIT_TO_SERVER_FILES_MAP.delete(file);
            });

            if (CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size > 0) {
                const remainingBatches = Math.ceil(CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size / BATCH_SIZE);
                logger.info(`\nWaiting before next batch... (${CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size} files remaining in ${remainingBatches} batches)`);
                setTimeout(processNextBatch, 500);
            } else {
                logger.success('\nAll files have been processed');
            }
        } catch (error) {
            logger.error(`Error processing batch:`, error);
            setTimeout(processNextBatch, 500);
        }
    }

    if (CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size === 0) {
        logger.warn('No files to process');
        return;
    }

    const totalBatches = Math.ceil(CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size / BATCH_SIZE);
    logger.info(`Starting to process ${CLIENT_SUBMIT_TO_SERVER_FILES_MAP.size} files in ${totalBatches} batches...`);
    processNextBatch();
}


async function startWordProcessingByClient() {
    const wordCount = getWordCount();
    if (wordCount > 0) {
        processNextWordByClient();
    } else {
        logger.success('All words are processed,waiting for new words');
        setTimeout(() => {
            startWordProcessingByClient();
        }, 500);
    }
}

async function processNextWordByClient() {
    try {
        const nextWord = getWordFront();
        await getOrGenerateAudioPy(nextWord, () => {
            submitAudioByClient(nextWord);
        });
    } catch (error) {
        logger.error('Error processing word:', error);
    } finally {
        setTimeout(() => {
            startWordProcessingByClient();
        }, 500);
    }
}


async function getWordByClient() {
    const result = await axios.get(GET_ROW_WORD_URL);
    return result;
}

async function submitAudioByClient(audio) {
    const {
        DICT_SOUND_WATCHER,
        SENTENCES_SOUND_WATCHER
    } = await initializeWatcher();
    const { file, index, loopCount } = await DICT_SOUND_WATCHER.getNextFileAndIndex();
    // const result = await axios.post(SUBMIT_AUDIO_URL, { audio: file, index, loopCount });
    // return result;
}

module.exports = {
    startWordProcessingByClient,
    processNextWordByClient,
    getWordByClient,
    submitAudioByClient,
    initialize_client
};
