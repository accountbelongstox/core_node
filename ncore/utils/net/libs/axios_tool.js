const axios = require('axios');
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

async function getUrl(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        log.error('Error fetching URL:', error);
        return null;
    }
}

async function getJsonFromUrl(url) {
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (typeof data === 'object') {
            return data === null ? {
                success: false,
                __originalText: null
            } : data;
        }

        try {
            return JSON.parse(data);
        } catch (parseError) {
            if (data) {
                return {
                    success: false,
                    __originalText: data
                };
            }
            return {
                success: false,
                __originalText: data
            };
        }
    } catch (error) {
        log.error(`Error fetching JSON from URL: ${error.message}, url: ${url}`);
        return {
            success: false,
            __originalText: error.message
        };
    }
}

// GET request and return UTF-8 text
async function getTextFromUrl(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'text',
            responseEncoding: 'utf8'
        });
        return response.data;
    } catch (error) {
        log.error('Error fetching text from URL:', error);
        return ``;
    }
}

async function postWithoutTimeout(url, data) {
    try {
        const response = await axios.post(url, data, {
            timeout: 0, // No timeout limit
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        log.error('Error posting to URL:', error);
        return null;
    }
}

async function downloadFile(url, savePath, forceReplace = false) {
    try {
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const shouldDownload = forceReplace ||
            !fs.existsSync(savePath) ||
            fs.statSync(savePath).size === 0;

        if (!shouldDownload) {
            log.info('File already exists and not empty:', savePath);
            return savePath;
        }

        log.info('Downloading file from:', url);
        log.info('Saving to:', savePath);

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(savePath);
        response.data.pipe(writer);

        return new Promise((resolve) => {
            writer.on('finish', () => {
                log.success('Download completed:', savePath);
                resolve(savePath);
            });
            writer.on('error', (error) => {
                log.error('Error writing file:', error);
                resolve(null);
            });
        });
    } catch (error) {
        log.error('Error downloading file:', error);
        return null;
    }
}

module.exports = {
    getUrl,
    getJsonFromUrl,
    getTextFromUrl,
    postWithoutTimeout,
    downloadFile
};
