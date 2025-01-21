const logger = require('#@logger');
const path = require('path');
const fs = require('fs');
const { get7zExecutable } = require('#@/ncore/gvar/bdir.js');
const { pipeExecCmd } = require('#@commander');
const { calculateSize, formatSize } = require('./task_zutils');
const { 
    EXPECTED_EXTENSION_MARKER,
    generateTargetPath,
    calculateStats,
    buildCommandArgs,
    DEFAULT_CONFIG
} = require('./compressor_util');

// File extensions that should be stored without compression
const STORE_ONLY_EXTENSIONS = [
    '.zip', '.7z', '.rar',  // Already compressed archives
    '.docx', '.xlsx', '.pptx',  // Office files (internally compressed)
    '.3gp', '.avi', '.bik', '.mkv', '.mov', '.mp4', '.rm', '.rmvb', '.wmv',  // Video files
    '.aac', '.flac', '.mp3', '.ogg', '.wav',  // Audio files
    '.jpg', '.jpeg', '.png', '.gif', '.webp',  // Image files
    '.pak'  // Game package files
];

/**
 * Split file into chunks
 * @param {string} sourcePath - Source file path
 * @param {string} targetPath - Base target path
 * @param {string} splitSize - Split size (e.g., '1G', '100M')
 * @returns {Promise<string[]>} List of chunk files
 */
async function splitFile(sourcePath, targetPath, splitSize) {
    const exe7z = await get7zExecutable();
    if (!exe7z) {
        throw new Error('7z executable not found');
    }

    const baseDir = path.dirname(targetPath);
    const baseName = path.basename(targetPath, '.7z');
    
    // Create split command
    const cmd = `"${exe7z}" a "${targetPath}" "${sourcePath}" -v${splitSize}`;
    await pipeExecCmd(cmd);

    // Get list of created chunks
    const files = fs.readdirSync(baseDir);
    return files
        .filter(f => f.startsWith(baseName + '.'))
        .map(f => path.join(baseDir, f));
}

/**
 * Check if a file should be stored without compression
 * @param {string} filePath - Path to the file
 * @returns {boolean} Whether the file should be stored without compression
 */
function shouldStore(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return STORE_ONLY_EXTENSIONS.includes(ext);
}

/**
 * Scan directory for files that should be stored without compression
 * @param {string} sourcePath - Source directory path
 * @returns {string[]} List of files to store without compression
 */
function scanDirectory(sourcePath) {
    const storeList = [];
    const files = fs.readdirSync(sourcePath, { recursive: true });
    
    for (const file of files) {
        const filePath = path.join(sourcePath, file.toString());
        if (shouldStore(filePath)) {
            storeList.push(filePath);
        }
    }
    
    return storeList;
}

/**
 * Create temporary file with list of files to store
 * @param {string[]} storeList - List of files to store
 * @param {string} targetPath - Target archive path
 * @returns {string|null} Path to temporary file or null
 */
function createStoreListFile(storeList, targetPath) {
    if (storeList.length === 0) return null;
    
    const tempFile = path.join(path.dirname(targetPath), '_store_list.txt');
    fs.writeFileSync(tempFile, storeList.join('\n'));
    return tempFile;
}

/**
 * Execute best compression with advanced options for single file
 * @param {string} sourcePath - Source file path
 * @param {string} [targetPath] - Target archive path (optional)
 * @param {Object} [options] - Compression options
 * @param {string} [options.splitSize] - Split size (e.g., '1G', '100M')
 * @param {string} [options.expectedExt] - Expected extension for the file
 * @returns {Promise<Object>} Compression result
 */
async function compress(sourcePath, targetPath, options = {}) {
    try {
        // Get 7z executable
        const exe7z = await get7zExecutable();
        if (!exe7z) {
            throw new Error('7z executable not found');
        }

        // Generate final target path
        const finalTargetPath = generateTargetPath(sourcePath, targetPath, options.expectedExt);
        
        // Calculate source size
        const sourceSize = calculateSize(sourcePath);
        logger.info(`Source size: ${formatSize(sourceSize)}`);

        // Build command arguments
        const args = buildCommandArgs(options, DEFAULT_CONFIG);
        
        if (options.splitSize) {
            // Split mode
            logger.info(`Splitting file into ${options.splitSize} chunks...`);
            const chunks = await splitFile(sourcePath, finalTargetPath, options.splitSize);
            
            const totalSize = chunks.reduce((sum, chunk) => sum + calculateSize(chunk), 0);
            return calculateStats(sourceSize, totalSize);
        } else {
            // Single file mode
            const cmd = `"${exe7z}" a -t7z "${finalTargetPath}" "${sourcePath}" -mx=9 -m${args}`;
            await pipeExecCmd(cmd);
            
            return calculateStats(sourceSize, calculateSize(finalTargetPath));
        }
    } catch (error) {
        logger.error('Compression failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    compress,
    shouldStore,
    STORE_ONLY_EXTENSIONS,
}; 