const axios = require('axios');
const { getUniqueContentLines } = require('./content.js');
const { VOCABULARY_DIR, setWordIndex } = require('../../provider/index');
const { checkVoice } = require('./libs/check_voice.js');
const logger = require('#@/ncore/utils/logger/index.js');
const { addWordBack } = require('../../provider/QueueManager.js');
const { updateWordWaitingCount, setWordTotalCount, addWordCount } = require('../../provider/index');
const { sysarg } = require('#@utils_native');

async function initialize_not_client() {
    let word_segmentation = sysarg.getArg('word_segmentation');
    let vocabulary = getUniqueContentLines(VOCABULARY_DIR);

    let vocabulary_start = 0;
    let vocabulary_end = vocabulary.length;
    if (word_segmentation) {
        word_segmentation = word_segmentation.split('-');
        vocabulary_start = parseInt(word_segmentation[0]);
        vocabulary_end = parseInt(word_segmentation[1]);
        setWordIndex(vocabulary_start, vocabulary_end);
    } else {
        setWordIndex(0, vocabulary.length);
    }

    const vocabulary_slice = vocabulary.slice(vocabulary_start, vocabulary_end);

    const generatedWords = []
    const notGeneratedWords = []
    for (const item of vocabulary_slice) {
        const validFile = await checkVoice(item);
        if (!validFile) {
            addWordBack(item);
            notGeneratedWords.push(item);
            updateWordWaitingCount('add');
        } else {
            generatedWords.push(item);
            addWordCount(1);
        }
    }
    const trimedGeneratedWords = generatedWords.slice(0, 100);
    const trimedNotGeneratedWords = notGeneratedWords.slice(0, 100);
    logger.success(`-------------------------------------------------------------------------------`);
    logger.success(`"${trimedGeneratedWords.join(',')}" is already generated`);
    logger.success(`-------------------------------------------------------------------------------`);
    logger.warn(`"${trimedNotGeneratedWords.join(',')}" is not generated, adding to queue`);
    logger.warn(`-------------------------------------------------------------------------------`);
    logger.success(`Total words: ${vocabulary.length}`);
    logger.success(`Generated words: ${generatedWords.length}`);
    logger.warn(`Not generated words: ${notGeneratedWords.length}`);
    console.log(`word_segmentation: ${word_segmentation}`);
    setWordTotalCount(vocabulary.length);
}


module.exports = {
    initialize_not_client
};
