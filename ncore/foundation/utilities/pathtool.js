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

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

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
            '/usr/_core_node/shared_downloads',
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

        const defaultShared = '/usr/_core_node/shared_downloads';
        try {
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
            '/usr/_core_node/shared_downloads'
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

}

PathUtil.toString = () => '[class PathUtil]';
module.exports = new PathUtil();
