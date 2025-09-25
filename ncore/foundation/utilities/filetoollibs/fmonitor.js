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
const logger = require('#@logger');
const crypto = require('crypto');
function formatDurationToStr(timestamp) {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    const remainingMonths = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    if (years > 0) {
        return `${years}y ${remainingMonths}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }
    if (months > 0) {
        return `${months}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }
    if (days > 0) {
        return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}
function normalizePath(inputPath) {
    const absolutePath = path.resolve(inputPath);
    const normalizedPath = path.normalize(absolutePath);
    const platformSpecificPath = process.platform === 'win32' ? normalizedPath.replace(/\\/g, '/') : normalizedPath;
    return platformSpecificPath;
}
function stringToMD5(str) {
    const md5Hash = crypto.createHash('md5');
    md5Hash.update(str);
    return md5Hash.digest('hex');
}
function getRandomElements(arr, length = 10) {
    const shuffled = arr.slice(); // Create a copy to avoid modifying the original array
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
    }
    return shuffled.slice(0, Math.min(length, shuffled.length)); // Truncate if length exceeds array length
}

function toAbsolutePath(filePath, watchPath) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    return path.join(watchPath, filePath);
}

function getFileSize(filePath) {
    if (!fs.existsSync(filePath)) {
        return -1;
    }
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        logger.error(`[Monitoring] File Size Error | Path: ${filePath} | Error: ${error.message}`);
        return 0;
    }
}

function scanDirectoryDeep(dirPath, options = {}) {
    const {
        onlyDirs = false,
        onlyFiles = true,
        noFullPath = false,
        exclude = []
    } = options;

    const absolutePath = path.resolve(dirPath);
    if (!fs.existsSync(absolutePath)) {
        logger.error(`Directory does not exist: ${absolutePath}`);
        return [];
    }

    try {
        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            logger.error(`Path is not a directory: ${absolutePath}`);
            return [];
        }
    } catch (error) {
        logger.error(`Error accessing directory ${absolutePath}: ${error.message}`);
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
                if (shouldExclude(fullPath)) continue;
                try {
                    const stats = fs.statSync(fullPath);
                    const isDir = stats.isDirectory();
                    if (isDir) {
                        if (!onlyFiles) {
                            if (noFullPath) {
                                results.push(item);
                            } else {
                                results.push(fullPath);
                            }
                        }
                        scan(fullPath);
                    }
                    else if (!onlyDirs) {
                        if (noFullPath) {
                            results.push(item);
                        } else {
                            results.push(fullPath);
                        }
                    }
                } catch (error) {
                    logger.warn(`Skipping ${fullPath}: ${error.message}`);
                    continue;
                }
            }
        } catch (error) {
            logger.error(`Error scanning directory ${currentPath}: ${error.message}`);
        }
    }

    scan(absolutePath);
    return results;
}

const globalMap = new Map();

class FileMonitor {
    constructor(watchPath, options = {}) {
        this.watchPath = normalizePath(watchPath);
        this.maxDepth = options.maxDepth || 1;
        this.rescanInterval = options.rescanInterval || 100 * 1000;

        // Use normalized path as key to ensure consistency
        if (!globalMap.has(this.watchPath)) {
            globalMap.set(this.watchPath, {
                watchPath: this.watchPath,
                wid: stringToMD5(this.watchPath),
                maxDepth: this.maxDepth,
                fileNameSets: new Set(),
                currentIndexes: 0,
                loopCounts: 0,
                isInitialized: false,
                scanInProgress: false,
                lastScanTime: 0,
                duration: 0,
                rescanIntervals: null
            });
        }
        const globalState = globalMap.get(this.watchPath);
        globalState.duration = 0;

        if (this.rescanInterval > 0) {
            if (!globalState.rescanIntervals) {
                globalState.rescanIntervals = setInterval(() => this.scanDir(true), this.rescanInterval);
            }
        }
    }

    async scanDir(isRescan = false) {
        const startTime = Date.now();
        if (isRescan) {
            logger.debug(`[Monitoring] Rescan | startTime: ${startTime} | Path: ${this.watchPath}`);
        }
        const globalState = globalMap.get(this.watchPath);
        const isScanning = globalState.scanInProgress;
        if (isScanning) {
            logger.warn(`[Monitoring] Skip rescan | Path: ${this.watchPath} | Status: Previous scan in progress`);
            return;
        }
        try {
            globalState.scanInProgress = true;
            const scanResult = await scanDirectoryDeep(this.watchPath, {
                onlyFiles: true,
                noFullPath: true,
                exclude: []
            });
            for (const file of scanResult) {
                this.add(file);
            }
            globalState.lastScanTime = Date.now();
        } finally {
            globalState.scanInProgress = false;
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        logger.debug(`[Monitoring] Scan Completed | Path: ${this.watchPath} | Duration: ${duration}ms`);
        if (isRescan) {
            logger.debug(`[Monitoring] Rescan | duration: ${duration}ms | Path: ${this.watchPath}`);
        }
        globalState.duration = formatDurationToStr(duration);
    }

    async initialize() {
        const globalState = globalMap.get(this.watchPath);
        const isInitialized = globalState.isInitialized;
        if (isInitialized) {
            logger.interval(`[Monitoring] Already Initialized | Path: ${this.watchPath}`, 3);
            return;
        };
        await this.scanDir();
        globalState.isInitialized = true;
    }

    getFilesSet() {
        return globalMap.get(this.watchPath).fileNameSets;
    }

    show() {
        const globalState = globalMap.get(this.watchPath);
        const files = Array.from(globalState.fileNameSets);
        const randomFiles = getRandomElements(files, 20);
        logger.info(`[Monitoring] File Name Set | Path: ${this.watchPath} | Count: ${files.length}`);
        for (const key in globalState) {
            let value = globalState[key];
            if (key == `fileNameSets`) {
                value = value.size;
            }
            logger.info(`${key} : ${value}`);
        }
        randomFiles.forEach(file => {
            logger.info(`Random File: ${file}`);
        })
        return files;
    }

    add(filePath) {
        const globalState = globalMap.get(this.watchPath);
        const fileName = path.basename(filePath);
        const fileSet = globalState.fileNameSets;
        fileSet.add(fileName);
        return fileSet.has(fileName);
    }

    async find(fileName, returnFullPath = true) {
        const globalState = globalMap.get(this.watchPath);
        await this.initialize();
        fileName = path.basename(fileName);
        const filesSet = globalState.fileNameSets;
        if (!filesSet.has(fileName)) return null;
        const fileFullPath = path.join(this.watchPath, fileName);
        return returnFullPath ? fileFullPath : fileName;
    }

    async findAbsolute(fileFullPath) {
        const globalState = globalMap.get(this.watchPath);
        await this.initialize();
        const fileName = path.basename(fileFullPath);
        const filesSet = globalState.fileNameSets;
        if (!filesSet.has(fileName)) return null;
        if (path.isAbsolute(fileFullPath)) {
            return fileFullPath;
        }
        fileFullPath = path.join(this.watchPath, fileFullPath);
        return fileFullPath;
    }

    async findValid(fileFullPath) {
        const globalState = globalMap.get(this.watchPath);
        await this.initialize();
        const filePath = await this.find(fileFullPath);
        if (!filePath) return null;
        const absolutePath = toAbsolutePath(filePath, this.watchPath);
        const size = getFileSize(absolutePath);
        if (size <= 0) {
            logger.warn(`[Monitoring] Empty File ${absolutePath}`);
            return null;
        }
        return absolutePath;
    }

    async close() {
        const globalState = globalMap.get(this.watchPath);
        if (globalState.rescanIntervals) {
            clearInterval(globalState.rescanIntervals);
            globalState.rescanIntervals = null;
        }
        globalState.fileNameSets.delete(this.watchPath);
        globalState.currentIndexes.delete(this.watchPath);
        globalState.loopCounts.delete(this.watchPath);
        globalState.isInitialized.set(this.watchPath, false);
        globalState.scanInProgress.delete(this.watchPath);
        globalState.lastScanTime.delete(this.watchPath);
    }

    async getNextFile() {
        const globalState = globalMap.get(this.watchPath);
        await this.initialize();
        const filesSet = globalState.fileNameSets;
        const files = Array.from(filesSet);
        if (files.length === 0) {
            return null;
        }
        let currentIndex = globalMap.get(this.watchPath).currentIndexes;
        if (currentIndex >= files.length) {
            globalState.loopCounts = globalState.loopCounts + 1;
            currentIndex = 0;
        }
        const file = files[currentIndex];
        const absolutePath = path.join(this.watchPath, file);
        globalState.currentIndexes = currentIndex + 1;
        return absolutePath;
    }

    async getNextFileAndIndex() {
        const globalState = globalMap.get(this.watchPath);
        await this.initialize();
        const absolutePath = await this.getNextFile();
        const filesSet = globalState.fileNameSets;
        return {
            file: absolutePath,
            index: globalState.currentIndexes,
            size: filesSet.size,
            loopCount: globalState.loopCounts
        };
    }

    resetRotation() {
        globalMap.get(this.watchPath).currentIndexes = 0;
    }
}

module.exports = FileMonitor; 