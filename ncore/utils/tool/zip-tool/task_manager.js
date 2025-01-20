const logger = require('#@logger');
const { calculateSize, formatSize, generateCompressTargetPath, generateExtractTargetPath, checkPathType, scanDirectorySize } = require('./zutils');
const state = require('./constants');
const { processQueue } = require('./executor');

/**
 * Set or update group callback
 * @param {string} groupName - Name of the group
 * @param {Function} callback - New callback function for the group
 */
function setGroupCallback(groupName, callback) {
    state.addGroup(groupName, callback);
}

/**
 * Prepare compression task parameters
 * @param {string} sourcePath - Source path
 * @param {string|Object} targetPath - Target path or options
 * @param {Object} options - Options
 * @param {Function} callback - Callback function
 * @param {string} type - Source type ('file' or 'directory')
 * @returns {Object} Normalized parameters and task info
 * @private
 */
function prepareCompressionTask(sourcePath, targetPath, options, callback, type) {
    // Normalize parameters
    let finalTargetPath, finalOptions, finalCallback;

    if (typeof targetPath === 'object') {
        finalTargetPath = null;
        finalOptions = targetPath || {};
        finalCallback = options;
    } else {
        finalTargetPath = targetPath;
        finalOptions = options || {};
        finalCallback = callback;
    }

    // Verify path exists and is correct type
    const pathCheck = checkPathType(sourcePath, type);
    if (!pathCheck.exists || (type === 'file' ? !pathCheck.isFile : pathCheck.isFile)) {
        const error = new Error(`Source path does not exist or is not a ${type}: ${sourcePath}`);
        if (typeof finalCallback === 'function') {
            finalCallback(false, error);
        }
        throw error;
    }

    // Get or calculate source size
    let sourceSize = finalOptions.sourceSize;
    let scanComplete = true;

    if (typeof sourceSize !== 'number') {
        if (type === 'file') {
            sourceSize = calculateSize(sourcePath);
            logger.info(`Source file size: ${formatSize(sourceSize)}`);
        } else {
            const scanResult = scanDirectorySize(sourcePath, finalOptions.scanTimeout || 5000);
            sourceSize = scanResult.size;
            scanComplete = scanResult.isComplete;
            logger.info(`Source directory ${scanComplete ? 'complete' : 'estimated'} size: ${formatSize(sourceSize)}`);
        }
    } else {
        logger.info(`Using provided source size: ${formatSize(sourceSize)}`);
    }

    // Store size info
    finalOptions.sourceSize = sourceSize;
    finalOptions.scanComplete = scanComplete;

    // Check size limit
    if (sourceSize > state.getMaxProcessingSize()) {
        if (!scanComplete) {
            logger.warn(`Size limit check based on estimated size: ${formatSize(sourceSize)}`);
        }
        const error = new Error(`Adding task would exceed size limit of ${formatSize(state.getMaxProcessingSize())}`);
        if (typeof finalCallback === 'function') {
            finalCallback(false, error);
        }
        throw error;
    }

    // Generate target path if not provided
    finalTargetPath = finalTargetPath || generateCompressTargetPath(sourcePath, finalOptions.extension || '.7z');
    const groupName = finalOptions.groupName || 'default';
    
    // Set or update group callback if provided
    if (finalOptions.groupCallback) {
        setGroupCallback(groupName, finalOptions.groupCallback);
    } else if (!state.getGroup(groupName)) {
        state.addGroup(groupName, null);
    }

    return {
        targetPath: finalTargetPath,
        options: finalOptions,
        callback: finalCallback,
        groupName,
        sourceSize,
        scanComplete
    };
}

/**
 * Add file compression task to queue
 * @param {string} filePath - Source file path to compress
 * @param {string|Object} [targetPath] - Target zip file path or options
 * @param {Object} [options] - Compression options
 * @param {boolean} [options.removeSource=false] - Remove source after compression
 * @param {string} [options.extension='.7z'] - Desired file extension for the compressed file
 * @param {string} [options.groupName='default'] - Group name for the task
 * @param {Function} [options.groupCallback] - Callback for the entire group
 * @param {number} [options.sourceSize] - Source file size in bytes (optional)
 * @param {Function} [callback] - Callback function
 * @returns {Promise<void>}
 */
async function addFileCompressionTask(filePath, targetPath, options, callback) {
    const taskInfo = prepareCompressionTask(filePath, targetPath, options, callback, 'file');
    const task = {
        type: 'compress',
        sourcePath: filePath,
        targetPath: taskInfo.targetPath,
        options: taskInfo.options,
        callback: taskInfo.callback,
        groupName: taskInfo.groupName,
        sourceType: 'file',
        sourceSize: taskInfo.sourceSize,
        scanComplete: taskInfo.scanComplete
    };

    state.addToQueue(task);
    logger.info(`Added file compression task: ${filePath} (${formatSize(taskInfo.sourceSize)}) -> ${taskInfo.targetPath} (Group: ${taskInfo.groupName})`);

    if (!state.isProcessing()) {
        await processQueue();
    }
}

/**
 * Add directory compression task to queue
 * @param {string} dirPath - Source directory path to compress
 * @param {string} targetPath - Target zip file path
 * @param {Object} [options] - Compression options
 * @param {boolean} [options.removeSource=false] - Remove source after compression
 * @param {string} [options.extension='.7z'] - Desired file extension for the compressed file
 * @param {string} [options.groupName='default'] - Group name for the task
 * @param {Function} [options.groupCallback] - Callback for the entire group
 * @param {number} [options.scanTimeout=5000] - Timeout for directory size scanning in milliseconds
 * @param {number} [options.sourceSize] - Source directory size in bytes (optional)
 * @param {Function} [options.callback] - Individual task callback function
 * @returns {Promise<void>}
 */
async function addDirectoryCompressionTask(dirPath, targetPath, options = {}) {
    // Normalize options with defaults
    const normalizedOptions = {
        removeSource: false,
        extension: '.7z',
        groupName: 'default',
        groupCallback: null,
        scanTimeout: 5000,
        sourceSize: null,
        callback: null,
        ...options
    };

    const taskInfo = prepareCompressionTask(dirPath, targetPath, normalizedOptions, normalizedOptions.callback, 'directory');
    const task = {
        type: 'compress',
        sourcePath: dirPath,
        targetPath: taskInfo.targetPath,
        options: taskInfo.options,
        callback: taskInfo.callback,
        groupName: taskInfo.groupName,
        sourceType: 'directory',
        sourceSize: taskInfo.sourceSize,
        scanComplete: taskInfo.scanComplete
    };

    state.addToQueue(task);
    logger.info(`Added directory compression task: ${dirPath} (${formatSize(taskInfo.sourceSize)}) -> ${taskInfo.targetPath} (Group: ${taskInfo.groupName})`);

    if (!state.isProcessing()) {
        await processQueue();
    }
}

/**
 * Add extraction task to queue
 * @param {string} zipPath - Path to zip file
 * @param {string|Object} [targetPath] - Target extraction path or options
 * @param {Object|Function} [options] - Extraction options or callback
 * @param {Function} [callback] - Callback function
 * @returns {Promise<void>}
 */
async function addExtractionTask(zipPath, targetPath, options, callback) {
    // Normalize parameters
    let finalTargetPath, finalOptions, finalCallback;

    if (typeof targetPath === 'object') {
        finalTargetPath = null;
        finalOptions = targetPath || {};
        finalCallback = options;
    } else {
        finalTargetPath = targetPath;
        finalOptions = options || {};
        finalCallback = callback;
    }

    // Generate target path if not provided
    finalTargetPath = finalTargetPath || generateExtractTargetPath(zipPath);
    const groupName = finalOptions.groupName || 'default';
    
    // Set or update group callback if provided
    if (finalOptions.groupCallback) {
        setGroupCallback(groupName, finalOptions.groupCallback);
    } else if (!state.getGroup(groupName)) {
        state.addGroup(groupName, null);
    }

    const task = {
        type: 'extract',
        zipPath,
        targetPath: finalTargetPath,
        options: finalOptions,
        callback: finalCallback,
        groupName
    };

    state.addToQueue(task);
    logger.info(`Added extraction task: ${zipPath} -> ${finalTargetPath} (Group: ${groupName})`);

    if (!state.isProcessing()) {
        await processQueue();
    }
}

// Maintain backward compatibility
async function addCompressionTask(sourcePath, targetPath, options, callback) {
    const pathCheck = checkPathType(sourcePath);
    if (pathCheck.isFile) {
        return addFileCompressionTask(sourcePath, targetPath, options, callback);
    } else {
        return addDirectoryCompressionTask(sourcePath, targetPath, { ...options, callback });
    }
}

module.exports = {
    addFileCompressionTask,
    addDirectoryCompressionTask,
    addCompressionTask,
    addExtractionTask,
    setGroupCallback
}; 