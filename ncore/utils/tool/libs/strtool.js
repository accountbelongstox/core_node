const crypto = require('crypto');
// const pako = require('pako');

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

const { v4: uuidv4 } = require('uuid');

function createString(length = 10) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return result;
}

function generateUUID() {
    return uuidv4();
}

function createPhone() {
    const operators = [
        '134', '135', '136', '137', '138', '139', '147', '150', '151', '152',
        '157', '158', '159', '178', '182', '183', '184', '187', '188'
    ];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    return operator + createNumber(8);
}

function createNumber(length = 8) {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return result;
}

// function unpress(compressedString) {
//     return pako.inflate(atob(compressedString), { to: 'string' });
// }

// JSON handling functions
function isJsonString(jsonStr) {
    if (typeof jsonStr !== 'string') {
        return false;
    }
    jsonStr = jsonStr.trim();
    if (jsonStr.length === 0) {
        return false;
    }
    const firstChar = jsonStr[0];
    if (!['{', '"'].includes(firstChar)) {
        return false;
    }
    try {
        JSON.parse(jsonStr);
        return true;
    } catch {
        return false;
    }
}

// Data type conversion functions
function toString(data, indent = 2) {
    if (Buffer.isBuffer(data)) {
        return data.toString('utf-8');
    }
    if (typeof data === 'string' || typeof data === 'number') {
        return data.toString().replace(/\\/g, '/').replace(/`/g, '"').replace(/\x00/g, '');
    } else if (data === null) {
        return 'null';
    } else if (data === true) {
        return 'true';
    } else if (data === false) {
        return 'false';
    } else if (data instanceof Date) {
        return data.toISOString().replace('T', ' ').replace(/\..*$/, '');
    } else if (Array.isArray(data)) {
        return `[${data.map(item => toString(item, indent)).join(', ')}]`;
    } else if (typeof data === 'object') {
        try {
            return JSON.stringify(data, null, indent);
        } catch (error) {
            return data.toString ? data.toString() : String(data);
        }
    } else {
        return String(data);
    }
}

function to_boolean(value) {
    if (!value) return false;
    if (typeof value === 'string') {
        value = value.trim().toLowerCase();
        if (['', 'false', 'null', '0'].includes(value)) return false;
    } else if (Array.isArray(value) && value.length === 0) {
        return false;
    } else if (typeof value === 'object' && Object.keys(value).length === 0) {
        return false;
    }
    return true;
}

// String cleaning and validation functions
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

function trimLeft(str) {
    return str.replace(/^[^a-zA-Z0-9]+/, '');
}

function trim(str) {
    return str.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
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

        word = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        word = word.trim();
        const hasLetters = /[a-zA-Z]/.test(word);

        if (hasLetters) {
            word = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
            word = word
                .replace(/\"+/g, "'")
                .replace(/\'+/g, "'")
                .replace(/\s+/g, ' ')
                .replace(/\-+/g, '-');
            return word.replace(/[^a-zA-Z'\-]/g, '');
        }else{
            return ``;
        }
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

function generateMd5(word) {
    if (typeof word === 'string') {
        word = word.trim();
    } else {
        word = ``;
    }
    return crypto.createHash('md5').update(word).digest('hex');
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


function isStr(value) {
    return typeof value === 'string' || value instanceof String;
}

// URL handling
function extractHttpUrl(str) {
    const regex = /(?:https?|ftp):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
    const match = regex.exec(str);
    return match ? match[0] : '';
}

// Export all functions
module.exports = {
    generateUUID,
    createString,
    generateMd5,
    createPhone,
    createNumber,
    isJsonString,
    toString,
    to_boolean,
    trimString,
    trimLeft,
    trim,
    validateWord,
    validateSentence,
    cleanWord,
    cleanSentence,
    trimPunctuation,
    toFileName,
    replaceSpaceToDash,
    isStr,
    extractHttpUrl,
};