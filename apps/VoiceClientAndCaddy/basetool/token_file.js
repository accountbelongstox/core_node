const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('#@logger');

/**
 * Generate file token using MD5 hash
 * @param {string} filePath - Path to the file
 * @returns {string} MD5 hash of the file content
 */
function generateFileToken(filePath) {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileContent).digest('hex');
}

/**
 * Get token file path for a given file
 * @param {string} filePath - Original file path
 * @param {string} tokenDir - Directory to store token files
 * @returns {string} Path to the token file
 */
function getTokenFilePath(filePath, tokenDir) {
    const fileName = path.basename(filePath);
    const tokenFileName = `${fileName}.token`;
    return path.join(tokenDir, tokenFileName);
}


function isFileProcessed(filePath, tokenDir) {
    const tokenFile = getTokenFilePath(filePath, tokenDir);
    if (!fs.existsSync(tokenFile)) return -1;
    
    try {
        const tokenContent = fs.readFileSync(tokenFile, 'utf8').trim().split('\n');
        if (tokenContent.length !== 2) {
            log.warn(`Invalid token file format for ${filePath}, removing token file`);
            fs.unlinkSync(tokenFile);
            return -1;
        }

        const [storedToken, lineCount] = tokenContent;
        const parsedLineCount = parseInt(lineCount);
        if (isNaN(parsedLineCount)) {
            log.warn(`Invalid line count in token file for ${filePath}, removing token file`);
            fs.unlinkSync(tokenFile);
            return -1;
        }

        const currentToken = generateFileToken(filePath);
        return storedToken === currentToken ? parsedLineCount : -1;
    } catch (error) {
        log.error(`Error reading token file for ${filePath}: ${error.message}`);
        try {
            fs.unlinkSync(tokenFile);
        } catch (e) {
        }
        return -1;
    }
}


function saveFileToken(filePath, tokenDir, lineCount) {
    const token = generateFileToken(filePath);
    const tokenFile = getTokenFilePath(filePath, tokenDir);
    fs.writeFileSync(tokenFile, `${token}\n${lineCount}`);
}

/**
 * Get the line count from a token file
 * @param {string} tokenFile - Path to the token file
 * @returns {number} Number of lines, or 0 if invalid
 */
function getLineCountFromToken(tokenFile) {
    try {
        const content = fs.readFileSync(tokenFile, 'utf8').trim().split('\n');
        if (content.length === 2) {
            const count = parseInt(content[1]);
            return isNaN(count) ? 0 : count;
        }
    } catch (error) {
        // Ignore read errors
    }
    return 0;
}

/**
 * Calculate total lines from all token files
 * @param {string} tokenDir - Directory containing token files
 * @returns {number} Total number of lines
 */
function calculateTotalLines(tokenDir) {
    try {
        if (!fs.existsSync(tokenDir)) return 0;

        const files = fs.readdirSync(tokenDir);
        let totalLines = 0;
        let validFiles = 0;

        files.forEach(file => {
            if (file.endsWith('.token')) {
                const tokenFile = path.join(tokenDir, file);
                const lineCount = getLineCountFromToken(tokenFile);
                totalLines += lineCount;
                if (lineCount > 0) validFiles++;
            }
        });

        log.info(`Total processed files: ${validFiles}`);
        log.info(`Total lines processed: ${totalLines}`);
        return totalLines;
    } catch (error) {
        log.error(`Error calculating total lines: ${error.message}`);
        return 0;
    }
}

/**
 * Ensure token directory exists
 * @param {string} tokenDir - Directory to ensure exists
 */
function ensureTokenDirectory(tokenDir) {
    if (!fs.existsSync(tokenDir)) {
        fs.mkdirSync(tokenDir, { recursive: true });
    }
}

module.exports = {
    generateFileToken,
    getTokenFilePath,
    isFileProcessed,
    saveFileToken,
    ensureTokenDirectory,
    calculateTotalLines
}; 