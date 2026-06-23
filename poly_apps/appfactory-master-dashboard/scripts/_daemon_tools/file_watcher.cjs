/**
 * File Watcher - Monitor Directory for File Changes
 *
 * File watcher using Node.js native fs.watch to monitor directory changes.
 * Designed for daemon services that need to process files as they appear.
 *
 * Features:
 * - Watch directory recursively using native fs.watch
 * - Detect new files, modified files
 * - Filter by file patterns
 * - Event-driven architecture
 *
 * Usage:
 *   const FileWatcher = require('./file_watcher');
 *
 *   const watcher = new FileWatcher({
 *       watchPath: '/path/to/watch',
 *       ignored: ['**\/*.en.js']
 *   });
 *
 *   watcher.on('file:new', (filePath, stats) => {
 *       console.log('New file:', filePath);
 *   });
 *
 *   watcher.on('file:modified', (filePath, stats) => {
 *       console.log('Modified file:', filePath);
 *   });
 *
 *   watcher.start();
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class FileWatcher extends EventEmitter {
    constructor(options = {}) {
        super();

        this.watchPath = options.watchPath;
        this.ignored = options.ignored || [];
        this.persistent = options.persistent !== false;

        this.watchers = new Map();
        this.trackedFiles = new Map();
        this.ready = false;

        this._validateOptions();
    }

    _validateOptions() {
        if (!this.watchPath) {
            throw new Error('watchPath is required');
        }

        if (!fs.existsSync(this.watchPath)) {
            fs.mkdirSync(this.watchPath, { recursive: true });
        }
    }

    _shouldIgnore(filePath) {
        for (const pattern of this.ignored) {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
                if (regex.test(filePath)) {
                    return true;
                }
            } else if (filePath.includes(pattern)) {
                return true;
            }
        }
        return false;
    }

    _scanDirectory(dirPath) {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const filePath = path.join(dirPath, file);

            if (this._shouldIgnore(filePath)) {
                continue;
            }

            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                this._watchDirectory(filePath);
                this._scanDirectory(filePath);
            } else {
                this.trackedFiles.set(filePath, stats.mtimeMs);
            }
        }
    }

    _watchDirectory(dirPath) {
        if (this.watchers.has(dirPath)) {
            return;
        }

        const watcher = fs.watch(dirPath, { persistent: this.persistent }, (eventType, filename) => {
            if (!filename) {
                return;
            }

            const filePath = path.join(dirPath, filename);

            if (this._shouldIgnore(filePath)) {
                return;
            }

            if (!fs.existsSync(filePath)) {
                if (this.trackedFiles.has(filePath)) {
                    this.trackedFiles.delete(filePath);
                    this.emit('file:deleted', filePath);
                }
                return;
            }

            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                this._watchDirectory(filePath);
                this._scanDirectory(filePath);
                return;
            }

            const lastMtime = this.trackedFiles.get(filePath);

            if (!lastMtime) {
                this.trackedFiles.set(filePath, stats.mtimeMs);
                if (this.ready) {
                    const relativePath = path.relative(this.watchPath, filePath);
                    console.log(`[FileWatcher] New file: ${relativePath}`);
                    this.emit('file:new', filePath, stats);
                }
            } else if (stats.mtimeMs > lastMtime) {
                this.trackedFiles.set(filePath, stats.mtimeMs);
                if (this.ready) {
                    const relativePath = path.relative(this.watchPath, filePath);
                    console.log(`[FileWatcher] Modified file: ${relativePath}`);
                    this.emit('file:modified', filePath, stats);
                }
            }
        });

        watcher.on('error', (error) => {
            console.error(`[FileWatcher] Error watching ${dirPath}:`, error);
            this.emit('error', error);
        });

        this.watchers.set(dirPath, watcher);
    }

    start() {
        if (this.ready) {
            console.warn('[FileWatcher] Already started');
            return;
        }

        console.log('[FileWatcher] Starting watcher');
        console.log('  Watch path:', this.watchPath);
        console.log('  Ignored patterns:', this.ignored);

        this._scanDirectory(this.watchPath);
        this._watchDirectory(this.watchPath);

        this.ready = true;
        console.log('[FileWatcher] Ready - watching for changes');
        console.log(`  Tracking ${this.trackedFiles.size} existing files`);
        this.emit('ready');
    }

    stop() {
        if (!this.ready) {
            return;
        }

        console.log('[FileWatcher] Stopping watcher');

        for (const watcher of this.watchers.values()) {
            watcher.close();
        }

        this.watchers.clear();
        this.ready = false;
    }

    getTrackedFiles() {
        return Array.from(this.trackedFiles.keys());
    }

    getTrackedFileCount() {
        return this.trackedFiles.size;
    }
}

module.exports = FileWatcher;
