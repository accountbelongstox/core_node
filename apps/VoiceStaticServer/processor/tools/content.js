const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('#@/ncore/utils/logger/index.js');

const { VOCABULARY_TABLE_DIR } = require('../../provider/index');
const TOKEN_DIR = path.join(VOCABULARY_TABLE_DIR, 'tokens');
const UNIFIED_CONTENT_FILE = path.join(VOCABULARY_TABLE_DIR, 'unified_content.json');

// In-memory cache for unified content
let contentCache = null;
let hasChanges = false;

// Ensure required directories exist
function ensureDirectories() {
    [VOCABULARY_TABLE_DIR, TOKEN_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Generate file token using MD5 hash
function generateFileToken(filePath) {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileContent).digest('hex');
}

// Get token file path for a given file
function getTokenFilePath(filePath) {
    const fileName = path.basename(filePath);
    const tokenFileName = `${fileName}.token`;
    return path.join(TOKEN_DIR, tokenFileName);
}

// Check if file has been processed and unchanged
function isFileProcessed(filePath) {
    const tokenFile = getTokenFilePath(filePath);
    if (!fs.existsSync(tokenFile)) return false;
    
    const storedToken = fs.readFileSync(tokenFile, 'utf8').trim();
    const currentToken = generateFileToken(filePath);
    return storedToken === currentToken;
}

// Save file token to mark as processed
function saveFileToken(filePath) {
    const token = generateFileToken(filePath);
    const tokenFile = getTokenFilePath(filePath);
    fs.writeFileSync(tokenFile, token);
}

// Read unified content file into memory
function readUnifiedContent() {
    if (contentCache !== null) {
        return new Set(contentCache);
    }

    try {
        if (!fs.existsSync(UNIFIED_CONTENT_FILE)) {
            contentCache = [];
            return new Set();
        }
        const content = fs.readFileSync(UNIFIED_CONTENT_FILE, 'utf8');
        contentCache = JSON.parse(content);
        return new Set(contentCache);
    } catch (error) {
        log.error(`[Content] Error reading unified content: ${error.message}`);
        contentCache = [];
        return new Set();
    }
}

// Save content to file if there are changes
function saveUnifiedContent() {
    if (!hasChanges) return;

    try {
        fs.writeFileSync(UNIFIED_CONTENT_FILE, JSON.stringify(contentCache, null, 2));
        log.info(`[Content] Saved unified content to file | Total lines: ${contentCache.length} by ${UNIFIED_CONTENT_FILE}`);
        hasChanges = false;
    } catch (error) {
        log.error(`[Content] Error saving unified content: ${error.message}`);
    }
}

// Add new lines to unified content
function appendToUnifiedContent(newLines, existingLines) {
    const uniqueNewLines = newLines.filter(line => !existingLines.has(line.trim()));
    if (uniqueNewLines.length > 0) {
        contentCache = Array.from(new Set([...contentCache, ...uniqueNewLines]));
        hasChanges = true;
        log.info(`[Content] Added ${uniqueNewLines.length} new unique lines to memory cache`);
    }
    return uniqueNewLines;
}

/**
 * Get unique content lines from files in directory
 * @param {string} dirPath - Directory path to scan
 * @param {string[]} extensions - Optional file extensions to filter (e.g., ['.txt', '.md'])
 * @returns {string[]} Array of unique content lines
 */
function getUniqueContentLines(dirPath, extensions = null) {
    ensureDirectories();
    
    // Load existing unified content
    const existingLines = readUnifiedContent();
    log.info(`[Content] Loaded ${existingLines.size} existing lines from cache`);
    
    const processFile = (filePath) => {
        // Skip if file is already processed and unchanged
        if (isFileProcessed(filePath)) {
            log.info(`[Content] Skipping already processed file: ${filePath}`);
            return;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !existingLines.has(line));

            if (lines.length > 0) {
                appendToUnifiedContent(lines, existingLines);
                lines.forEach(line => existingLines.add(line));
            }

            // Save file token for future change detection
            saveFileToken(filePath);
            log.info(`[Content] Processed file: ${filePath} | New lines: ${lines.length}`);
        } catch (error) {
            log.error(`[Content] Error processing file ${filePath}: ${error.message}`);
        }
    };

    const processDirectory = (currentPath) => {
        const items = fs.readdirSync(currentPath, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(currentPath, item.name);
            
            if (item.isDirectory()) {
                processDirectory(fullPath);
            } else if (item.isFile()) {
                const ext = path.extname(fullPath).toLowerCase();
                if (!extensions || extensions.includes(ext)) {
                    processFile(fullPath);
                }
            }
        }
    };

    processDirectory(dirPath);
    
    // Save changes to file if any
    saveUnifiedContent();
    
    // Return all unique lines
    return contentCache;
}

// Clean up function to ensure content is saved
function cleanup() {
    saveUnifiedContent();
}

module.exports = {
    getUniqueContentLines,
    cleanup
}; 