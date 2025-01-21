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
 * Find a file by searching up through parent directories
 * @param {string} filename - Name of the file to find
 * @param {string} [currentDir] - Starting directory (defaults to current working directory)
 * @returns {string|null} Full path to the file or null if not found
 */
function findInParentDirectories(filename, currentDir = process.cwd()) {
    let filePath = path.join(currentDir, filename);
    if (fs.existsSync(filePath)) {
        return filePath;
    }
    while (currentDir !== path.parse(currentDir).root) {
        filePath = path.join(currentDir, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}

/**
 * Check if a directory has exactly one subdirectory
 * @param {string} dir - Directory to check
 * @returns {boolean} True if the directory has exactly one subdirectory
 */
function hasOnlyOneSubdirectory(dir) {
    try {
        const stats = fs.statSync(dir);
        if (!stats.isDirectory()) {
            return false;
        }
        const items = fs.readdirSync(dir);
        let subdirectoryCount = 0;
        for (const item of items) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                if (subdirectoryCount > 1) {
                    return false;
                }
                subdirectoryCount++;
            }
        }
        return subdirectoryCount === 1;
    } catch (error) {
        log.error(`hasOnlyOneSubdirectory-Error: ${error.message}`);
        return false;
    }
}

/**
 * Find a file by searching upward through directories
 * @param {string} fileName - Name of the file to find
 * @param {string} [currentDir] - Starting directory
 * @returns {string|null} Full path to the file or null if not found
 */
function findFileUpward(fileName, currentDir = process.cwd()) {
    const filePath = path.join(currentDir, fileName);
    if (fs.existsSync(filePath)) {
        return path.resolve(filePath);
    }
    const parentDir = path.dirname(currentDir);
    if (currentDir === parentDir) {
        return null;
    }
    return findFileUpward(fileName, parentDir);
}

/**
 * Find a file by searching downward through directories
 * @param {string} fileName - Name of the file to find
 * @param {string} [currentDir] - Starting directory
 * @returns {string|null} Full path to the file or null if not found
 */
function findFileDownward(fileName, currentDir = process.cwd()) {
    const filePath = path.join(currentDir, fileName);
    if (fs.existsSync(filePath)) {
        return path.resolve(filePath);
    }
    const subDirs = fs.readdirSync(currentDir)
        .filter(item => fs.statSync(path.join(currentDir, item)).isDirectory());
    
    for (const subDir of subDirs) {
        const subDirPath = path.join(currentDir, subDir);
        const foundPath = findFileDownward(fileName, subDirPath);
        if (foundPath) {
            return foundPath;
        }
    }
    return null;
}

/**
 * Find multiple files by searching upward through directories
 * @param {string[]} fileNames - Array of file names to find
 * @param {string} [currentDir] - Starting directory
 * @returns {string|null} Directory path containing all files or null if not found
 */
function findFilesUpward(fileNames, currentDir = process.cwd()) {
    const foundFiles = fileNames.every(fileName => fs.existsSync(path.join(currentDir, fileName)));
    if (foundFiles) {
        return path.resolve(currentDir);
    }
    const parentDir = path.dirname(currentDir);
    if (currentDir === parentDir) {
        return null;
    }
    return findFilesUpward(fileNames, parentDir);
}

/**
 * Find multiple files by searching downward through directories
 * @param {string[]} fileNames - Array of file names to find
 * @param {string} [currentDir] - Starting directory
 * @returns {string|null} Directory path containing all files or null if not found
 */
function findFilesDownward(fileNames, currentDir = process.cwd()) {
    const foundFiles = fileNames.every(fileName => fs.existsSync(path.join(currentDir, fileName)));
    if (foundFiles) {
        return path.resolve(currentDir);
    }
    const subDirs = fs.readdirSync(currentDir)
        .filter(item => fs.statSync(path.join(currentDir, item)).isDirectory());
    
    for (const subDir of subDirs) {
        const subDirPath = path.join(currentDir, subDir);
        const foundPath = findFilesDownward(fileNames, subDirPath);
        if (foundPath) {
            return foundPath;
        }
    }
    return null;
}

/**
 * Check if a path is a root path
 * @param {string} pathToCheck - Path to check
 * @returns {boolean} True if the path is a root path
 */
function isRootPath(pathToCheck) {
    const normalizedPath = path.resolve(pathToCheck).toLowerCase();
    return normalizedPath === path.parse(normalizedPath).root.toLowerCase();
}

/**
 * Search for files by name in parent directories
 * @param {string[]} fileNames - Array of file names to search for
 * @param {string} [startDir] - Starting directory
 * @returns {string|null} Path to the first matching file or null if not found
 */
function searchUpward(fileNames, startDir = process.cwd()) {
    const files = fs.readdirSync(startDir);
    for (const file of files) {
        if (fileNames.includes(file)) {
            return path.join(startDir, file);
        }
    }
    if (!isRootPath(startDir)) {
        return searchUpward(fileNames, path.resolve(startDir, '..'));
    }
    return null;
}

/**
 * Search for files by name in subdirectories
 * @param {string} directory - Directory to start search from
 * @param {string[]} fileNames - Array of file names to search for
 * @returns {string|null} Path to the first matching file or null if not found
 */
function searchDownward(directory, fileNames) {
    let foundFilePath = null;
    
    function findFileDownward(currentDirectory) {
        const files = fs.readdirSync(currentDirectory);
        for (const file of files) {
            const filePath = path.join(currentDirectory, file);
            if (fileNames.includes(file)) {
                foundFilePath = filePath;
                return;
            }
            if (fs.statSync(filePath).isDirectory()) {
                findFileDownward(filePath);
                if (foundFilePath) return;
            }
        }
    }
    
    findFileDownward(directory);
    return foundFilePath;
}

/**
 * Check if a directory contains all specified subdirectories
 * @param {string} rootPath - Root directory to check
 * @param {string[]} dirs - Array of directory names to check for
 * @returns {boolean} True if all directories are present
 */
function containsAllDirs(rootPath, dirs) {
    const contents = fs.readdirSync(rootPath);
    return dirs.every(dir => contents.includes(dir));
}

/**
 * Count number of files in a directory and its subdirectories
 * @param {string} dir - Directory to count files in
 * @returns {number} Number of files found
 */
function countFilesInDirectory(dir) {
    let count = 0;
    
    function walk(directory) {
        const items = fs.readdirSync(directory);
        for (const item of items) {
            const fullPath = path.join(directory, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (stat.isFile() || item.endsWith('.asar')) {
                count++;
            }
        }
    }
    
    walk(dir);
    return count;
}

/**
 * Clean old files from a directory, keeping a specified number of newest files
 * @param {string} directory - Directory to clean
 * @param {number} [reserve=1] - Number of newest files to keep
 * @returns {Promise<void>}
 */
async function cleanOldFiles(directory, reserve = 1) {
    return new Promise((resolve, reject) => {
        fs.readdir(directory, async (err, files) => {
            if (err) return reject(err);
            if (files.length < reserve) return resolve();

            try {
                const fileStats = await Promise.all(
                    files.map(async file => {
                        const stats = await fs.promises.stat(path.join(directory, file));
                        return {
                            name: file,
                            time: stats.mtime || stats.birthtime
                        };
                    })
                );

                fileStats.sort((a, b) => b.time - a.time);
                const filesToDelete = fileStats.slice(reserve);

                await Promise.all(
                    filesToDelete.map(fileObj =>
                        fs.promises.unlink(path.join(directory, fileObj.name))
                    )
                );

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Find files with specific extension in directory
 * @param {string} dir - Directory to search in
 * @param {string} extname - Extension to search for (including dot)
 * @param {number} [level=Infinity] - Maximum directory depth to search
 * @returns {string[]} Array of matching file paths
 */
function findFileByExtname(dir, extname, level = Infinity) {
    const files = [];
    
    function searchFilesInDirectory(currentDir, currentLevel) {
        if (currentLevel > level) return;
        
        const items = fs.readdirSync(currentDir);
        items.forEach(item => {
            const itemPath = path.join(currentDir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                searchFilesInDirectory(itemPath, currentLevel + 1);
            } else if (stat.isFile() && path.extname(itemPath) === extname) {
                files.push(itemPath);
            }
        });
    }
    
    searchFilesInDirectory(dir, 1);
    return files;
}

/**
 * Get the total size of a directory
 * @param {string} directoryPath - Path to the directory
 * @returns {number} Total size in bytes
 */
function getDirectorySize(directoryPath) {
    let totalSize = 0;
    
    function calculateSize(dirPath) {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
                calculateSize(itemPath);
            } else {
                totalSize += stats.size;
            }
        }
    }
    
    calculateSize(directoryPath);
    return totalSize;
}

/**
 * Find a directory that contains all specified subdirectories
 * @param {string} baseDir - Base directory to start search from
 * @param {string[]} subdirs - Array of subdirectory names to find
 * @returns {string|null} Path to matching directory or null if not found
 */
function findDirectoryWithSubdirs(baseDir, subdirs) {
    if (containsAllDirs(baseDir, subdirs)) {
        return baseDir;
    }
    
    const items = fs.readdirSync(baseDir);
    for (const item of items) {
        const itemPath = path.join(baseDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
            const result = findDirectoryWithSubdirs(itemPath, subdirs);
            if (result) {
                return result;
            }
        }
    }
    
    return null;
}

/**
 * Delete a folder and its contents asynchronously with retry
 * @param {string} folderPath - Path to the folder to delete
 * @param {number} [retry=50] - Number of retry attempts
 * @returns {Promise<void>}
 */
async function deleteFolderAsync(folderPath, retry = 50) {
    let retryCount = 0;
    
    async function attemptDelete() {
        try {
            await fs.promises.rm(folderPath, { recursive: true, force: true });
        } catch (error) {
            if (retryCount < retry) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 100));
                return attemptDelete();
            }
            throw error;
        }
    }
    
    await attemptDelete();
}

/**
 * Scan a directory and return its contents
 * @param {string} dirPath - Directory path to scan
 * @param {Object} [options] - Scan options
 * @param {boolean} [options.onlyDirs=false] - Only return directories
 * @param {boolean} [options.onlyFiles=false] - Only return files
 * @param {boolean} [options.withStats=false] - Include file/directory stats
 * @param {number} [options.depth=1] - Scan depth (1 for current directory only)
 * @returns {Array<string|Object>} Array of absolute paths or file info objects
 */
function scanDirectory(dirPath, options = {}) {
    const {
        onlyDirs = false,
        onlyFiles = false,
        withStats = false,
        depth = 1
    } = options;

    const absolutePath = path.resolve(dirPath);
    if (!fs.existsSync(absolutePath)) {
        log.error(`Directory does not exist: ${absolutePath}`);
        return [];
    }

    try {
        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            log.error(`Path is not a directory: ${absolutePath}`);
            return [];
        }
    } catch (error) {
        log.error(`Error accessing directory ${absolutePath}: ${error.message}`);
        return [];
    }

    try {
        const items = fs.readdirSync(absolutePath);
        const results = [];

        for (const item of items) {
            const fullPath = path.resolve(absolutePath, item);
            
            try {
                const stats = fs.statSync(fullPath);
                const isDir = stats.isDirectory();

                // Skip based on filters
                if (onlyDirs && !isDir) continue;
                if (onlyFiles && isDir) continue;

                if (withStats) {
                    results.push({
                        path: fullPath,
                        name: item,
                        isDirectory: isDir,
                        stats
                    });
                } else {
                    results.push(fullPath);
                }
            } catch (error) {
                log.warn(`Skipping ${fullPath}: ${error.message}`);
                continue;
            }
        }

        return results;
    } catch (error) {
        log.error(`Error scanning directory ${absolutePath}: ${error.message}`);
        return [];
    }
}

/**
 * Deep scan a directory and return all its contents recursively
 * @param {string} dirPath - Directory path to scan
 * @param {Object} [options] - Scan options
 * @param {boolean} [options.onlyDirs=false] - Only return directories
 * @param {boolean} [options.onlyFiles=false] - Only return files
 * @param {boolean} [options.withStats=false] - Include file/directory stats
 * @param {string[]} [options.exclude=[]] - Patterns to exclude
 * @returns {Array<string|Object>} Array of absolute paths or file info objects
 */
function scanDirectoryDeep(dirPath, options = {}) {
    const {
        onlyDirs = false,
        onlyFiles = false,
        withStats = false,
        exclude = []
    } = options;

    const absolutePath = path.resolve(dirPath);
    if (!fs.existsSync(absolutePath)) {
        log.error(`Directory does not exist: ${absolutePath}`);
        return [];
    }

    try {
        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            log.error(`Path is not a directory: ${absolutePath}`);
            return [];
        }
    } catch (error) {
        log.error(`Error accessing directory ${absolutePath}: ${error.message}`);
        return [];
    }

    const results = [];

    function shouldExclude(itemPath) {
        return exclude.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(itemPath);
            }
            return itemPath.includes(pattern);
        });
    }

    function scan(currentPath) {
        try {
            const items = fs.readdirSync(currentPath);

            for (const item of items) {
                const fullPath = path.resolve(currentPath, item);
                
                // Skip excluded paths
                if (shouldExclude(fullPath)) continue;

                try {
                    const stats = fs.statSync(fullPath);
                    const isDir = stats.isDirectory();

                    // Handle directories
                    if (isDir) {
                        if (!onlyFiles) {
                            if (withStats) {
                                results.push({
                                    path: fullPath,
                                    name: item,
                                    isDirectory: true,
                                    stats
                                });
                            } else {
                                results.push(fullPath);
                            }
                        }
                        scan(fullPath);
                    }
                    // Handle files
                    else if (!onlyDirs) {
                        if (withStats) {
                            results.push({
                                path: fullPath,
                                name: item,
                                isDirectory: false,
                                stats
                            });
                        } else {
                            results.push(fullPath);
                        }
                    }
                } catch (error) {
                    log.warn(`Skipping ${fullPath}: ${error.message}`);
                    continue;
                }
            }
        } catch (error) {
            log.error(`Error scanning directory ${currentPath}: ${error.message}`);
        }
    }

    scan(absolutePath);
    return results;
}

/**
 * Clear a directory by removing all contents and recreating it
 * @param {string} dirPath - Directory path to clear
 * @returns {Object} Result with success status and details
 */
function clearDirectory(dirPath) {
    const result = {
        success: false,
        cleared: [],
        skipped: [],
        message: ''
    };

    if (!fs.existsSync(dirPath)) {
        result.message = 'Directory does not exist';
        return result;
    }

    try {
        // Get list of all items before deletion
        const items = fs.readdirSync(dirPath);
        
        // Try to delete each item
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            try {
                if (fs.statSync(itemPath).isDirectory()) {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(itemPath);
                }
                result.cleared.push(itemPath);
            } catch (error) {
                log.warn(`Failed to remove ${itemPath}: ${error.message}`);
                result.skipped.push(itemPath);
            }
        }

        // Delete and recreate the directory itself
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            fs.mkdirSync(dirPath, { recursive: true });
        } catch (error) {
            log.warn(`Failed to recreate directory ${dirPath}: ${error.message}`);
        }

        // Set success status and message
        result.success = true;
        if (result.skipped.length === 0) {
            result.message = 'Directory cleared successfully';
        } else {
            result.message = `Directory cleared with ${result.skipped.length} items skipped`;
        }
    } catch (error) {
        result.message = `Failed to clear directory: ${error.message}`;
    }

    return result;
}

// Export all functions
module.exports = {
    findInParentDirectories,
    hasOnlyOneSubdirectory,
    findFileUpward,
    findFileDownward,
    findFilesUpward,
    findFilesDownward,
    isRootPath,
    searchUpward,
    searchDownward,
    containsAllDirs,
    getDirectorySize,
    findDirectoryWithSubdirs,
    deleteFolderAsync,
    clearDirectory,
    scanDirectory,
    scanDirectoryDeep
};
