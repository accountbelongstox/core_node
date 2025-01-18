const fs = require('fs');
const path = require('path');
const log = require('#@/ncore/utils/logger/index.js');

// Global state management
const globalState = {
    fileNameSets: new Map(),      // watchPath -> Set<fileName>
    currentIndexes: new Map(),    // watchPath -> number
    loopCounts: new Map(),        // watchPath -> number
    isInitialized: new Map(),     // watchPath -> boolean
    scanInProgress: new Map(),    // watchPath -> boolean
    lastScanTime: new Map(),      // watchPath -> number
    rescanIntervals: new Map(),   // watchPath -> NodeJS.Timeout
    firstScanStartTime: new Map(), // watchPath -> number
    lastAddTime: new Map(),       // watchPath -> number
    isFirstScanComplete: new Map(),// watchPath -> boolean
    firstScanFileCount: new Map() // watchPath -> number
};

class FileMonitor {
    constructor(watchPath, options = {}) {
        this.watchPath = watchPath;
        this.maxDepth = options.maxDepth || 1;
        this.rescanInterval = options.rescanInterval || 0; // milliseconds, 0 means no rescan

        if (!globalState.fileNameSets.has(watchPath)) {
            globalState.fileNameSets.set(watchPath, new Set());
            globalState.currentIndexes.set(watchPath, 0);
            globalState.loopCounts.set(watchPath, 0);
            globalState.isInitialized.set(watchPath, false);
            globalState.scanInProgress.set(watchPath, false);
            globalState.lastScanTime.set(watchPath, 0);
            globalState.firstScanStartTime.set(watchPath, 0);
            globalState.lastAddTime.set(watchPath, 0);
            globalState.isFirstScanComplete.set(watchPath, false);
            globalState.firstScanFileCount.set(watchPath, 0);
        }

        // Setup rescan interval if specified
        if (this.rescanInterval > 0) {
            if (globalState.rescanIntervals.has(watchPath)) {
                clearInterval(globalState.rescanIntervals.get(watchPath));
            }
            const intervalId = setInterval(() => this.rescan(), this.rescanInterval);
            globalState.rescanIntervals.set(watchPath, intervalId);
        }
    }

    async rescan() {
        if (globalState.scanInProgress.get(this.watchPath)) {
            log.warn(`[Monitoring] Skip rescan | Path: ${this.watchPath} | Status: Previous scan in progress`);
            return;
        }

        try {
            globalState.scanInProgress.set(this.watchPath, true);
            const previousFiles = new Set(this.getFileNameSet());
            await this.scanDirectory(this.watchPath, 1);
            
            const currentFiles = this.getFileNameSet();
            const newFiles = Array.from(currentFiles).filter(file => !previousFiles.has(file));
            
            if (newFiles.length > 0) {
                log.info(`[Monitoring] New Files | Path: ${this.watchPath} | Count: ${newFiles.length} | Files: ${newFiles.join(', ')}`);
            }
            
            globalState.lastScanTime.set(this.watchPath, Date.now());
        } finally {
            globalState.scanInProgress.set(this.watchPath, false);
        }
    }

    async scanDirectory(dirPath, currentDepth = 1) {
        if (currentDepth > this.maxDepth) return;

        const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);
            if (file.isDirectory() && currentDepth < this.maxDepth) {
                await this.scanDirectory(fullPath, currentDepth + 1);
            } else if (file.isFile()) {
                this.trackFile(fullPath);
            }
        }
    }

    async initialize() {
        if (globalState.isInitialized.get(this.watchPath)) return;
        try {
            globalState.scanInProgress.set(this.watchPath, true);
            await this.scanDirectory(this.watchPath, 1);
            globalState.isInitialized.set(this.watchPath, true);
            globalState.lastScanTime.set(this.watchPath, Date.now());
            log.warn(`[Monitoring] Initialized | Path: ${this.watchPath} | Total Files: ${this.getFileNameSet().size}`);
        } catch (error) {
            log.error(`[Monitoring] Error | Path: ${this.watchPath} | Error: ${error.message}`);
            throw error;
        } finally {
            globalState.scanInProgress.set(this.watchPath, false);
        }
    }

    getFileNameSet() {
        return globalState.fileNameSets.get(this.watchPath);
    }

    getBaseName(filePath) {
        return path.basename(filePath);
    }
    
    getFileSize(filePath) {
        if (!fs.existsSync(filePath)) {
            return -1;
        }
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch (error) {
            log.error(`[Monitoring] File Size Error | Path: ${filePath} | Error: ${error.message}`);
            return 0;
        }
    }

    getModificationTime(filePath) {
        if (!fs.existsSync(filePath)) {
            return -1;
        }
        try {
            const stats = fs.statSync(filePath);
            return stats.mtime.getTime();
        } catch (error) {
            log.error(`[Monitoring] Modification Time Error | Path: ${filePath} | Error: ${error.message}`);
            return 0;
        }
    }

    trackFile(filePath) {
        const fileName = path.basename(filePath);
        const fileSet = this.getFileNameSet();
        const now = Date.now();
        const lastAddTime = globalState.lastAddTime.get(this.watchPath);
        
        if (!globalState.isFirstScanComplete.get(this.watchPath)) {
            if (globalState.firstScanStartTime.get(this.watchPath) === 0) {
                globalState.firstScanStartTime.set(this.watchPath, now);
            }
            
            if (lastAddTime > 0 && (now - lastAddTime) > 500) {
                const totalTime = (now - globalState.firstScanStartTime.get(this.watchPath)) / 1000;
                const totalFiles = globalState.firstScanFileCount.get(this.watchPath);
                log.info(`[Monitoring] First Scan Complete | Path: ${this.watchPath} | Files: ${totalFiles} | Time: ${totalTime.toFixed(2)}s`);
                globalState.isFirstScanComplete.set(this.watchPath, true);
            } else {
                const currentCount = globalState.firstScanFileCount.get(this.watchPath) + 1;
                globalState.firstScanFileCount.set(this.watchPath, currentCount);
                
                if (currentCount % 1000 === 0) {
                    const timeElapsed = (now - globalState.firstScanStartTime.get(this.watchPath)) / 1000;
                    log.info(`[Monitoring] Scan Progress | Path: ${this.watchPath} | Files: ${currentCount} | Time: ${timeElapsed.toFixed(2)}s`);
                }
            }
        } else if (!fileSet.has(fileName)) {
            log.info(`[Monitoring] New File | Path: ${this.watchPath} | File: ${filePath} | Total Files: ${fileSet.size + 1}`);
        }

        globalState.lastAddTime.set(this.watchPath, now);
        fileSet.add(fileName);
        return fileSet.has(fileName);
    }

    removeFromIndex(filePath) {
        const fileName = this.getBaseName(filePath);
        this.getFileNameSet().delete(fileName);
    }

    async getWatcherStatus() {
        await this.initialize();
        return {
            fileNameSet: this.getFileNameSet().size,
        }
    }

    async findByName(fileFullPath) {
        await this.initialize();
        const fileName = path.basename(fileFullPath);
        if (!this.getFileNameSet().has(fileName)) return null;
        return fileFullPath;
    }

    async findAbsolutePathByName(fileFullPath) {
        await this.initialize();
        const fileName = path.basename(fileFullPath);
        if (!this.getFileNameSet().has(fileName)) return null;
        if (path.isAbsolute(fileFullPath)) {
            return fileFullPath;
        }
        fileFullPath = path.join(this.watchPath, fileFullPath);
        return fileFullPath;
    }

    async findValidFile(fileFullPath) {
        await this.initialize();
        const filePath = await this.findByName(fileFullPath);
        if (!filePath) return null;
        const size = this.getFileSize(fileFullPath);
        if (size <= 0) {
            if(size == 0){
                fs.unlinkSync(fileFullPath);
                log.warn(`[Monitoring] Empty File Removed | Path: ${fileFullPath}`);
            }
            return null;
        }
        const fileName = path.basename(filePath);
        if (!this.getFileNameSet().has(fileName)) {
            this.trackFile(filePath);
        }
        return filePath;
    }

    async close() {
        if (globalState.rescanIntervals.has(this.watchPath)) {
            clearInterval(globalState.rescanIntervals.get(this.watchPath));
            globalState.rescanIntervals.delete(this.watchPath);
        }
        globalState.fileNameSets.delete(this.watchPath);
        globalState.currentIndexes.delete(this.watchPath);
        globalState.loopCounts.delete(this.watchPath);
        globalState.isInitialized.set(this.watchPath, false);
        globalState.scanInProgress.delete(this.watchPath);
        globalState.lastScanTime.delete(this.watchPath);
        globalState.firstScanStartTime.delete(this.watchPath);
        globalState.lastAddTime.delete(this.watchPath);
        globalState.isFirstScanComplete.delete(this.watchPath);
        globalState.firstScanFileCount.delete(this.watchPath);
    }

    async getWatchedFiles() {
        await this.initialize();
        return Array.from(this.getFileNameSet());
    }

    async getNextFile() {
        await this.initialize();
        const files = await this.getWatchedFiles();
        if (files.length === 0) {
            return null;
        }

        let currentIndex = globalState.currentIndexes.get(this.watchPath);
        if (currentIndex >= files.length) {
            globalState.loopCounts.set(this.watchPath, globalState.loopCounts.get(this.watchPath) + 1);
            currentIndex = 0;
        }

        const file = files[currentIndex];
        globalState.currentIndexes.set(this.watchPath, currentIndex + 1);
        return file;
    }

    async getNextFileAndIndex() {
        await this.initialize();
        const file = await this.getNextFile();
        return {
            file: file ? path.join(this.watchPath, file) : null,
            index: globalState.currentIndexes.get(this.watchPath),
            size: this.getFileNameSet().size,
            loopCount: globalState.loopCounts.get(this.watchPath)
        };
    }

    resetRotation() {
        globalState.currentIndexes.set(this.watchPath, 0);
    }
}

module.exports = FileMonitor; 