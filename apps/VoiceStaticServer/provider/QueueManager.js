const { ensureQueueItem, ITEM_TYPE } = require('./types');
let log;
try {
    const logger = require('#@logger');
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


let wordQueue = [];
let sentenceQueue = [];
let wordMap = new Map();
let sentenceMap = new Map();


function addWordFront(wordOrQueueItem) {
    if (Array.isArray(wordOrQueueItem)) {
        let success = true;
        wordOrQueueItem.forEach(item => {
            if (!addWordFront(item)) success = false;
        });
        return success;
    }
    const item = ensureQueueItem(wordOrQueueItem, ITEM_TYPE.WORD);
    wordQueue.unshift(item);
    wordMap.set(item.content, item.content);
    return true;
}

function addWordBack(wordOrQueueItem) {
    if (Array.isArray(wordOrQueueItem)) {
        let success = true;
        wordOrQueueItem.forEach(item => {
            if (!addWordBack(item)) success = false;
        });
        return success;
    }
    const item = ensureQueueItem(wordOrQueueItem, ITEM_TYPE.WORD);
    wordQueue.push(item);
    wordMap.set(item.content, item.content);
    return true;
}

function addSentenceFront(sentenceOrQueueItem   ) {
    if (Array.isArray(sentenceOrQueueItem)) {
        let success = true;
        sentenceOrQueueItem.forEach(item => {
            if (!addSentenceFront(item)) success = false;
        });
        return success;
    }
    const item = ensureQueueItem(sentenceOrQueueItem, ITEM_TYPE.SENTENCE);
    sentenceQueue.unshift(item);
    sentenceMap.set(item.content, item.content);
    return true;
}

function addSentenceBack(sentenceOrQueueItem) {
    if (Array.isArray(sentenceOrQueueItem)) {
        let success = true;
        sentenceOrQueueItem.forEach(item => {
            if (!addSentenceBack(item)) success = false;
        });
        return success;
    }
    const item = ensureQueueItem(sentenceOrQueueItem, ITEM_TYPE.SENTENCE);
    sentenceQueue.push(item);
    sentenceMap.set(item.content, item.content);
    return true;
}

function removeByWord(wordOrQueueItem) {
    if (!wordOrQueueItem) return false;
    
    const item = ensureQueueItem(wordOrQueueItem, ITEM_TYPE.WORD);
    if (!item) return false;

    const index = wordQueue.findIndex(queueItem => queueItem.content === item.content);
    if (index === -1) return false;

    wordQueue.splice(index, 1);
    wordMap.delete(item.content);
    return true;
}

function hasWord(wordOrQueueItem) {
    if (!wordOrQueueItem) return false;
    
    const item = ensureQueueItem(wordOrQueueItem, ITEM_TYPE.WORD);
    if (!item) return false;

    return wordMap.has(item.content);
}

function hasSentence(sentenceOrQueueItem) {
    if (!sentenceOrQueueItem) return false;
    
    const item = ensureQueueItem(sentenceOrQueueItem, ITEM_TYPE.SENTENCE);
    if (!item) return false;

    return sentenceMap.has(item.content);
}

function removeWordFront() {
    if (wordQueue.length === 0) return null;
    const item = wordQueue.shift();
    wordMap.delete(item.content);
    return item;
}

function removeWordBack() {
    if (wordQueue.length === 0) return null;
    const item = wordQueue.pop();
    wordMap.delete(item.content);
    return item;
}

function removeSentenceFront() {
    if (sentenceQueue.length === 0) return null;
    const item = sentenceQueue.shift();
    sentenceMap.delete(item.content);
    return item;
}

function removeSentenceBack() {
    if (sentenceQueue.length === 0) return null;
    const item = sentenceQueue.pop();
    sentenceMap.delete(item.content);
    return item;
}

function removeBySentence(sentenceOrQueueItem) {
    if (!sentenceOrQueueItem) return false;
    
    const item = ensureQueueItem(sentenceOrQueueItem, ITEM_TYPE.SENTENCE);
    if (!item) return false;

    const index = sentenceQueue.findIndex(queueItem => queueItem.content === item.content);
    if (index === -1) return false;

    sentenceQueue.splice(index, 1);
    sentenceMap.delete(item.content);
    return true;
}

function getWordCount() {
    return wordQueue.length;
}

function getSentenceCount() {
    return sentenceQueue.length;
}
const getWordFront = removeWordFront;
const getWordBack = removeWordBack;
const getSentenceFront = removeSentenceFront;
const getSentenceBack = removeSentenceBack;
module.exports = {
    ITEM_TYPE,
    ensureQueueItem,
    addWordFront,
    addWordBack,
    addSentenceFront,
    addSentenceBack,
    removeWordFront,
    removeWordBack,
    removeSentenceFront,
    removeSentenceBack,
    hasWord,
    hasSentence,
    getWordCount,
    getSentenceCount,
    getWordFront,
    getWordBack,
    getSentenceFront,
    getSentenceBack,
    removeByWord,
    removeBySentence
};
