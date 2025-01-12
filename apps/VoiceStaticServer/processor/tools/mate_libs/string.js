const crypto = require('crypto');
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

function trimString(input) {
    try {
        if (typeof input === 'string') {
            return input.trim();
        }
        
        if (typeof input === 'object' && input !== null) {
            const result = {};
            for (const key in input) {
                if (typeof input[key] === 'string') {
                    result[key] = input[key].trim();
                } else {
                    result[key] = input[key];
                }
            }
            return result;
        }
        
        return input;
    } catch (error) {
        log.error('Error in trimString:', error);
        return input;
    }
}

function getMd5(word) {
    if (typeof word === 'string') {
        word = word.trim();
    } else {
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

/**
 * Validate and clean English word
 */
function validateWord(word) {
    try {
        if (!word || typeof word !== 'string') {
            return null;
        }

        word = word.trim()
            .replace(/['']/g, "'")
            .replace(/[""]/g, '"')
            .replace(/[–—]/g, '-')
            .replace(/[^a-zA-Z0-9'\-]/g, '');

        // Check if contains English letters
        return /[a-zA-Z]/.test(word) ? word : null;

    } catch (error) {
        log.error('Error validating word:', error);
        return null;
    }
}

/**
 * Validate and clean English sentence
 */
function validateSentence(text) {
    try {
        if (!text || typeof text !== 'string') {
            return null;
        }

        // Clean and normalize punctuation
        text = text.trim()
            .replace(/['']/g, "'")
            .replace(/[""]/g, '"')
            .replace(/[–—]/g, '-')
            .replace(/[。]/g, '.')
            .replace(/[，]/g, ',')
            .replace(/[！]/g, '!')
            .replace(/[？]/g, '?')
            .replace(/[^a-zA-Z0-9\s.,!?'"()\-]/g, ' ')
            .replace(/\s+/g, ' ');

        // Check if contains English letters
        return /[a-zA-Z]/.test(text) ? text : ``;

    } catch (error) {
        log.error('Error validating sentence:', error);
        return ``;
    }
}

/**
 * Clean word to contain only letters and numbers
 * @param {string} word - Input word
 * @returns {string} - Cleaned word or empty string
 */
function cleanWord(word) {
    try {
        if (!word || typeof word !== 'string') {
            return '';
        }

        // Initial trim
        word = word.trim();

        const hasLetters = /[a-zA-Z]/.test(word);

        const hasNumbers = /[0-9]/.test(word);

        // Case 1: Has both letters and numbers
        if (hasLetters && hasNumbers) {
            return word.replace(/[^a-zA-Z0-9]/g, '');
        }

        if (hasLetters) {
            word = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
            
            word = word
                .replace(/['']/g, "'")
                .replace(/[""]/g, '"')
                .replace(/[–—]/g, '-');
            
            // Keep only allowed internal punctuation
            return word.replace(/[^a-zA-Z'\-]/g, '');
        }

        // Case 3: No letters
        return trimPunctuation(word);

    } catch (error) {
        log.error('Error cleaning word:', error);
        return '';
    }
}

/**
 * Clean sentence to contain only letters, numbers and spaces
 * @param {string} sentence - Input sentence
 * @returns {string} - Cleaned sentence or empty string
 */
function cleanSentence(sentence) {
    try {
        if (!sentence || typeof sentence !== 'string') {
            return '';
        }

        // Remove non-alphanumeric chars (except spaces) and normalize spaces
        sentence = sentence.trim()
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ');

        // Check if contains at least one letter
        if (!/[a-zA-Z]/.test(sentence)) {
            return '';
        }

        return sentence;
    } catch (error) {
        log.error('Error cleaning sentence:', error);
        return '';
    }
}

/**
 * Remove punctuation marks from both ends of text
 * @param {string} text - Input text
 * @returns {string} - Text with punctuation removed from ends
 */
function trimPunctuation(text) {
    try {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            .trim()
            .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

    } catch (error) {
        log.error('Error trimming punctuation:', error);
        return text;
    }
}
/**
 * Convert sentence to valid filename
 * @param {string} sentence - Input sentence
 * @param {number} maxLength - Maximum length of filename (default: 16)
 * @returns {string} - Valid filename
 */
function toFileName(sentence, maxLength = 16) {
    try {
        if (!sentence || typeof sentence !== 'string') {
            return '';
        }

        let fileName = sentence
            // Step 1: Replace invalid characters with underscore
            .replace(/[^a-zA-Z0-9]/g, '_')
            // Step 2: Convert to uppercase
            .toUpperCase()
            // Step 3: Remove consecutive underscores
            .replace(/_+/g, '_')
            // Remove leading/trailing underscores
            .replace(/^_+|_+$/g, '');

        // Step 4: Truncate to maxLength
        if (fileName.length > maxLength) {
            // If ends with underscore after truncating, remove it
            fileName = fileName
                .substring(0, maxLength)
                .replace(/_+$/g, '');
        }

        return fileName;
    } catch (error) {
        log.error('Error converting to filename:', error);
        return sentence;
    }
}

const generateMd5 = getMd5

module.exports = {
    trimString,
    getMd5,
    generateMd5,
    validateWord,
    validateSentence,
    cleanWord,
    cleanSentence,
    trimPunctuation,
    toFileName
}; 