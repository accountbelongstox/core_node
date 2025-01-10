const path = require('path');
const folderTool = require('../../tool/folder.js');
const reader = require('../../tool/reader.js');
const { cleanWord, cleanSentence } = require('./libs/string.js');

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



function getUniqueContentLines(dirPath, extensions = null) {
    try {
        const files = folderTool.getFilesAtDepth(dirPath);
        if (!files || !files.length) {
            log.warn(`No files found in directory: ${dirPath}`);
            return [];
        }

        const uniqueLines = new Set();

        files.forEach(filePath => {
            if (extensions) {
                const ext = path.extname(filePath).toLowerCase();
                if (!extensions.includes(ext)) {
                    log.info(`Skipping file with unsupported extension: ${filePath}`);
                    return;
                }
            }

            try {
                const lines = reader.readLines(filePath);
                if (!lines) {
                    log.warn(`Could not read lines from file: ${filePath}`);
                    return;
                }

                lines.forEach(line => {
                    const trimmedLine = cleanSentence(cleanWord(line.trim()));
                    if (trimmedLine) {
                        uniqueLines.add(trimmedLine);
                    }
                });

                log.success(`Processed file: ${filePath}`);

            } catch (error) {
                log.error(`Error processing file ${filePath}:`, error);
            }
        });

        const result = Array.from(uniqueLines);
        log.info(`Found ${result.length} unique lines from ${files.length} files`);
        return result;

    } catch (error) {
        log.error(`Error in getUniqueContentLines for ${dirPath}:`, error);
        return [];
    }
}

module.exports = {
    getUniqueContentLines
}; 