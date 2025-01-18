const axios = require('axios');
const { getUniqueContentLines } = require('./content.js');
const { VOCABULARY_DIR } = require('../../provider/index');
const { checkVoice } = require('./libs/check_voice.js');
const logger = require('#@/ncore/utils/logger/index.js');
const { addWordBack } = require('../../provider/QueueManager.js');
const { initWordTotalCount } = require('../../provider/index');
const sysarg = require('#@ncore/utils/systool/libs/sysarg.js'); 

async function initialize_not_client() {
    let word_segmentation = sysarg.getArg('word_segmentation');
    let vocabulary = getUniqueContentLines(VOCABULARY_DIR);

    let vocabulary_start = 0;
    let vocabulary_end = vocabulary.length;
    if (word_segmentation) {
        word_segmentation = word_segmentation.split('-');
        vocabulary_start = parseInt(word_segmentation[0]);
        vocabulary_end = parseInt(word_segmentation[1]);
    }

    const vocabulary_slice = vocabulary.slice(vocabulary_start, vocabulary_end);

    const generatedWords = []
    const notGeneratedWords = []
    for (const item of vocabulary_slice) {
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
    await initWordTotalCount(totalCount, waitingCount, vocabulary_start, vocabulary_end);

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
}


module.exports = {
    initialize_not_client
};
