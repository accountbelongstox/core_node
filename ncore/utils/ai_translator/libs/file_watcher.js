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

const path = require('path');
const logger = require('#@logger');
const { freader } = require('#@btools');
const { fdir } = require('#@ncore/foundation/utilities/filetoollibs/index.js');
const FileMonitor = require('#@ncore/foundation/utilities/filetoollibs/fmonitor.js');
const crypto = require('crypto');

class FileWatcher {
    constructor(watchPaths = [], supportedExtensions = ['.md', '.txt', '.str'], options = {}) {
        this.watchPaths = Array.isArray(watchPaths) ? watchPaths : [watchPaths];
        this.supportedExtensions = supportedExtensions;
        this.monitors = new Map();
        this.fileStates = new Map();
        this.changedFiles = new Set();
        this.isInitialized = false;
        
        // Handle options
        this.watchDepth = options.watchDepth || 10;
        this.skipFolders = options.skipFolders || [];
        this.skipFiles = options.skipFiles || [];
        this.skipExtensions = options.skipExtensions || [];
    }

    async initialize() {
        if (this.isInitialized) {
            logger.warn('[File Watcher] Already initialized');
            return;
        }

        try {
            logger.info('[File Watcher] Initializing file monitoring...');

            for (const watchPath of this.watchPaths) {
                if (!freader.isExists(watchPath)) {
                    logger.warn(`[File Watcher] Watch path does not exist: ${watchPath}`);
                    continue;
                }

                logger.debug(`[File Watcher] Creating monitor for: ${watchPath}`);
                const monitor = new FileMonitor(watchPath, {
                    rescanInterval: 30000 // 30 seconds
                });
                
                logger.debug(`[File Watcher] Monitor created, initializing...`);
                await monitor.initialize();
                logger.debug(`[File Watcher] Monitor initialized successfully`);
                this.monitors.set(watchPath, monitor);

                await this.scanInitialFiles(watchPath);
                logger.info(`[File Watcher] Monitoring: ${watchPath}`);
            }

            this.isInitialized = true;
            logger.info('[File Watcher] File monitoring initialized');

        } catch (error) {
            logger.error(`[File Watcher] Initialization failed: ${error.message}`);
            throw error;
        }
    }

    async scanInitialFiles(watchPath) {
        try {
            const files = await this.scanDirectory(watchPath);
            
            for (const filePath of files) {
                if (this.isSupportedFile(filePath)) {
                    const stats = await this.getFileStats(filePath);
                    if (stats) {
                        this.fileStates.set(filePath, {
                            mtime: stats.mtime,
                            size: stats.size,
                            hash: await this.getFileHash(filePath)
                        });
                    }
                }
            }

            logger.debug(`[File Watcher] Scanned ${files.length} files in ${watchPath}`);

        } catch (error) {
            logger.error(`[File Watcher] Error scanning initial files: ${error.message}`);
        }
    }

    async scanDirectory(dirPath) {
        try {
            const files = fdir.scanDirectoryDeep(dirPath, {
                onlyFiles: true,
                exclude: ['node_modules', '.git', '.cache']
            });
            return files;
        } catch (error) {
            logger.error(`[File Watcher] Error scanning directory ${dirPath}: ${error.message}`);
            return [];
        }
    }

    isSupportedFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }

    async getFileStats(filePath) {
        try {
            const stats = freader.getFileStats(filePath);
            return stats;
        } catch (error) {
            logger.error(`[File Watcher] Error getting file stats for ${filePath}: ${error.message}`);
            return null;
        }
    }

    async getFileHash(filePath) {
        try {
            const content = freader.readText(filePath);
            return crypto.createHash('md5').update(content, 'utf8').digest('hex');
        } catch (error) {
            logger.error(`[File Watcher] Error calculating hash for ${filePath}: ${error.message}`);
            return null;
        }
    }

    async getChangedFiles() {
        const changedFiles = [];

        try {
            for (const [watchPath, monitor] of this.monitors) {
                await monitor.scanDir(true);
                const currentFiles = await this.scanDirectory(watchPath);

                for (const filePath of currentFiles) {
                    if (!this.isSupportedFile(filePath)) {
                        continue;
                    }

                    const currentStats = await this.getFileStats(filePath);
                    if (!currentStats || !currentStats.isFile) {
                        continue;
                    }

                    const previousState = this.fileStates.get(filePath);
                    const currentHash = await this.getFileHash(filePath);

                    if (!previousState) {
                        // New file
                        this.fileStates.set(filePath, {
                            mtime: currentStats.mtime,
                            size: currentStats.size,
                            hash: currentHash
                        });
                        changedFiles.push(filePath);
                        logger.info(`[File Watcher] New file detected: ${filePath}`);
                        
                    } else if (previousState.hash !== currentHash) {
                        // Modified file
                        this.fileStates.set(filePath, {
                            mtime: currentStats.mtime,
                            size: currentStats.size,
                            hash: currentHash
                        });
                        changedFiles.push(filePath);
                        logger.info(`[File Watcher] Modified file detected: ${filePath}`);
                    }
                }
            }

        } catch (error) {
            logger.error(`[File Watcher] Error checking for changed files: ${error.message}`);
        }

        return changedFiles;
    }

    addWatchPath(watchPath) {
        if (!this.watchPaths.includes(watchPath)) {
            this.watchPaths.push(watchPath);
            
            if (this.isInitialized) {
                this.initializeNewPath(watchPath);
            }
        }
    }

    async initializeNewPath(watchPath) {
        try {
            if (!freader.isExists(watchPath)) {
                logger.warn(`[File Watcher] New watch path does not exist: ${watchPath}`);
                return;
            }

            const monitor = new FileMonitor(watchPath, {
                rescanInterval: 30000
            });

            await monitor.initialize();
            this.monitors.set(watchPath, monitor);
            await this.scanInitialFiles(watchPath);

            logger.info(`[File Watcher] Added new watch path: ${watchPath}`);

        } catch (error) {
            logger.error(`[File Watcher] Error adding new watch path ${watchPath}: ${error.message}`);
        }
    }

    removeWatchPath(watchPath) {
        const index = this.watchPaths.indexOf(watchPath);
        if (index > -1) {
            this.watchPaths.splice(index, 1);
            
            if (this.monitors.has(watchPath)) {
                const monitor = this.monitors.get(watchPath);
                monitor.close();
                this.monitors.delete(watchPath);
            }

            // Remove file states for this path
            for (const [filePath] of this.fileStates) {
                if (filePath.startsWith(watchPath)) {
                    this.fileStates.delete(filePath);
                }
            }

            logger.info(`[File Watcher] Removed watch path: ${watchPath}`);
        }
    }

    getWatchedFiles() {
        return Array.from(this.fileStates.keys());
    }

    getWatchPaths() {
        return this.watchPaths.slice();
    }

    getFileState(filePath) {
        return this.fileStates.get(filePath);
    }

    async close() {
        logger.info('[File Watcher] Closing file monitors...');

        for (const [watchPath, monitor] of this.monitors) {
            try {
                await monitor.close();
            } catch (error) {
                logger.error(`[File Watcher] Error closing monitor for ${watchPath}: ${error.message}`);
            }
        }

        this.monitors.clear();
        this.fileStates.clear();
        this.changedFiles.clear();
        this.isInitialized = false;

        logger.info('[File Watcher] File monitoring closed');
    }
}

module.exports = FileWatcher;