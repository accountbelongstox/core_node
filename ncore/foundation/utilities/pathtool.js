'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { LEGACY_LINUX_DATA_DIR } = require('../common/system_paths.js');
const LEGACY_LINUX_SHARED_DOWNLOADS_DIR = path.join(LEGACY_LINUX_DATA_DIR, 'shared_downloads');

class PathUtil {

    getSharedDownloadDir() {
        const platform = os.platform();

        if (platform === 'win32') {
            return this._getWindowsSharedDownloadDir();
        } else if (platform === 'linux' || platform === 'darwin') {
            return this._getLinuxSharedDownloadDir();
        }

        return path.join(os.homedir(), 'Downloads');
    }

    _getWindowsSharedDownloadDir() {
        const publicDownloads = 'C:\\Users\\Public\\Downloads';

        if (fs.existsSync(publicDownloads)) {
            try {
                fs.accessSync(publicDownloads, fs.constants.W_OK);
                return publicDownloads;
            } catch (err) {
                // No write permission
            }
        }

        return path.join(os.homedir(), 'Downloads');
    }

    _getLinuxSharedDownloadDir() {
        const sharedPaths = [
            LEGACY_LINUX_SHARED_DOWNLOADS_DIR,
            '/var/tmp/downloads',
            '/opt/downloads'
        ];

        for (const sharedPath of sharedPaths) {
            if (fs.existsSync(sharedPath)) {
                try {
                    fs.accessSync(sharedPath, fs.constants.W_OK);
                    return sharedPath;
                } catch (err) {
                    continue;
                }
            }
        }

        const defaultShared = LEGACY_LINUX_SHARED_DOWNLOADS_DIR;
        try {
            const baseDir = LEGACY_LINUX_DATA_DIR;
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true, mode: 0o777 });
                fs.chmodSync(baseDir, 0o777);
            }
            if (!fs.existsSync(defaultShared)) {
                fs.mkdirSync(defaultShared, { recursive: true, mode: 0o777 });
            }
            fs.chmodSync(defaultShared, 0o777);
            return defaultShared;
        } catch (err) {
            return path.join(os.homedir(), 'Downloads');
        }
    }

    ensureSharedDownloadDir() {
        const sharedDir = this.getSharedDownloadDir();

        try {
            if (!fs.existsSync(sharedDir)) {
                fs.mkdirSync(sharedDir, { recursive: true, mode: 0o777 });
            }

            if (os.platform() !== 'win32') {
                fs.chmodSync(sharedDir, 0o777);
            }

            return sharedDir;
        } catch (err) {
            console.error(`Failed to ensure shared download directory: ${err.message}`);
            return path.join(os.homedir(), 'Downloads');
        }
    }

    getAllUserDownloadDirs() {
        const platform = os.platform();

        if (platform === 'win32') {
            return this._getWindowsUserDownloadDirs();
        } else if (platform === 'linux') {
            return this._getLinuxUserDownloadDirs();
        }

        return [path.join(os.homedir(), 'Downloads')];
    }

    _getWindowsUserDownloadDirs() {
        const dirs = [
            'C:\\Users\\Public\\Downloads'
        ];

        try {
            const usersDir = 'C:\\Users';
            if (fs.existsSync(usersDir)) {
                const users = fs.readdirSync(usersDir);
                for (const user of users) {
                    if (user === 'Public' || user === 'Default' || user === 'All Users') {
                        continue;
                    }
                    const userDownloads = path.join(usersDir, user, 'Downloads');
                    if (fs.existsSync(userDownloads)) {
                        dirs.push(userDownloads);
                    }
                }
            }
        } catch (err) {
            // Ignore errors
        }

        return dirs;
    }

    _getLinuxUserDownloadDirs() {
        const dirs = [
            LEGACY_LINUX_SHARED_DOWNLOADS_DIR
        ];

        try {
            const homeDir = '/home';
            if (fs.existsSync(homeDir)) {
                const users = fs.readdirSync(homeDir);
                for (const user of users) {
                    const userDownloads = path.join(homeDir, user, 'Downloads');
                    if (fs.existsSync(userDownloads)) {
                        dirs.push(userDownloads);
                    }
                }
            }
        } catch (err) {
            // Ignore errors
        }

        const rootDownloads = path.join('/root', 'Downloads');
        if (fs.existsSync(rootDownloads)) {
            dirs.push(rootDownloads);
        }

        return dirs;
    }

    findFileInAllDownloads(filePattern) {
        const allDirs = this.getAllUserDownloadDirs();
        const files = [];

        for (const dir of allDirs) {
            try {
                if (!fs.existsSync(dir)) {
                    continue;
                }

                const dirFiles = fs.readdirSync(dir);
                for (const file of dirFiles) {
                    if (file.match(filePattern)) {
                        const fullPath = path.join(dir, file);
                        const stat = fs.statSync(fullPath);
                        files.push({
                            path: fullPath,
                            mtime: stat.mtime.getTime(),
                            size: stat.size
                        });
                    }
                }
            } catch (err) {
                continue;
            }
        }

        files.sort((a, b) => b.mtime - a.mtime);

        return files.length > 0 ? files[0].path : null;
    }

    async waitForDownloadFile(filePattern, options = {}) {
        const maxWaitTime = options.maxWaitTime || 300000;
        const pollInterval = options.pollInterval || 2000;
        const minFileSize = options.minFileSize || 1024 * 1024;
        const stableTime = options.stableTime || 3000;

        const startTime = Date.now();
        let lastFoundFile = null;
        let lastSize = 0;
        let stableStartTime = null;

        while (Date.now() - startTime < maxWaitTime) {
            const foundFile = this.findFileInAllDownloads(filePattern);

            if (foundFile) {
                try {
                    const stat = fs.statSync(foundFile);
                    const currentSize = stat.size;

                    if (currentSize >= minFileSize) {
                        if (currentSize === lastSize && lastFoundFile === foundFile) {
                            if (!stableStartTime) {
                                stableStartTime = Date.now();
                            } else if (Date.now() - stableStartTime >= stableTime) {
                                return {
                                    success: true,
                                    path: foundFile,
                                    size: currentSize,
                                    waitTime: Date.now() - startTime
                                };
                            }
                        } else {
                            stableStartTime = null;
                            lastSize = currentSize;
                            lastFoundFile = foundFile;
                        }
                    }
                } catch (err) {
                    // File might be in use
                }
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        return {
            success: false,
            error: 'Download timeout',
            waitTime: Date.now() - startTime
        };
    }

    monitorNewDownloadFile(filePattern, options = {}) {
        const pollInterval = options.pollInterval || 2000;
        const callback = options.onFileDetected || (() => {});
        const maxWaitTime = options.maxWaitTime || 300000;

        const startTime = Date.now();
        const initialFiles = new Set();

        const allDirs = this.getAllUserDownloadDirs();
        for (const dir of allDirs) {
            try {
                if (!fs.existsSync(dir)) {
                    continue;
                }

                const dirFiles = fs.readdirSync(dir);
                for (const file of dirFiles) {
                    if (file.match(filePattern)) {
                        initialFiles.add(path.join(dir, file));
                    }
                }
            } catch (err) {
                continue;
            }
        }

        const intervalId = setInterval(() => {
            if (Date.now() - startTime >= maxWaitTime) {
                clearInterval(intervalId);
                callback({ success: false, error: 'Monitor timeout' });
                return;
            }

            for (const dir of allDirs) {
                try {
                    if (!fs.existsSync(dir)) {
                        continue;
                    }

                    const dirFiles = fs.readdirSync(dir);
                    for (const file of dirFiles) {
                        if (file.match(filePattern)) {
                            const fullPath = path.join(dir, file);
                            if (!initialFiles.has(fullPath)) {
                                clearInterval(intervalId);
                                callback({ success: true, path: fullPath });
                                return;
                            }
                        }
                    }
                } catch (err) {
                    continue;
                }
            }
        }, pollInterval);

        return () => clearInterval(intervalId);
    }

    getDownloadConfig() {
        return {
            sharedDir: this.getSharedDownloadDir(),
            searchDirs: this.getAllUserDownloadDirs(),
            defaultDir: this.ensureSharedDownloadDir()
        };
    }

    realpathExisting(targetPath) {
        let current = targetPath;
        const missing = [];

        while (!fs.existsSync(current)) {
            const parent = path.dirname(current);
            if (parent === current) {
                return null;
            }
            missing.unshift(path.basename(current));
            current = parent;
        }

        try {
            return path.join(fs.realpathSync(current), ...missing);
        } catch (error) {
            return null;
        }
    }

    isInside(rootDir, targetPath) {
        const relative = path.relative(rootDir, targetPath);

        return relative === '' || (!path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..');
    }

    resolveInside(rootDir, requestedPath) {
        let root, target;

        if (!rootDir || typeof requestedPath !== 'string' || requestedPath.includes('\0')) {
            return null;
        }

        root = this.realpathExisting(path.resolve(rootDir));
        target = root ? this.realpathExisting(path.resolve(root, requestedPath.replace(/^[\\/]+/, ''))) : null;

        return target && this.isInside(root, target) ? target : null;
    }

}

PathUtil.toString = () => '[class PathUtil]';
module.exports = new PathUtil();
