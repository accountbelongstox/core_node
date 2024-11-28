import { createQueueItem, ItemType } from './createQueueItem.js';
import logger from '../../../../ncore/utils/logger/index.js';

// Global queues
const WORD_QUEUE = [];
const SENTENCE_QUEUE = [];

/**
 * Add word to front of queue
 * @param {string} content 
 * @param {Object} [options] 
 * @returns {boolean}
 */
function addWordFront(content, options = {}) {
    try {
        const item = createQueueItem(content, ItemType.WORD, options);
        WORD_QUEUE.unshift(item);
        logger.info(`Word added to front: ${content}`);
        return true;
    } catch (error) {
        logger.error('Error adding word to front:', error);
        return false;
    }
}

/**
 * Add word to back of queue
 * @param {string} content 
 * @param {Object} [options] 
 * @returns {boolean}
 */
function addWordBack(content, options = {}) {
    try {
        const item = createQueueItem(content, ItemType.WORD, options);
        WORD_QUEUE.push(item);
        logger.info(`Word added to back: ${content}`);
        return true;
    } catch (error) {
        logger.error('Error adding word to back:', error);
        return false;
    }
}

/**
 * Add sentence to front of queue
 * @param {string} content 
 * @param {Object} [options] 
 * @returns {boolean}
 */
function addSentenceFront(content, options = {}) {
    try {
        const item = createQueueItem(content, ItemType.SENTENCE, options);
        SENTENCE_QUEUE.unshift(item);
        logger.info(`Sentence added to front: ${content}`);
        return true;
    } catch (error) {
        logger.error('Error adding sentence to front:', error);
        return false;
    }
}

/**
 * Add sentence to back of queue
 * @param {string} content 
 * @param {Object} [options] 
 * @returns {boolean}
 */
function addSentenceBack(content, options = {}) {
    try {
        const item = createQueueItem(content, ItemType.SENTENCE, options);
        SENTENCE_QUEUE.push(item);
        logger.info(`Sentence added to back: ${content}`);
        return true;
    } catch (error) {
        logger.error('Error adding sentence to back:', error);
        return false;
    }
}

/**
 * Check if content exists in word queue
 * @param {string} content 
 * @returns {boolean}
 */
function hasWord(content) {
    return WORD_QUEUE.some(item => item.content === content.trim());
}

/**
 * Check if content exists in sentence queue
 * @param {string} content 
 * @returns {boolean}
 */
function hasSentence(content) {
    return SENTENCE_QUEUE.some(item => item.content === content.trim());
}

export {
    addWordFront,
    addWordBack,
    addSentenceFront,
    addSentenceBack,
    hasWord,
    hasSentence,
    // Export queues for direct access if needed
    WORD_QUEUE,
    SENTENCE_QUEUE
}; 