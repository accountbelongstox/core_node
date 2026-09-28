const fs = require('fs');
const path = require('path');

let log;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

/**
 * Get subdirectories from a given path
 * @param {string} dirPath - Directory path to scan
 * @returns {string[]} Array of absolute paths to subdirectories
 */
function getSubDirectories(dirPath) {
    try {
        const absolutePath = path.resolve(dirPath);

        if (!fs.existsSync(absolutePath)) {
            log.warn(`Directory does not exist: ${absolutePath}`);
            return [];
        }

        const items = fs.readdirSync(absolutePath);
        const subDirs = items
            .map(item => path.join(absolutePath, item))
            .filter(itemPath => {
                try {
                    return fs.statSync(itemPath).isDirectory();
                } catch (error) {
                    log.error(`Error checking directory: ${itemPath}`, error);
                    return false;
                }
            });

        log.info(`Found ${subDirs.length} subdirectories in ${absolutePath}`);
        return subDirs;

    } catch (error) {
        log.error(`Error getting subdirectories for ${dirPath}:`, error);
        return [];
    }
}

/**
 * Get recursive subdirectories from a given path
 * @param {string} dirPath - Directory path to scan
 * @param {string[]} excludes - Directories to exclude
 * @returns {string[]} Array of absolute paths to subdirectories
 */
function getRecursiveSubDirectories(dirPath, excludes = []) {
    try {
        const absolutePath = path.resolve(dirPath);
        let results = [];

        if (!fs.existsSync(absolutePath)) {
            log.warn(`Directory does not exist: ${absolutePath}`);
            return results;
        }

        const items = fs.readdirSync(absolutePath);

        for (const item of items) {
            if (excludes.includes(item)) continue;

            const fullPath = path.join(absolutePath, item);
            try {
                if (fs.statSync(fullPath).isDirectory()) {
                    results.push(fullPath);
                    results = results.concat(
                        getRecursiveSubDirectories(fullPath, excludes)
                    );
                }
            } catch (error) {
                log.error(`Error accessing path: ${fullPath}`, error);
            }
        }

        return results;

    } catch (error) {
        log.error(`Error scanning directory ${dirPath}:`, error);
        return [];
    }
}

/**
 * Check if path is a directory
 * @param {string} dirPath - Path to check
 * @returns {boolean} True if path is a directory
 */
function isDirectory(dirPath) {
    try {
        return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch (error) {
        log.error(`Error checking directory: ${dirPath}`, error);
        return false;
    }
}

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Directory path to create
 * @returns {boolean} True if directory exists or was created
 */
function ensureDirectory(dirPath) {
    try {
        const absolutePath = path.resolve(dirPath);
        if (!fs.existsSync(absolutePath)) {
            fs.mkdirSync(absolutePath, { recursive: true });
            log.success(`Created directory: ${absolutePath}`);
        }
        return true;
    } catch (error) {
        log.error(`Error creating directory: ${dirPath}`, error);
        return false;
    }
}

function getFilesAtDepth(dirPath, depth = 1) {
    if (!fs.existsSync(dirPath)) {
        return []; // Return empty array if the directory doesn't exist
    }

    let files = [];

    function readDir(currentPath, currentDepth) {
        if (currentDepth > depth) return;

        const items = fs.readdirSync(currentPath);

        items.forEach(item => {
            const fullPath = path.join(currentPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // If the item is a directory, recurse deeper
                readDir(fullPath, currentDepth + 1);
            } else {
                // If the item is a file, add it to the result array
                if (currentDepth <= depth) {
                    files.push(fullPath);
                }
            }
        });
    }

    readDir(dirPath, 1); // Start reading from depth 1
    return files;
}

module.exports = {
    getSubDirectories,
    getRecursiveSubDirectories,
    isDirectory,
    ensureDirectory,
    getFilesAtDepth
};
