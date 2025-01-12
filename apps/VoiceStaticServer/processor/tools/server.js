const { getUniqueContentLines } = require('../tools/content.js');
const { addWordBack, getWordFront, getWordCount,ITEM_TYPE } = require('../../provider/QueueManager.js');
const { VOCABULARY_DIR, META_DIR, initWordTotalCount } = require('../../provider/index');
const { checkVoice } = require('./libs/check_voice');
const { getOrGenerateAudioPy } = require('./edge_tts_py');
const logger = require('#@/ncore/utils/logger/index.js');
// const { addOrGetMd5 } = require('./mate_libs/content_mate_query.js');

async function startWordProcessingByServer() {
    const wordCount = getWordCount();
    if (wordCount > 0) {
        processNextWordByServer();
    } else {
        logger.success('All words are processed,waiting for new words');
        setTimeout(() => {
            startWordProcessingByServer();
        }, 500);
    }
}

async function processNextWordByServer() {
    try {
        const nextWord = getWordFront();
        await getOrGenerateAudioPy(nextWord, () => {

        });
    } catch (error) {
        logger.error('Error processing word:', error);
    } finally {
        setTimeout(() => {
            startWordProcessingByServer();
        }, 500);
    }
}

async function initialize_server() {
    let vocabulary = getUniqueContentLines(VOCABULARY_DIR);
    const generatedWords = []
    const notGeneratedWords = []
    for (const item of vocabulary) {
        const validFile = await checkVoice(item);
        if (!validFile) {
            addWordBack(item);
            notGeneratedWords.push(item);
        } else {
            generatedWords.push(item);
        }
    }
    const totalCount = vocabulary.length;
    const waitingCount = notGeneratedWords.length;
    const startIndex = 0;
    const endIndes = vocabulary.length;
    await initWordTotalCount(totalCount,waitingCount,startIndex,endIndes);

    const trimedNotGeneratedWords = notGeneratedWords.slice(0, 100);
    const trimedGeneratedWords = generatedWords.slice(0, 100);
    logger.success(`-------------------------------------------------------------------------------`);
    logger.success(`"${trimedGeneratedWords.join(',')}" is already generated`);
    logger.success(`-------------------------------------------------------------------------------`);
    logger.warn(`"${trimedNotGeneratedWords.join(',')}" is not generated, adding to queue`);
    logger.warn(`-------------------------------------------------------------------------------`);
    logger.success(`Total words: ${vocabulary.length}`);
    logger.success(`Generated words: ${generatedWords.length}`);
    logger.warn(`Not generated words: ${notGeneratedWords.length}`);
}

module.exports = {
    initialize_server,
    startWordProcessingByServer,
    processNextWordByServer
};


