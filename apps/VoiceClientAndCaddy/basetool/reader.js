const fs = require('fs');
const path = require('path');

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

// Default character encodings to try
const defaultEncodings = [
    "utf-8", "utf-16", "utf-16le", "utf-16BE", "gbk", "gb2312", "us-ascii", "ascii",
    "IBM037", "IBM437", "IBM500", "ASMO-708", "DOS-720", "ibm737", "ibm775", "ibm850",
    "ibm852", "IBM855", "ibm857", "IBM00858", "IBM860", "ibm861", "DOS-862", "IBM863",
    "IBM864", "IBM865", "cp866", "ibm869", "IBM870", "windows-874", "cp875", "shift_jis",
    "ks_c_5601-1987", "big5", "IBM1026", "IBM01047", "IBM01140", "IBM01141", "IBM01142",
    "IBM01143", "IBM01144", "IBM01145", "IBM01146", "IBM01147", "IBM01148", "IBM01149",
    "windows-1250", "windows-1251", "Windows-1252", "windows-1253", "windows-1254",
    "windows-1255", "windows-1256", "windows-1257", "windows-1258", "Johab", "macintosh",
    "x-mac-japanese", "x-mac-chinesetrad", "x-mac-korean", "x-mac-arabic", "x-mac-hebrew",
    "x-mac-greek", "x-mac-cyrillic", "x-mac-chinesesimp", "x-mac-romanian", "x-mac-ukrainian",
    "x-mac-thai", "x-mac-ce", "x-mac-icelandic", "x-mac-turkish", "x-mac-croatian", "utf-32",
    "utf-32BE", "x-Chinese-CNS", "x-cp20001", "x-Chinese-Eten", "x-cp20003", "x-cp20004",
    "x-cp20005", "x-IA5", "x-IA5-German", "x-IA5-Swedish", "x-IA5-Norwegian", "x-cp20261",
    "x-cp20269", "IBM273", "IBM277", "IBM278", "IBM280", "IBM284", "IBM285", "IBM290",
    "IBM297", "IBM420", "IBM423", "IBM424", "x-EBCDIC-KoreanExtended", "IBM-Thai", "koi8-r",
    "IBM871", "IBM880", "IBM905", "IBM00924", "EUC-JP", "x-cp20936", "x-cp20949", "cp1025",
    "koi8-u", "iso-8859-1", "iso-8859-2", "iso-8859-3", "iso-8859-4", "iso-8859-5",
    "iso-8859-6", "iso-8859-7", "iso-8859-8", "iso-8859-9", "iso-8859-13", "iso-8859-15",
    "x-Europa", "iso-8859-8-i", "iso-2022-jp", "csISO2022JP", "iso-2022-kr", "x-cp50227",
    "euc-jp", "EUC-CN", "euc-kr", "hz-gb-2312", "GB18030", "x-iscii-de", "x-iscii-be",
    "x-iscii-ta", "x-iscii-te", "x-iscii-as", "x-iscii-or", "x-iscii-ka", "x-iscii-ma",
    "x-iscii-gu", "x-iscii-pa", "utf-7"
];


/**
 * Read file content with multiple encoding attempts
 */
function readWithEncoding(filePath, encoding = null, info = false) {
    filePath = getAbsolutePath(filePath);
    const encodingsToTry = encoding ? [encoding, ...defaultEncodings] : defaultEncodings;

    for (const enc of encodingsToTry) {
        try {
            const content = fs.readFileSync(filePath, { encoding: enc });
            if (info) {
                log.info(`Successfully read ${filePath} with ${enc} encoding`);
            }
            return { content: content.toString(), encoding: enc };
        } catch (error) {
            if (info) {
                log.warn(`Failed to read with ${enc} encoding:`, error.message);
            }
        }
    }

    return ``;
}

/**
 * Other utility functions
 */
function readText(filePath, encoding = 'utf-8', info = false) {
    filePath = getAbsolutePath(filePath);
    const result = readWithEncoding(filePath, encoding, info);
    return result ? result.content : ``;
}

function readLines(filePath, encoding = 'utf-8', info = false) {
    filePath = getAbsolutePath(filePath);
    const content = readText(filePath, encoding, info);
    return content ? content.split('\n') : null;
}

function readFirstLine(filePath, encoding = 'utf-8', info = false) {
    filePath = getAbsolutePath(filePath);
    const lines = readLines(filePath, encoding, info);
    return lines && lines.length > 0 ? lines[0] : '';
}

function readJson(filePath, encoding = 'utf-8', info = false) {
    filePath = getAbsolutePath(filePath);
    const content = readText(filePath, encoding, info);
    log.info(filePath);
    log.info(content);
    if (content) {
        try {
            return JSON.parse(content);
        } catch (error) {
            log.error(`Failed to parse JSON from ${filePath}:`, error.message);
        }
    }
    return {};
}

function isFile(filePath) {
    filePath = getAbsolutePath(filePath);
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (error) {
        return false;
    }
}

function isDirectory(dirPath) {
    dirPath = getAbsolutePath(dirPath);
    try {
        return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch (error) {
        return false;
    }
}

function getFileSize(filePath) {
    filePath = getAbsolutePath(filePath);
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

function isReadable(filePath) {
    filePath = getAbsolutePath(filePath);
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch (error) {
        return false;
    }
}

function readInChunks(filePath, chunkSize = 1024, callback) {
    filePath = getAbsolutePath(filePath);
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, {
            highWaterMark: chunkSize
        });

        stream.on('data', chunk => {
            callback(chunk);
        });

        stream.on('end', () => {
            resolve();
        });

        stream.on('error', error => {
            reject(error);
        });
    });
}

function watchFile(filePath, callback) {
    filePath = getAbsolutePath(filePath);
    return fs.watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
            callback(filename);
        }
    });
}

function getAbsolutePath(inputPath) {
    let absolutePath = inputPath;
    try {
        if (path.isAbsolute(inputPath)) {
            absolutePath = path.normalize(inputPath);
        } else {
            absolutePath = path.resolve(inputPath);
        }
        absolutePath = path.normalize(absolutePath);
    } catch (error) {
        log.error('Error getting absolute path:', error);
    }
    return absolutePath;
}

module.exports = {
    readWithEncoding,
    readText,
    readLines,
    readFirstLine,
    readJson,
    isFile,
    isDirectory,
    getFileSize,
    isReadable,
    readInChunks,
    watchFile,
    getAbsolutePath
};
