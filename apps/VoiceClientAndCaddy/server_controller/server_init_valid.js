const { jsontool } = require('#@btools');
const { WORD_VALIDITY_FILE } = require('../provider/baseDir/BaseDirProvider.js');
const { getContent } = require('../middware/middb/wordQuery.js');
const { ITEM_TYPE } = require('../provider/types/data_types.js'); 
const logger = require('#@logger');
const { streamChat } = require('#@/ncore/utils/openai/chat.js');

let preloadedWordValidity = null;

async function loadWordValidityData() {
    try {
        preloadedWordValidity = await jsontool.readJson(WORD_VALIDITY_FILE);
        logger.success(`Loaded ${Object.keys(preloadedWordValidity).length} word validity records`);
    } catch (error) {
        logger.error('Failed to load word validity data:', error);
        preloadedWordValidity = {};
    }
}

function getWordValidity(queueItem) {
    if (!preloadedWordValidity || !queueItem || !queueItem.content) {
        return null;
    }
    return preloadedWordValidity[queueItem.content] || null;
}

async function checkWordValidityWithOpenAI(queueItem) {
    try {
        // First check preloaded data
        const cachedValidity = getWordValidity(queueItem);
        if (cachedValidity) {
            return cachedValidity;
        }

        const prompt = `Is "${queueItem.content}" a valid English word? Please respond with only "true" or "false".`;
        const response = await streamChat(prompt, () => {}, false);
        const result = response.toLowerCase().includes('true');
        
        // Create validity object
        const validityObject = {
            is_valid: result,
            valid_provider: 'openai'
        };

        // Update preloaded data
        if (preloadedWordValidity) {
            preloadedWordValidity[queueItem.content] = validityObject;
        }

        return validityObject;
    } catch (error) {
        logger.error(`Error checking word validity for "${queueItem.content}":`, error);
        return {
            is_valid: false,
            valid_provider: 'openai',
            error: error.message
        };
    }
}

async function checkAllWordValidityWithOpenAI() {
    await loadWordValidityData();
    
    // Get all words that haven't been validated yet
    const notIdentifiedWords = await getContent({
        is_valid: null,
    }, ITEM_TYPE.WORD);

    logger.info(`Found ${notIdentifiedWords.length} words needing validation`);
    
    // for (const queueItem of notIdentifiedWords) {
    //     const validityResult = await checkWordValidityWithOpenAI(queueItem);
    //     logger.info(`Checked "${queueItem.content}": ${validityResult.is_valid ? 'valid' : 'invalid'}`);
        
    //     // Update the database with the validity result
    //     await getContent({
    //         id: queueItem.id,
    //         content: {
    //             ...queueItem,
    //             is_valid: validityResult.is_valid,
    //             valid_provider: validityResult.valid_provider
    //         }
    //     }, ITEM_TYPE.WORD);
    // }

    logger.success('Completed word validity check for all unvalidated words');
}

module.exports = {
    checkAllWordValidityWithOpenAI
};
