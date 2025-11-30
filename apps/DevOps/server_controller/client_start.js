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

const { getJsonFromUrl } = require('#@/ncore/utils/net/libs/axios_tool.js');
const { GET_ROW_WORD_URL } = require('../provider/constants/StaticData.js');
const logger = require('#@logger');
const { arrtool } = require('#@btools');
const { ITEM_TYPE } = require('../provider/types/data_types.js');
const { getOrGenerateAudioPy } = require('../basetool/ptools/edge_tts_py.js');
const CLIENT_SUBMIT_TO_SERVER_FILES_MAP = new Map();
const { submitAudio } = require('../http_controller/dict_client.js');
const { submitSimpleAudio, checkSimpleSubmission, recordSimpleSubmission } = require('../http_controller/dict_simple_client.js');
const { getDICTSoundWatcher } = require('../provider/WatcherProvider.js');

async function initialize_client() {
    const DICT_SOUND_WATCHER = await getDICTSoundWatcher();
    let once_loopCount = 0
    let count_size = 1
    while (once_loopCount < 1 && count_size > 0) {
        const { file, index, loopCount, size } = await DICT_SOUND_WATCHER.getNextFileAndIndex();
        if (!file) {
            break
        }
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
    const BATCH_SIZE = 500;
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
    const result = await getJsonFromUrl(GET_ROW_WORD_URL);
    logger.info(`result:${result}`);
    return 
    try {
        if (result.success) {
            const nextWord = result.word;
            if (nextWord) {
                try {
                    const remainCount = result.remainCount;
                    const wordTotalCount = result.wordTotalCount;
                    const wordWaitingCount = result.wordWaitingCount;
                    const wordStartIndex = result.wordStartIndex;
                    const wordEndIndex = result.wordEndIndex;
                    const wordGeneratedServerTotalCount = result.dictSoundWatcher.fileNameSet;
                    const isAllNotUndefined = arrtool.hasNoUndefined(wordTotalCount, wordWaitingCount, wordStartIndex, wordEndIndex, wordGeneratedServerTotalCount);
                    logger.info(`-------------------------Update Word Total Count :${isAllNotUndefined}------------------------------`);
                    if (isAllNotUndefined) {
                        logger.info(`wordTotalCount: ${wordTotalCount}`);
                        logger.info(`wordWaitingCount: ${wordWaitingCount}`);
                        logger.info(`wordStartIndex: ${wordStartIndex}`);
                        logger.info(`wordEndIndex: ${wordEndIndex}`);
                        logger.info(`wordGeneratedServerTotalCount: ${wordGeneratedServerTotalCount}`);
                        logger.info(`--------------------------------------------------------------------------------`);
                    }
                } catch (error) {
                    logger.error('Error processing word:', error);
                }

                await getOrGenerateAudioPy(nextWord, (generatedWordFiles) => {
                    const contentType = nextWord.content.includes(' ') ? ITEM_TYPE.SENTENCE : ITEM_TYPE.WORD;
                    submitAudio(nextWord.content, generatedWordFiles, contentType, async (status) => {
                        if (status.success) {
                            logger.success(`Successfully processed word: ${nextWord.content}`);
                        } else {
                            logger.error(`Failed to process word: ${nextWord.content}`);
                        }
                    });
                });
            }
        }
    } catch (error) {
        logger.error('Error processing word:', error);
    } finally {
        setTimeout(() => {
            startWordProcessingByClient();
        }, 500);
    }
}


module.exports = {
    startWordProcessingByClient,
    initialize_client
};
