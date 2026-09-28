'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');
const crypto = require('crypto');
const fsPromises = require('fs').promises;
const fsStatPromises = util.promisify(fs.stat);
const accessPromises = util.promisify(fs.access);
const prefix = 'FWriter';
let logger;
let isDebug = false;
try {
    logger = require('#@logger');
    isDebug = logger.isDebug;
} catch (error) {
    logger = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: isDebug ? (...args) => console.debug('[DEBUG]', ...args) : () => { },
    };
}
let heDecode;
let iconv;
let chardet;
try {
    chardet = require('chardet');
    iconv = require('iconv-lite');
    const { decode } = require('he');
    heDecode = decode;
} catch (error) {
    console.error('Error decoding:', error);
}
let CACHE_EXPIRE = 1000 * 60 * 60 * 24;
/**
 * Forces text to be correctly encoded in the specified character encoding.
 * @param {string|Buffer} text - Input text to be processed
 * @param {string} encoding - Target encoding (e.g., 'utf8', 'gbk', 'gb2312', 'big5')
 * @returns {string} Text in the specified encoding
 */
function forceToEncode(text, encoding = 'utf8') {
    if (!heDecode || !iconv) {
        logger.debug(`${prefix} forceToEncode: Required libraries (heDecode/iconv) not available`);
        return text;
    }

    try {
        let str;
        if (Buffer.isBuffer(text)) {
            str = text.toString('binary'); // Preserve raw bytes
        } else if (typeof text === 'string') {
            str = text;
        } else {
            str = String(text);
        }

        // Decode HTML entities first
        str = heDecode(str);

        // Skip conversion if already in correct encoding
        if (!isValidEncoding(str, encoding)) {
            // Try to decode from binary using specified encoding
            str = iconv.decode(Buffer.from(str, 'binary'), encoding);
        }

        return str;
    } catch (error) {
        log.error(`Error forceToEncode (${encoding}):`, error);
        return text;
    }
}

/**
 * Checks if text is valid in the specified encoding
 * @param {string} text - Text to validate
 * @param {string} encoding - Encoding to validate against
 * @returns {boolean} True if text is valid in the specified encoding
 */
function isValidEncoding(text, encoding) {
    if (encoding === 'utf8') {
        return Buffer.from(text, 'utf8').toString('utf8') === text;
    }
    try {
        const encoded = iconv.encode(text, encoding);
        const decoded = iconv.decode(encoded, encoding);
        return decoded === text;
    } catch (e) {
        return false;
    }
}

function mkdir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

class FWriter {


    async exists(fPath) {
        return fs.existsSync(fPath);
    }

    saveText(file_path, text, encoding = "utf-8", replace = false) {
        encoding = encoding.toLowerCase();
        if (fs.existsSync(file_path) && !replace) {
            logger.warn(`${prefix} saveText: ${file_path} already exists, skip`);
            return false;
        } else {
            fs.writeFileSync(file_path, text, { flag: 'wx', encoding });
        }
        return file_path
    }

    saveCacheJSON(file_path, json_text, expire = CACHE_EXPIRE, baseDir = null) {
        if(typeof json_text != 'string'){
            try {
                json_text = JSON.stringify(json_text);
            } catch (error) {
                logger.error(`${prefix} saveCacheJSON: ${file_path}`, error);
                return false;
            }
        }
        return this.saveCacheText(file_path, json_text, 'utf-8', expire, baseDir);
    }

    saveCacheText(file_path, text, encoding = "utf-8", expire = CACHE_EXPIRE, baseDir = null) {
        encoding = encoding.toLowerCase();
        const fullpath = baseDir && !path.isAbsolute(file_path)
            ? path.resolve(baseDir, file_path)
            : path.resolve(file_path);
        let oldCacheUptime = 0;
        if(fs.existsSync(fullpath)){
            oldCacheUptime = fs.statSync(fullpath).mtimeMs;
        }
        const isExpired = Date.now() - oldCacheUptime > expire;
        if(oldCacheUptime && !isExpired){
            logger.debug(`${prefix} saveCache: ${fullpath} is not expired, skip`);
            return false;
        }
        mkdir(path.dirname(fullpath));
        try {
            fs.writeFileSync(fullpath, text, { encoding });
        } catch (error) {
            logger.error(`${prefix} saveCache: ${fullpath} write failed: ${error.code || error.message}`);
            return false;
        }
        logger.debug(`${prefix} saveCache: ${fullpath} saved`);
        return fullpath
    }

    saveTextForceEncoding(file_path, text, encoding = "utf-8", replace = false) {
        encoding = encoding.toLowerCase();
        if (!isValidEncoding(text, encoding)) {
            text = forceToEncode(text, encoding);
        }
        const fullpath = path.resolve(file_path);
        const basedir = path.dirname(fullpath);
        mkdir(basedir);
        if (fs.existsSync(file_path) && !replace) {
            logger.warn(`${prefix} saveText: ${file_path} already exists, skip`);
            return false;
        } else {
            fs.writeFileSync(file_path, text, { flag: 'wx', encoding });
        }
        return file_path
    }

    saveJSON(file_name, json_text) {
        if (typeof json_text != 'string') {
            try {
                json_text = JSON.stringify(json_text);
            } catch (error) {
                logger.error(`${prefix} saveJSON: ${file_name}`, error);
                return false;
            }
        }
        let dirname = path.dirname(file_name)
        logger.debug(`${prefix} saveJSON: ${file_name}`)
        mkdir(dirname)
        fs.writeFileSync(file_name, json_text, 'utf-8');
    }

    isLocked(fPath) {
        if (fs.existsSync(fPath)) {
            if (this.isDir(fPath)) {
                return this.isDirectoryLocked(fPath)
            } else {
                return this.isFileLocked(fPath)
            }
        }
        return false
    }

    isFileLocked(filePath) {
        if (!fs.existsSync(filePath)) {
            return false
        }
        try {
            const fd = fs.openSync(filePath, 'r+');
            fs.closeSync(fd);
            return false;
        } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                return true;
            }
            return false
        }
    }

    isDirectoryLocked(dirPath) {
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            return false;
        }

        const tempName = path.join(path.dirname(dirPath), `temp_${Date.now()}_${path.basename(dirPath)}`);
        try {
            fs.renameSync(dirPath, tempName);
            fs.renameSync(tempName, dirPath);
            return false;
        } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                return true;
            }
            return false;
        }
    }
}
module.exports = new FWriter();