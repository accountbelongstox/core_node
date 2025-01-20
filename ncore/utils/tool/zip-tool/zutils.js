const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('#@logger');
const { pipeExecCmd } = require('#@commander');
const { get7zExecutable } = require('#@bdir');

/**
 * Get system resource usage
 * @returns {Object} System resource usage information
 */
function getSystemUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = process.memoryUsage();

    return {
        cpu: os.loadavg()[0].toFixed(2),
        memory: {
            total: (totalMem / 1024 / 1024).toFixed(2) + 'MB',
            used: (usedMem / 1024 / 1024).toFixed(2) + 'MB',
            free: (freeMem / 1024 / 1024).toFixed(2) + 'MB',
            percentage: ((usedMem / totalMem) * 100).toFixed(2) + '%',
            heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
            heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB'
        }
    };
}

/**
 * Print task summary
 * @param {Object} task - Completed task
 * @param {number} startTime - Task start timestamp
 * @param {Array} queue - Current task queue
 */
function printTaskSummary(task, startTime, queue) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const systemUsage = getSystemUsage();
    const groupTasks = queue.filter(t => t.groupName === task.groupName);
    const groupProgress = {
        total: groupTasks.length + 1,
        remaining: groupTasks.length,
        completed: 1
    };

    logger.info('\n=== Task Summary ===');
    logger.info(`Task Type: ${task.type}`);
    logger.info(`Group: ${task.groupName}`);
    logger.info(`Time Elapsed: ${elapsedTime}s`);
    
    logger.info('\n=== Queue Status ===');
    logger.info(`Total Tasks in Queue: ${queue.length}`);
    logger.info(`Group Progress: ${groupProgress.completed}/${groupProgress.total}`);
    logger.info(`Group Tasks Remaining: ${groupProgress.remaining}`);
    
    logger.info('\n=== System Usage ===');
    logger.info(`CPU Load: ${systemUsage.cpu}`);
    logger.info(`Memory Usage: ${systemUsage.memory.percentage}`);
    logger.info(`Memory Details:`);
    logger.info(`  Total: ${systemUsage.memory.total}`);
    logger.info(`  Used: ${systemUsage.memory.used}`);
    logger.info(`  Free: ${systemUsage.memory.free}`);
    logger.info(`  Heap Used: ${systemUsage.memory.heapUsed}`);
    logger.info(`  Heap Total: ${systemUsage.memory.heapTotal}`);
    logger.info('==================\n');
}

/**
 * Generate automatic target path for compression
 * @param {string} sourcePath - Source path
 * @param {string} [extension='.7z'] - Target file extension
 * @returns {string} Target zip path
 */
function generateCompressTargetPath(sourcePath, extension = '.7z') {
    const sourceExt = path.extname(sourcePath);
    const baseName = path.basename(sourcePath, sourceExt);
    const parentDir = path.dirname(sourcePath);
    return path.join(parentDir, `${baseName}${extension}`);
}

/**
 * Generate automatic target path for extraction
 * @param {string} zipPath - Zip file path
 * @returns {string} Target extraction path
 */
function generateExtractTargetPath(zipPath) {
    const ext = path.extname(zipPath);
    const baseName = path.basename(zipPath, ext);
    const parentDir = path.dirname(zipPath);
    return path.join(parentDir, baseName);
}

/**
 * Calculate total size of a file or directory
 * @param {string} itemPath - Path to file or directory
 * @returns {number} Total size in bytes
 */
function calculateSize(itemPath) {
    try {
        const stats = fs.statSync(itemPath);
        if (stats.isFile()) {
            return stats.size;
        }
        if (stats.isDirectory()) {
            let totalSize = 0;
            const items = fs.readdirSync(itemPath);
            for (const item of items) {
                const subPath = path.join(itemPath, item);
                totalSize += calculateSize(subPath);
            }
            return totalSize;
        }
        return 0;
    } catch (error) {
        logger.error(`Error calculating size for ${itemPath}:`, error);
        return 0;
    }
}

/**
 * Format size in bytes to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)}${units[unitIndex]}`;
}

/**
 * Compress file or directory using 7z
 */
async function compress(sourcePath, targetPath) {
    const sevenZipPath = await get7zExecutable();
    if (!sevenZipPath) {
        throw new Error('7z binary not found');
    }

    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Build 7z command
    const cmd = [
        sevenZipPath,
        'a',           // Add to archive
        '-tzip',       // ZIP format
        '-mx=9',       // Maximum compression
        '-mmt=on',     // Multi-threading on
        '-y',          // Yes to all queries (overwrite)
        targetPath,    // Output file
        sourcePath     // Input path
    ].join(' ');

    try {
        const output = await pipeExecCmd(cmd);
        logger.success('7z compression completed successfully');
        return true;
    } catch (error) {
        throw new Error(`Failed to execute 7z process: ${error.message}`);
    }
}

/**
 * Extract zip file using 7z
 */
async function extractFile(zipPath, targetPath) {
    const sevenZipPath = await get7zExecutable();
    if (!sevenZipPath) {
        throw new Error('7z binary not found');
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }

    // Build 7z command
    const cmd = [
        sevenZipPath,
        'x',           // Extract with full paths
        '-y',          // Yes to all queries (overwrite)
        '-aoa',        // Overwrite all existing files
        '-o' + targetPath,  // Output directory
        zipPath       // Input file
    ].join(' ');

    try {
        const output = await pipeExecCmd(cmd);
        logger.success('7z extraction completed successfully');
        return true;
    } catch (error) {
        throw new Error(`Failed to execute 7z process: ${error.message}`);
    }
}

/**
 * Scan directory size with timeout
 * @param {string} dirPath - Directory path to scan
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {{size: number, isComplete: boolean}} Size in bytes and scan completion status
 */
function scanDirectorySize(dirPath, timeout = 5000) {
    let totalSize = 0;
    let fileCount = 0;
    let isComplete = true;
    let timeoutReached = false;

    const startTime = Date.now();

    function scan(currentPath) {
        if (timeoutReached) return;

        const items = fs.readdirSync(currentPath);
        for (const item of items) {
            if (timeoutReached) return;

            const itemPath = path.join(currentPath, item);
            const stats = fs.statSync(itemPath);
            fileCount++;

            if (stats.isFile()) {
                totalSize += stats.size;
            } else if (stats.isDirectory()) {
                scan(itemPath);
            }

            // Check timeout
            if (Date.now() - startTime > timeout) {
                timeoutReached = true;
                isComplete = false;
                return;
            }
        }
    }

    try {
        scan(dirPath);

        // If scan was incomplete, estimate total size
        if (!isComplete) {
            const avgFileSize = totalSize / fileCount;
            // Estimate based on directory structure and partial scan
            const estimatedTotal = avgFileSize * fileCount * 1.5; // Add 50% margin
            totalSize = Math.ceil(estimatedTotal);
            logger.warn(`Scan timeout reached. Estimated size: ${formatSize(totalSize)} based on ${fileCount} files`);
        }

        return { size: totalSize, isComplete };
    } catch (error) {
        logger.error(`Error scanning directory: ${error.message}`);
        return { size: 0, isComplete: false };
    }
}

/**
 * Check if path is a file or directory with type detection
 * @param {string} itemPath - Path to check
 * @param {string} [type] - Force type check ('file' or 'directory')
 * @returns {{isFile: boolean, exists: boolean}} Check results
 */
function checkPathType(itemPath, type) {
    try {
        const stats = fs.statSync(itemPath);
        
        if (type) {
            // If type is specified, validate against it
            if (type === 'file' && !stats.isFile()) {
                throw new Error('Path exists but is not a file');
            }
            if (type === 'directory' && !stats.isDirectory()) {
                throw new Error('Path exists but is not a directory');
            }
        }

        return {
            isFile: stats.isFile(),
            exists: true
        };
    } catch (error) {
        return {
            isFile: false,
            exists: false
        };
    }
}

module.exports = {
    getSystemUsage,
    printTaskSummary,
    generateCompressTargetPath,
    generateExtractTargetPath,
    compress,
    extractFile,
    calculateSize,
    formatSize,
    scanDirectorySize,
    checkPathType
}; 