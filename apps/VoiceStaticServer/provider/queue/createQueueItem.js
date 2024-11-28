
let sequence = 0;
function processQuotes(content) {
    if (content.includes('"')) {
        content = content.replace(/"/g, '');
    }
    if (content.includes("'")) {
        return `"${content}"`;
    }
    return content;
}

/**
 * Sanitize word string
 * @param {string} word 
 * @returns {string}
 */
function sanitizeWord(word) {
    word = word.trim();
    if (!word) {
        return "";
    }
    return processQuotes(word);
}
/**
 * Create a queue item with minimal required parameters
 * @param {string} content - The word or sentence content
 * @param {Object} [options={}] - Optional parameters
 * @param {boolean} [options.liteMode=false] - Whether to use lite mode
 * @param {number} [options.sequence] - Custom sequence number
 * @param {number} [options.addedTime] - Custom timestamp
 * @returns {Object} Queue item data
 */
export function createQueueItem(content, itemType = "word", options = {}) {
    if (!content || typeof content !== 'string') {
        throw new Error('Content is required and must be a string');
    }

    content = sanitizeWord(content)
    sequence++;
    
    return {
        content: content,
        sequence: options.sequence || sequence,
        addedTime: options.addedTime || Date.now(),
        itemType: itemType,
        liteMode: options.liteMode || false
    };
}
