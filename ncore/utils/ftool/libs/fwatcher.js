const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const log = require('#@/ncore/utils/logger/index.js');

class FileWatcher {
    constructor(watchPath) {
        this.watchPath = watchPath;
        this.fileMap = new Map();
        this.fileNameSet = new Set();
        this.extensionMap = new Map();
        this.watcher = null;
        this.isInitialized = false;
        this.currentIndex = 0;
        this.loopCount = 0;
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            await this._scanDirectory(this.watchPath);
            this.watcher = chokidar.watch(this.watchPath);
            this._setupWatchers();
            this.isInitialized = true;
            log.warn(`File watcher initialized with ${this.fileNameSet.size} files`);
        } catch (error) {
            log.error('Failed to initialize file watcher:', error);
            throw error;
        }
    }

    async _scanDirectory(dirPath) {
        const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);
            if (file.isDirectory()) {
                await this._scanDirectory(fullPath);
            } else {
                this.addToIndex(fullPath);
            }
        }
    }

    getBaseName(filePath){
        const fileName = path.basename(filePath);
        return fileName
    }
    
    getFileSize(filePath) {
        if (!fs.existsSync(filePath)) {
            return -1;
        }
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch (error) {
            log.error(`Failed to get file size: ${error}`);
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
            log.error(`Error getting modification time: ${error.message}`);
            return 0;
        }
    }

    addToIndex(filePath) {
        const fileName = path.basename(filePath);
        // const ext = path.extname(filePath).toLowerCase();
        // const size = this.getFileSize(filePath);
        // const lastModified = this.getModificationTime(filePath);
        // this.fileMap.set(filePath, {
        //     name: fileName,
        //     extension: ext,
        //     size: size,
        //     lastModified: lastModified
        // });
        this.fileNameSet.add(fileName);
        // if (!this.extensionMap.has(ext)) {
        //     this.extensionMap.set(ext, new Set());
        // }
        // this.extensionMap.get(ext).add(filePath);
        let added = false;
        if(this.fileNameSet.has(fileName)){
            added = true;
        }
        return added;
    }

    _removeFromIndex(filePath) {
        const fileName = this.getBaseName(filePath)
        this.fileNameSet.delete(fileName);
    }

    _setupWatchers() {
        this.watcher
            .on('add', path => this.addToIndex(path))
            .on('change', path => this.addToIndex(path))
            .on('unlink', path => this._removeFromIndex(path))
            .on('error', error => log.error(`Watcher error: ${error}`))
            .on('addDir', path => log.info(`Directory ${path} has been added`))
            .on('unlinkDir', path => log.info(`Directory ${path} has been removed`))
            .on('ready', () => log.info('Initial scan complete. Ready for changes'))
            .on('raw', (event, path, details) => { // internal
              log.info('Raw event info:', event, path, details);
            });
    }

    async getWatcherStatus(){
        await this.initialize();
        return {
            // fileCount: this.fileMap.size,
            fileNameSet: this.fileNameSet.size,
            extensionMap: this.extensionMap.size,
        }
    }

    /**
     * Find file by name quickly
     */
    async findByName(fileFullPath) {
        await this.initialize();
        const fileName = path.basename(fileFullPath);
        if (!this.fileNameSet.has(fileName)) return null;
        return fileFullPath;
    }

    async findAbsolutePathByName(fileFullPath) {
        await this.initialize();
        const fileName = path.basename(fileFullPath);
        if (!this.fileNameSet.has(fileName)) return null;
        if( path.isAbsolute(fileFullPath)){
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
                log.warn(`Removed empty file: ${fileFullPath}`);
            }
            return null;
        }
        const fileName = path.basename(filePath);
        if (!this.fileNameSet.has(fileName)) {
            this.addToIndex(filePath)
        }
        return filePath;
    }

    async close() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
        this.fileMap.clear();
        this.fileNameSet.clear();
        this.extensionMap.clear();
        this.isInitialized = false;
    }

    async getWatchedFiles() {
        await this.initialize();
        return Array.from(this.fileNameSet);
    }

    async getNextFile() {
        await this.initialize();
        const files = await this.getWatchedFiles();
        if (files.length === 0) {
            return null;
        }

        if (this.currentIndex >= files.length) {
            this.loopCount++;
            this.currentIndex = 0;
        }

        const file = files[this.currentIndex];
        this.currentIndex++;
        return file;
    }

    async getNextFileAndIndex() {
        await this.initialize();
        const file = await this.getNextFile();
        const index = this.currentIndex;
        return {
            file:file ? path.join(this.watchPath,file) : null,
            index,
            size:this.fileNameSet.size,
            loopCount: this.loopCount
        };
    }

    resetRotation() {
        this.currentIndex = 0;
    }
}

module.exports = FileWatcher; 