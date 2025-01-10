const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const log = require('#@/ncore/utils/logger/index.js');

class FileWatcher {
    constructor(watchPath) {
        this.watchPath = watchPath;
        // Use Map as main index for O(1) lookup performance
        this.fileMap = new Map();
        // Use Set for fast filename lookups
        this.fileNameSet = new Set();
        // Use Map for file extension indexing
        this.extensionMap = new Map();

        this.watcher = null;
        this.isInitialized = false;
    }

    /**
     * Initialize file monitoring
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Initial scan of all files
            await this._scanDirectory(this.watchPath);

            // Setup file monitoring
            this.watcher = chokidar.watch(this.watchPath, {
                persistent: true,
                ignoreInitial: true,
                interval: 100,
                binaryInterval: 300,
                depth: 1,
                awaitWriteFinish: {
                    stabilityThreshold: 2000,
                    pollInterval: 100
                }
            });

            // Setup file change listeners
            this._setupWatchers();

            this.isInitialized = true;
            log.success(`File watcher initialized with ${this.fileMap.size} files`);
        } catch (error) {
            log.error('Failed to initialize file watcher:', error);
            throw error;
        }
    }

    /**
     * Scan directory and build indexes
     */
    async _scanDirectory(dirPath) {
        const files = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);

            if (file.isDirectory()) {
                await this._scanDirectory(fullPath);
            } else {
                this._addToIndex(fullPath);
            }
        }
    }

    /**
     * Add file to indexes
     */
    _addToIndex(filePath) {
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        this.fileMap.set(filePath, {
            name: fileName,
            extension: ext,
            size: fs.statSync(filePath).size,
            lastModified: fs.statSync(filePath).mtime
        });

        this.fileNameSet.add(fileName);

        if (!this.extensionMap.has(ext)) {
            this.extensionMap.set(ext, new Set());
        }
        this.extensionMap.get(ext).add(filePath);
    }

    /**
     * Remove file from indexes
     */
    _removeFromIndex(filePath) {
        const fileInfo = this.fileMap.get(filePath);
        if (!fileInfo) return;

        this.fileNameSet.delete(fileInfo.name);
        this.extensionMap.get(fileInfo.extension)?.delete(filePath);
        this.fileMap.delete(filePath);
    }

    /**
     * Setup file monitoring events
     */
    _setupWatchers() {
        this.watcher
            .on('add', path => this._addToIndex(path))
            .on('change', path => this._addToIndex(path))
            .on('unlink', path => this._removeFromIndex(path))
            .on('error', error => log.error(`Watcher error: ${error}`))
            .on('addDir', path => log.info(`Directory ${path} has been added`))
            .on('unlinkDir', path => log.info(`Directory ${path} has been removed`))
            .on('ready', () => log.info('Initial scan complete. Ready for changes'))
            .on('raw', (event, path, details) => { // internal
              log.info('Raw event info:', event, path, details);
            });
    }

    /**
     * Find file by name quickly
     */
    async findByName(fileFullPath) {
        await this.initialize();
        const fileName = path.basename(fileFullPath);
        if (!this.fileNameSet.has(fileName)) return null;
        for (const [filePath, info] of this.fileMap) {
            if (info.name === fileName) return filePath;
        }
        return null;
    }

    async findValidFile(fileFullPath) {
        await this.initialize();
        const filePath = await this.findByName(fileFullPath);
        if (!filePath) return null;
        try {
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                fs.unlinkSync(filePath);
                log.warn(`Removed empty file: ${filePath}`);
                return null;
            }
            return filePath;
        } catch (error) {
            log.error(`Error checking file ${filePath}:`, error);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    log.warn(`Removed invalid file: ${filePath}`);
                }
            } catch (e) {
                log.error(`Error removing file ${filePath}:`, e);
            }
            return null;
        }
    }

    /**
     * Find files by extension
     */
    findByExtension(ext) {
        ext = ext.toLowerCase();
        return Array.from(this.extensionMap.get(ext) || []);
    }

    /**
     * Get file information
     */
    getFileInfo(filePath) {
        return this.fileMap.get(filePath);
    }

    /**
     * Stop monitoring
     */
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
}

module.exports = FileWatcher; 