const crypto = require('crypto');
function hasString(value) {
    return typeof value === 'string' && value.trim() !== '';
}
function getMd5(word) {
    if (typeof word === 'string') {
        word = word.trim();
    }else{
        word = ``;
    }
    word = word.replace(/\W+/g, '');
    try {
        return crypto.createHash('md5').update(word).digest('hex');
    } catch (error) {
        log.error('Error generating MD5:', error);
        return '';
    }
}
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

const ITEM_TYPE = {
    WORD: 'word',
    SENTENCE: 'sentence'
};

let wordQueue = [];
let sentenceQueue = [];
let wordMap = new Map();
let sentenceMap = new Map();

function createQueueItem(content, type) {
    return {
        content: content.trim(),
        addedTime: Date.now(),
        type,
        md5: getMd5(content.trim()),
        retries: 0
    };
}

function addWordFront(word) {
    if (Array.isArray(word)) {
        let success = true;
        word.forEach(item => {
            if (!addWordFront(item)) success = false;
        });
        return success;
    }
    if (!hasString(word)) return false;
    const trimmedWord = word.trim();
    if (hasWord(trimmedWord)) return false;

    const item = createQueueItem(trimmedWord, ITEM_TYPE.WORD);
    wordQueue.unshift(item);
    wordMap.set(trimmedWord, item);
    return true;
}

function addWordBack(word) {
    if (Array.isArray(word)) {
        let success = true;
        word.forEach(item => {
            if (!addWordBack(item)) success = false;
        });
        return success;
    }
    if (!hasString(word)) return false;
    const trimmedWord = word.trim();
    if (hasWord(trimmedWord)) return false;

    const item = createQueueItem(trimmedWord, ITEM_TYPE.WORD);
    wordQueue.push(item);
    wordMap.set(trimmedWord, item);
    return true;
}

function addSentenceFront(sentence) {
    if (Array.isArray(sentence)) {
        let success = true;
        sentence.forEach(item => {
            if (!addSentenceFront(item)) success = false;
        });
        return success;
    }
    if (!hasString(sentence)) return false;
    const trimmedSentence = sentence.trim();
    if (hasSentence(trimmedSentence)) return false;

    const item = createQueueItem(trimmedSentence, ITEM_TYPE.SENTENCE);
    sentenceQueue.unshift(item);
    sentenceMap.set(trimmedSentence, item);
    return true;
}

function addSentenceBack(sentence) {
    if (Array.isArray(sentence)) {
        let success = true;
        sentence.forEach(item => {
            if (!addSentenceBack(item)) success = false;
        });
        return success;
    }
    if (!hasString(sentence)) return false;
    const trimmedSentence = sentence.trim();
    if (hasSentence(trimmedSentence)) return false;

    const item = createQueueItem(trimmedSentence, ITEM_TYPE.SENTENCE);
    sentenceQueue.push(item);
    sentenceMap.set(trimmedSentence, item);
    return true;
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

function hasWord(word) {
    return wordMap.has(word.trim());
}

function hasSentence(sentence) {
    return sentenceMap.has(sentence.trim());
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
    getSentenceBack
};
