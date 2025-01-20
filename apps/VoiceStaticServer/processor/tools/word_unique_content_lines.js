const fs = require('fs');
const path = require('path');
const log = require('#@logger');
const { formatDurationToStr } = require('#@/ncore/utils/tool/libs/datetool.js');
const {
    insertContent,
    insertContentArray
} = require('../../db-apply/libs/db_insert');
const { hasContentInCache } = require('../../db-apply/libs/db_content_check');
const { getContentCount } = require('../../db-apply/libs/db_query');
const { ensureQueueItem } = require('../../provider/types/index.js');
const { initialize } = require('../../db-apply/init/db_init');
const { ITEM_TYPE } = require('../../db-apply/db-tools/db_utils.js');
const {
    isFileProcessed,
    saveFileToken,
    ensureTokenDirectory
} = require('./libs/token_file.js');

const { VOCABULARY_TABLE_DIR } = require('../../provider/index');
const TOKEN_DIR = path.join(VOCABULARY_TABLE_DIR, 'tokens');

let totalFilesToProcess = 0;
let processedFiles = 0;

// Global map to store file contents
const fileContentMap = new Map();
const notExistsWords = new Map();
const existsWords = new Map();
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
    await initialize();

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
            const wordQueueItem = await ensureQueueItem(line, ITEM_TYPE.WORD);
            const exists = await hasContentInCache(wordQueueItem.content, ITEM_TYPE.WORD, null, true);
            if (!exists) {
                notExistsWords.set(wordQueueItem.content, wordQueueItem);
            } else {
                existsWords.set(wordQueueItem.content, wordQueueItem.content);
            }
        }
    }

    // Process notExistsWords in batches of 1000
    const wordsArray = Array.from(notExistsWords.values()).map(item => item.content);
    const wordsArrayLength = wordsArray.length;
    const batchSize = 1000;
    let totalInserted = 0;
    const startTime = Date.now();
    const sliceNotExistsWords = wordsArray.slice(0, 100);

    // Log total statistics
    log.success(`Total processed files: ${processedFiles}/${totalFilesToProcess}`);
    log.success(`Total lines processed: ${totalLines}`);
    log.warn(`Not exists words: ${sliceNotExistsWords.join(', ')}`);
    log.success(`Not exists words: ${notExistsWords.size}`);
    log.success(`Exists words: ${existsWords.size}`);

    for (let i = 0; i < wordsArray.length; i += batchSize) {
        const batchStartTime = Date.now();
        const batch = wordsArray.slice(i, i + batchSize);

        const insertedItems = await insertContentArray(batch, ITEM_TYPE.WORD);
        const batchEndTime = Date.now();

        // Count successful insertions (items with id)
        const successCount = insertedItems.filter(item => item && item.id).length;
        totalInserted += successCount;

        // Show progress bar with batch information
        const currentBatch = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(wordsArray.length / batchSize);
        const progressFormat = `Inserting words: [{bar}] {percentage}% | {current}/{total} | ` +
            `Batch: ${currentBatch}/${totalBatches} | ` +
            `Batch time: ${formatDurationToStr(batchEndTime - batchStartTime)} | ` +
            `Total time: ${formatDurationToStr(batchEndTime - startTime)} | ` +
            `Success: ${successCount}/${batch.length}`;

        log.progressBar(i + batch.length, wordsArrayLength, {
            format: progressFormat
        });
    }

    // Clear the progress bar
    log.clearRefresh();

    const endTime = Date.now();
    log.success(`Total insertion completed in ${formatDurationToStr(endTime - startTime)}`);
    log.success(`Total successfully inserted: ${totalInserted}/${wordsArrayLength}`);

    // Return all unique lines from database
    return await getContentCount(ITEM_TYPE.WORD);
}


module.exports = {
    getUniqueContentLines
}; 