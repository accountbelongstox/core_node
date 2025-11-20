// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('fs');
const path = require('path');
const log = require('#@logger');
const {
    isFileProcessed,
    ensureTokenDirectory
} = require('../basetool/token_file.js');

const { VOCABULARY_TABLE_DIR } = require('../provider/baseDir/BaseDirProvider.js');
const TOKEN_DIR = path.join(VOCABULARY_TABLE_DIR, 'tokens');

let totalFilesToProcess = 0;
let processedFiles = 0;

// Global map to store file contents
const fileContentMap = new Map();
const notExistsWords = new Set();
const existsWords = new Set();
/**
 * Count total files to process in directory
 * @param {string} dir - Directory to scan
 * @param {string[]} extensions - Optional file extensions to filter
 */
const countFiles = (dir, extensions = null) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            countFiles(fullPath, extensions);
        } else if (item.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            if (!extensions || extensions.includes(ext)) {
                totalFilesToProcess++;
            }
        }
    }
};

/**
 * Process single file and store its content in fileContentMap
 * @param {string} filePath - Path of file to process
 */
const processFile = async (filePath) => {
    // Skip if file is already processed
    if (isFileProcessed(filePath, TOKEN_DIR) >= 0) {
        return;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line);
        const namespace = path.basename(filePath).replace(/\.[^.]+$/, '');
        // Store lines in global map
        fileContentMap.set(namespace, lines);
        processedFiles++;

    } catch (error) {
        log.error(`[Content] Error processing file ${filePath}: ${error.message}`);
    }
};

/**
 * Recursively process directory
 * @param {string} currentPath - Current directory path
 * @param {string[]} extensions - Optional file extensions to filter
 */
const processDirectory = async (currentPath, extensions = null) => {
    const items = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(currentPath, item.name);
        if (item.isDirectory()) {
            await processDirectory(fullPath, extensions);
        } else if (item.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            if (!extensions || extensions.includes(ext)) {
                await processFile(fullPath);
            }
        }
    }
};

/**
 * Get unique content lines from files in directory
 * @param {string} dirPath - Directory path to scan
 * @param {string[]} extensions - Optional file extensions to filter
 * @returns {Promise<string[]>} Array of unique content lines
 */
async function getUniqueContentLines(dirPath, extensions = null) {
    ensureTokenDirectory(TOKEN_DIR);
    // Clear the map before starting new process
    fileContentMap.clear();
    totalFilesToProcess = 0;
    processedFiles = 0;

    // Pre-scan directory to count files
    countFiles(dirPath, extensions);
    log.info(`[Content] Found ${totalFilesToProcess} files to process`);

    await processDirectory(dirPath, extensions);

    // Print namespaces and total lines
    log.info('Processing namespaces:');
    let totalLines = 0;
    for (const [filePath, lines] of fileContentMap.entries()) {
        totalLines += lines.length;
        log.info(`Namespace: ${filePath}, Lines: ${lines.length}`);
    }

    // Process lines for each namespace
    for (const [namespace, lines] of fileContentMap.entries()) {
        log.info(`Processing namespace: ${namespace}`);
        for (const line of lines) {
            if (!notExistsWords.has(line)) {
                notExistsWords.add(line);
            } else {
                existsWords.add(line);
            }
        }
    }

    // Process notExistsWords in batches of 1000
    const wordsArray = Array.from(notExistsWords);
    const sliceNotExistsWords = wordsArray.slice(0, 100);

    // Log total statistics
    log.success(`Total processed files: ${processedFiles}/${totalFilesToProcess}`);
    log.success(`Total lines processed: ${totalLines}`);
    log.warn(`Not exists words: ${sliceNotExistsWords.join(', ')}`);
    log.success(`Not exists words: ${notExistsWords.size}`);
    log.success(`Exists words: ${existsWords.size}`);
    return wordsArray
}


module.exports = {
    getUniqueContentLines
}; 