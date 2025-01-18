const fs = require('fs');
const path = require('path');
const log = require('#@/ncore/utils/logger/index.js');

let watchPath = '';
let fileNameSet = new Set();
let isInitialized = false;
let currentIndex = 0;
let loopCount = 0;
let watchedPaths = new Set();
let watchedFiles = new Map();
let initializePromise = null;
let lastAddTime = 0;
let addCount = 0;
let scanStartTime = 0;
let isFirstScanComplete = false;
let scanInterval = null;

function normalizePath(inputPath) {
    let normalizedPath = path.resolve(inputPath);
    
    if (normalizedPath.length > 1 && normalizedPath.endsWith(path.sep)) {
        normalizedPath = normalizedPath.slice(0, -1);
    }
    
    if (process.platform === 'win32') {
        normalizedPath = normalizedPath.toLowerCase();
    }
    
    return normalizedPath;
}

function isSubDirectoryLevel1(parentPath, filePath) {
    const normalizedParent = normalizePath(parentPath);
    const normalizedFile = normalizePath(filePath);
    
    if (!normalizedFile.startsWith(normalizedParent)) {
        return false;
    }
    
    const relativePath = normalizedFile.slice(normalizedParent.length + 1);
    return !relativePath.includes(path.sep);
}

async function scanDirectory(dirPath) {
    try {
        const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile()) {
                const fullPath = path.join(dirPath, file.name);
                addFileToWatchMap(fullPath);
            }
        }
    } catch (error) {
        log.error(`[Scanner] Failed to scan directory ${dirPath}:`, error);
    }
}

async function scanAllDirectories() {
    const currentFiles = new Set();
    
    for (const watchPath of watchedPaths) {
        try {
            const files = await fs.promises.readdir(watchPath, { withFileTypes: true });
            for (const file of files) {
                if (file.isFile()) {
                    const fullPath = normalizePath(path.join(watchPath, file.name));
                    currentFiles.add(fullPath);
                    
                    // Check for new files
                    const parentPath = getParentWatchPath(fullPath);
                    if (parentPath) {
                        const fileSet = watchedFiles.get(parentPath) || new Set();
                        if (!fileSet.has(fullPath)) {
                            addFileToWatchMap(fullPath);
                            if (isFirstScanComplete) {
                                log.info(`[Scanner] New file detected: ${fullPath}`);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            log.error(`[Scanner] Failed to scan directory ${watchPath}:`, error);
        }
    }
    
    // Check for removed files
    for (const [watchPath, fileSet] of watchedFiles) {
        for (const file of fileSet) {
            if (!currentFiles.has(file)) {
                _removeFromIndex(file);
                if (isFirstScanComplete) {
                    log.info(`[Scanner] File removed: ${file}`);
                }
            }
        }
    }
}

function getParentWatchPath(filePath) {
    const normalizedFilePath = normalizePath(filePath);
    let longestMatch = null;
    let maxLength = -1;

    for (const watchedPath of watchedPaths) {
        if (normalizedFilePath.startsWith(watchedPath) && 
            watchedPath.length > maxLength && 
            isSubDirectoryLevel1(watchedPath, normalizedFilePath)) {
            longestMatch = watchedPath;
            maxLength = watchedPath.length;
        }
    }
    
    return longestMatch;
}

function arePathsEqual(path1, path2) {
    return normalizePath(path1) === normalizePath(path2);
}

function isPathWatched(dirPath) {
    const normalizedPath = normalizePath(dirPath);
    return Array.from(watchedPaths).some(p => arePathsEqual(p, normalizedPath));
}

async function addWatchPath(dirPath) {
    const normalizedPath = normalizePath(dirPath);
    
    if (isPathWatched(normalizedPath)) {
        log.warn(`[Scanner] Path already being watched: ${dirPath}`);
        return;
    }
    
    watchPath = normalizedPath;
    watchedPaths.add(normalizedPath);
    if (!isInitialized && !initializePromise) {
        initializePromise = initialize();
        await initializePromise;
    } else if (isInitialized) {
        await scanDirectory(normalizedPath);
    }
}

async function initialize(options = { rescanInterval: 0 }) {
    if (isInitialized) {
        log.warn('[Scanner] File watcher already initialized');
        return;
    }

    if (initializePromise) {
        return initializePromise;
    }

    return new Promise(async (resolve, reject) => {
        try {
            const totalWaitTime = 8;
            for (let i = totalWaitTime; i > 0; i--) {
                log.info(`[Scanner] Waiting for other programs to add paths... ${i} seconds remaining`);
                await new Promise(r => setTimeout(r, 1000));
            }

            scanStartTime = Date.now();
            addCount = 0;
            lastAddTime = scanStartTime;
            isFirstScanComplete = false;

            await scanAllDirectories();
            
            isInitialized = true;
            isFirstScanComplete = true;
            const totalTime = (Date.now() - scanStartTime) / 1000;
            log.info(`[Scanner] Initial scan completed: processed ${addCount} files in ${totalTime.toFixed(2)} seconds`);
            
            // Setup rescan interval if specified
            if (options.rescanInterval > 0) {
                scanInterval = setInterval(async () => {
                    log.info('[Scanner] Starting periodic rescan...');
                    await scanAllDirectories();
                    log.info('[Scanner] Periodic rescan completed');
                }, options.rescanInterval);
            }

            initializePromise = null;
            resolve();
        } catch (error) {
            log.error('[Scanner] Failed to initialize file watcher:', error);
            initializePromise = null;
            reject(error);
        }
    });
}

function getWatchedFilesStats() {
    const stats = {};
    for (const [watchPath, files] of watchedFiles) {
        stats[watchPath] = files.size;
    }
    return stats;
}

function addFileToWatchMap(filePath) {
    const now = Date.now();
    const normalizedPath = normalizePath(filePath);
    const parentPath = getParentWatchPath(normalizedPath);
    
    if(isFirstScanComplete){
        console.log('filePath', filePath)
    }
    if (!parentPath) {
        log.warn(`[Scanner] File ${filePath} does not belong to any watched directory`);
        return false;
    }

    if (!watchedFiles.has(parentPath)) {
        watchedFiles.set(parentPath, new Set());
    }

    const fileSet = watchedFiles.get(parentPath);
    const wasAdded = !fileSet.has(normalizedPath);
    
    if (wasAdded) {
        fileSet.add(normalizedPath);
        const fileName = path.basename(normalizedPath);
        fileNameSet.add(fileName);

        if (!isFirstScanComplete) {
            addCount++;
            lastAddTime = now;
            
            if (addCount % 1000 === 0) {
                const elapsed = (now - scanStartTime) / 1000;
                log.info(`[Scanner] Scanning: processed ${addCount} files in ${elapsed.toFixed(2)} seconds`);
            }
        }
    }

    return wasAdded;
}

function _removeFromIndex(filePath) {
    const normalizedPath = normalizePath(filePath);
    const parentPath = getParentWatchPath(normalizedPath);
    
    if (parentPath && watchedFiles.has(parentPath)) {
        const fileSet = watchedFiles.get(parentPath);
        fileSet.delete(normalizedPath);
    }

    const fileName = path.basename(normalizedPath);
    fileNameSet.delete(fileName);
}

async function getWatcherStatus() {
    await initialize();
    const stats = getWatchedFilesStats();
    return {
        fileNameSet: fileNameSet.size,
        watchedPaths: watchedPaths.size,
        filesPerPath: stats
    };
}

async function findFileInPath(searchPath, fileName) {
    await initialize();
    
    if (path.isAbsolute(fileName)) {
        const normalizedPath = normalizePath(fileName);
        const parentPath = getParentWatchPath(normalizedPath);
        if (!parentPath) return null;
        
        const fileSet = watchedFiles.get(parentPath);
        return fileSet && fileSet.has(normalizedPath) ? normalizedPath : null;
    }
    
    const normalizedSearchPath = normalizePath(searchPath);
    if (!watchedFiles.has(normalizedSearchPath)) {
        return null;
    }
    
    const fullPath = normalizePath(path.join(normalizedSearchPath, fileName));
    const fileSet = watchedFiles.get(normalizedSearchPath);
    return fileSet && fileSet.has(fullPath) ? fullPath : null;
}

async function findFilesByName(fileName) {
    await initialize();
    const results = [];
    
    if (path.isAbsolute(fileName)) {
        const normalizedPath = normalizePath(fileName);
        const parentPath = getParentWatchPath(normalizedPath);
        if (parentPath) {
            const fileSet = watchedFiles.get(parentPath);
            if (fileSet && fileSet.has(normalizedPath)) {
                results.push(normalizedPath);
            }
        }
        return results;
    }
    
    for (const [watchPath, fileSet] of watchedFiles) {
        const fullPath = normalizePath(path.join(watchPath, fileName));
        if (fileSet.has(fullPath)) {
            results.push(fullPath);
        }
    }
    
    return results;
}

async function close() {
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    fileNameSet.clear();
    watchedPaths.clear();
    watchedFiles.clear();
    isInitialized = false;
    isFirstScanComplete = false;
}

async function getWatchedFiles() {
    await initialize();
    return Array.from(fileNameSet);
}

async function getNextFile() {
    await initialize();
    const files = await getWatchedFiles();
    if (files.length === 0) {
        return null;
    }

    if (currentIndex >= files.length) {
        loopCount++;
        currentIndex = 0;
    }

    const file = files[currentIndex];
    currentIndex++;
    return file;
}

async function getNextFileAndIndex() {
    await initialize();
    const file = await getNextFile();
    return {
        file: file ? path.join(watchPath, file) : null,
        index: currentIndex,
        size: fileNameSet.size,
        loopCount: loopCount
    };
}

function resetRotation() {
    currentIndex = 0;
}

async function getFilesInPath(searchPath) {
    await initialize();
    const normalizedSearchPath = normalizePath(searchPath);
    
    if (!watchedFiles.has(normalizedSearchPath)) {
        return [];
    }
    
    const fileSet = watchedFiles.get(normalizedSearchPath);
    return Array.from(fileSet);
}

async function getAllPathFiles() {
    await initialize();
    const result = Object.create(null);
    
    for (const [watchPath, fileSet] of watchedFiles) {
        result[watchPath] = Array.from(fileSet);
    }
    
    return result;
}

module.exports = {
    addWatchPath,
    initialize,
    findFileInPath,
    findFilesByName,
    getFilesInPath,
    getAllPathFiles,
    close,
    getWatchedFiles,
    getNextFile,
    getNextFileAndIndex,
    resetRotation,
    getWatcherStatus
}; 