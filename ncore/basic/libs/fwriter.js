const fs = require('fs');
const path = require('path');
const logger = require('#@logger');


/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {boolean}
 */
function exists(filePath) {
    return fs.existsSync(filePath);
}

/**
 * Write content to file
 * @param {string} filePath - Target file path
 * @param {string|Buffer} content - Content to write
 * @param {Object} [options] - Write options
 * @param {boolean} [options.createDir=false] - Create directory if not exists
 * @param {string} [options.encoding='utf8'] - File encoding
 * @param {boolean} [options.overwrite=true] - Overwrite if file exists
 * @returns {Object|null} Result with file path and size, or null if failed
 */
function write(filePath, content, options = {}) {
    try {
        const {
            createDir = false,
            overwrite = true
        } = options;

        // Check if file exists
        if (fs.existsSync(filePath) && !overwrite) {
            logger.warn(`File exists and overwrite is disabled: ${filePath}`);
            return null;
        }

        // Create directory if needed
        if (createDir) {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Write file
        fs.writeFileSync(filePath, content, { encoding: 'utf8' });
        const size = Buffer.isBuffer(content) ? content.length : Buffer.from(content).length;

        return {
            fpath: filePath,
            size
        };
    } catch (error) {
        logger.error(`Error writing file ${filePath}:`, error);
        return null;
    }
}

/**
 * Append content to file
 * @param {string} filePath - Target file path
 * @param {string|Buffer} content - Content to append
 * @param {Object} [options] - Append options
 * @param {boolean} [options.createDir=false] - Create directory if not exists
 * @param {string} [options.encoding='utf8'] - File encoding
 * @returns {Object|null} Result with file path and size, or null if failed
 */
function append(filePath, content, options = {}) {
    try {
        const {
            createDir = false,
        } = options;

        // Create directory if needed
        if (createDir) {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Append to file
        fs.appendFileSync(filePath, content, { flag: 'a', mode: 0o666, encoding: 'utf8' });
        const stats = fs.statSync(filePath);

        return {
            fpath: filePath,
            size: stats.size
        };
    } catch (error) {
        logger.error(`Error appending to file ${filePath}:`, error);
        return null;
    }
}

/**
 * Write JSON content to file
 * @param {string} filePath - Target file path
 * @param {*} content - Content to write as JSON
 * @param {Object} [options] - Write options
 * @param {boolean} [options.createDir=false] - Create directory if not exists
 * @param {boolean} [options.pretty=false] - Pretty print JSON
 * @param {boolean} [options.forceEmpty=false] - Write empty object if content is invalid
 * @returns {Object|null} Result with file path and size, or null if failed
 */
function writeJson(filePath, content, options = {}) {
    try {
        const {
            createDir = false,
            pretty = false,
            forceEmpty = false
        } = options;

        let jsonContent;
        try {
            jsonContent = pretty ? 
                JSON.stringify(content, null, 2) : 
                JSON.stringify(content);
        } catch (error) {
            if (!forceEmpty) {
                throw error;
            }
            jsonContent = '{}';
            logger.warn(`Invalid JSON content, writing empty object to ${filePath}`);
        }

        const writeResult = write(filePath, jsonContent, {
            createDir
        });

        if (writeResult) {
            return {
                fpath: filePath,
                size: writeResult.size,
                content: jsonContent
            };
        }
        return null;
    } catch (error) {
        logger.error(`Error writing JSON to file ${filePath}:`, error);
        return null;
    }
}

/**
 * Write lines to file
 * @param {string} filePath - Target file path
 * @param {string[]} lines - Lines to write
 * @param {Object} [options] - Write options
 * @param {boolean} [options.createDir=false] - Create directory if not exists
 * @param {string} [options.encoding='utf8'] - File encoding
 * @param {string} [options.eol='\n'] - End of line character
 * @returns {Object|null} Result with file path and size, or null if failed
 */
function writeLines(filePath, lines, options = {}) {
    try {
        const {
            createDir = false,
            encoding = 'utf8',
            eol = '\n'
        } = options;

        const content = lines.join(eol);
        const writeResult = write(filePath, content, {
            createDir
        });

        if (writeResult) {
            return {
                fpath: filePath,
                size: writeResult.size,
                lineCount: lines.length
            };
        }
        return null;
    } catch (error) {
        logger.error(`Error writing lines to file ${filePath}:`, error);
        return null;
    }
}

module.exports = {
    write,
    append,
    writeJson,
    writeLines,
    exists
}; 