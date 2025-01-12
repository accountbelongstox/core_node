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

        return /[a-zA-Z]/.test(word) ? word : null;

    } catch (error) {
        log.error('Error validating word:', error);
        return null;
    }
}


function validateSentence(text) {
    try {
        if (!text || typeof text !== 'string') {
            return null;
        }

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

        return /[a-zA-Z]/.test(text) ? text : ``;

    } catch (error) {
        log.error('Error validating sentence:', error);
        return ``;
    }
}


function cleanWord(word) {
    try {
        if (!word || typeof word !== 'string') {
            return '';
        }

        word = word.trim();

        const hasLetters = /[a-zA-Z]/.test(word);

        const hasNumbers = /[0-9]/.test(word);

        if (hasLetters && hasNumbers) {
            return word.replace(/[^a-zA-Z0-9]/g, '');
        }

        if (hasLetters) {
            word = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
            
            word = word
                .replace(/['']/g, "'")
                .replace(/[""]/g, '"')
                .replace(/[–—]/g, '-');
            
            return word.replace(/[^a-zA-Z'\-]/g, '');
        }

        return trimPunctuation(word);

    } catch (error) {
        log.error('Error cleaning word:', error);
        return '';
    }
}

function cleanSentence(sentence) {
    try {
        if (!sentence || typeof sentence !== 'string') {
            return '';
        }

        sentence = sentence.trim()
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ');

        if (!/[a-zA-Z]/.test(sentence)) {
            return '';
        }

        return sentence;
    } catch (error) {
        log.error('Error cleaning sentence:', error);
        return '';
    }
}


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

function toFileName(sentence, maxLength = 16) {
    try {
        if (!sentence || typeof sentence !== 'string') {
            return '';
        }

        let fileName = sentence
            .replace(/[^a-zA-Z0-9]/g, '_')
            .toUpperCase()
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        if (fileName.length > maxLength) {
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

function replaceSpaceToDash(text) {
    text = text.trim();
    return text.replace(/\s+/g, '-');
}

const generateMd5 = getMd5

// Check if all items are numbers
function isAllNumbers(...inputs) {
    // Flatten all inputs into a single array
    const items = inputs.reduce((acc, input) => {
        if (Array.isArray(input)) {
            return acc.concat(input);
        }
        return acc.concat([input]);
    }, []);

    return items.length > 0 && items.every(item => 
        typeof item === 'number' && !isNaN(item)
    );
}

// Check if all items are strings
function isAllStrings(...inputs) {
    // Flatten all inputs into a single array
    const items = inputs.reduce((acc, input) => {
        if (Array.isArray(input)) {
            return acc.concat(input);
        }
        return acc.concat([input]);
    }, []);

    return items.length > 0 && items.every(item => 
        typeof item === 'string'
    );
}

// Check if no items are undefined
function hasNoUndefined(...inputs) {
    // Flatten all inputs into a single array
    const items = inputs.reduce((acc, input) => {
        if (Array.isArray(input)) {
            return acc.concat(input);
        }
        return acc.concat([input]);
    }, []);

    return items.length > 0 && items.every(item => 
        item !== undefined
    );
}

module.exports = {
    trimString,
    getMd5,
    generateMd5,
    validateWord,
    validateSentence,
    cleanWord,
    cleanSentence,
    trimPunctuation,
    toFileName,
    replaceSpaceToDash,
    isAllNumbers,
    isAllStrings,
    hasNoUndefined
}; 