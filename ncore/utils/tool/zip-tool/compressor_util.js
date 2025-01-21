const path = require('path');
const fs = require('fs');
const logger = require('#@logger');
const { calculateSize, formatSize } = require('./task_zutils');

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
 * Extension marker for expected file extension
 * Used to mark and later extract the expected extension from compressed filename
 * Format: .expected_ext_marker.{extension}
 */
const EXPECTED_EXTENSION_MARKER = '.expected_ext_marker';

/**
 * Generate target path with extension marking
 * @param {string} sourcePath - Source file path
 * @param {string} targetPath - Target path (optional)
 * @param {string} expectedExt - Expected extension (optional)
 * @returns {string} Final target path
 */
function generateTargetPath(sourcePath, targetPath, expectedExt) {
    if (!targetPath) {
        targetPath = sourcePath + '.7z';
    }
    
    if (expectedExt) {
        targetPath = targetPath.replace(/\.7z$/, `${EXPECTED_EXTENSION_MARKER}${expectedExt}.7z`);
    }
    
    return targetPath;
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
 * Build 7z command line arguments
 * @param {Object} options - Compression options
 * @param {Object} defaultConfig - Default configuration
 * @returns {string} Command line arguments
 */
function buildCommandArgs(options = {}, defaultConfig) {
    const config = { ...defaultConfig, ...options };
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
 * Get original filename by removing extension marker and expected extension
 * @param {string} compressedPath - Path to compressed file
 * @returns {string} Original filename without marker and expected extension
 */
function getOriginalFileName(compressedPath) {
    const fileName = path.basename(compressedPath);
    const markerIndex = fileName.indexOf(EXPECTED_EXTENSION_MARKER);
    if (markerIndex !== -1) {
        return fileName.substring(0, markerIndex);
    }
    return fileName;
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


module.exports = {
    EXPECTED_EXTENSION_MARKER,
    generateTargetPath,
    calculateStats,
    buildCommandArgs,
    getOriginalFileName,
    buildCommand,
    DEFAULT_CONFIG
}; 