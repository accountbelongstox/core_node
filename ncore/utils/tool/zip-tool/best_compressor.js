const logger = require('#@logger');
const path = require('path');
const fs = require('fs');
const { get7zExecutable } = require('#@/ncore/gvar/bdir.js');
const { pipeExecCmd } = require('#@/ncore/gvar/tool/common/cmder.js');
const { calculateSize, formatSize } = require('./zutils');
const state = require('./constants');

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
 * Default compression configuration
 */
const DEFAULT_CONFIG = {
    algorithm: 'LZMA2',
    dictionarySize: '512M',  // 512MB dictionary
    wordSize: 64,
    solidBlockSize: '4G',
    compressionLevel: 'Ultra',
    threadCount: 'auto'
};

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
 * Build 7z command line arguments
 * @param {Object} options - Compression options
 * @returns {string} Command line arguments
 */
function buildCommandArgs(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };
    const args = [
        `m0=${config.algorithm}`,
        `d=${config.dictionarySize}`,
        `mw=${config.wordSize}`,
        `s=${config.solidBlockSize}`,
        'hc-'  // Disable header compression for better stability
    ];

    if (config.threadCount !== 'auto') {
        args.push(`mt${config.threadCount}`);
    }

    return args.join(' -m');
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
 * Build complete 7z command
 * @param {string} exe7z - Path to 7z executable
 * @param {string} sourcePath - Source path
 * @param {string} targetPath - Target path
 * @param {string} args - Command arguments
 * @param {string|null} storeListFile - Path to store list file
 * @returns {string} Complete command
 */
function buildCommand(exe7z, sourcePath, targetPath, args, storeListFile) {
    let cmd = `"${exe7z}" a -t7z "${targetPath}" "${sourcePath}" -mx=9 -m${args}`;
    if (storeListFile) {
        cmd += ` -mx0@"${storeListFile}"`;
    }
    return cmd;
}

/**
 * Calculate compression statistics
 * @param {number} sourceSize - Original size
 * @param {number} resultSize - Compressed size
 * @returns {Object} Compression statistics
 */
function calculateStats(sourceSize, resultSize) {
    const ratio = ((resultSize / sourceSize) * 100).toFixed(2);
    
    logger.success(`Compression completed successfully:
- Original size: ${formatSize(sourceSize)}
- Compressed size: ${formatSize(resultSize)}
- Compression ratio: ${ratio}%`);

    return {
        success: true,
        sourceSize,
        resultSize,
        ratio: parseFloat(ratio)
    };
}

/**
 * Execute best compression
 * @param {string} sourcePath - Source file/folder path
 * @param {string} targetPath - Target archive path
 * @param {Object} options - Compression options
 * @returns {Promise<Object>} Compression result
 */
async function compress(sourcePath, targetPath, options = {}) {
    let tempStoreListFile = null;
    
    try {
        // Get 7z executable
        const exe7z = await get7zExecutable();
        if (!exe7z) {
            throw new Error('7z executable not found');
        }

        // Calculate source size
        const sourceSize = calculateSize(sourcePath);
        logger.info(`Source size: ${formatSize(sourceSize)}`);

        // Build command arguments
        const args = buildCommandArgs(options);
        
        // Get list of files to store without compression
        const storeList = fs.statSync(sourcePath).isDirectory() 
            ? scanDirectory(sourcePath)
            : (shouldStore(sourcePath) ? [path.basename(sourcePath)] : []);

        // Create temporary store list file if needed
        tempStoreListFile = createStoreListFile(storeList, targetPath);

        // Build and execute command
        const cmd = buildCommand(exe7z, sourcePath, targetPath, args, tempStoreListFile);
        logger.info('Starting compression with best settings...');
        await pipeExecCmd(cmd);

        // Calculate and return statistics
        return calculateStats(sourceSize, calculateSize(targetPath));

    } catch (error) {
        logger.error('Compression failed:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        // Clean up temporary file
        if (tempStoreListFile) {
            try {
                fs.unlinkSync(tempStoreListFile);
            } catch (error) {
                logger.warn('Failed to clean up temporary file:', error);
            }
        }
    }
}

module.exports = {
    compress,
    shouldStore,
    buildCommandArgs,
    scanDirectory,
    DEFAULT_CONFIG,
    STORE_ONLY_EXTENSIONS
}; 