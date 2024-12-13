import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { bdir } from '#@/ncore/gvar/bdir.js';
import { execSync } from 'child_process';
import logger from '#@utils_logger';

export function getPlatformShell() {
    return process.platform === 'win32' ? 
        { shell: true, command: 'cmd.exe', args: ['/c'] } : 
        { shell: '/bin/sh', command: '/bin/sh', args: ['-c'] };
}

export function pipeExecCmd(command, useShell = true, cwd = null, inheritIO = true, env = process.env) {
    try {
        const platformShell = getPlatformShell();
        const options = {
            shell: useShell ? platformShell.shell : false,
            cwd: cwd || process.cwd(),
            stdio: inheritIO ? 'inherit' : 'pipe',
            env: env
        };

        if (Array.isArray(command)) {
            command = command.join(' ');
        }

        return execSync(command, options);
    } catch (error) {
        console.error(`Command execution failed: ${command}`);
        console.error(error);
        throw error;
    }
}

class Downloader {
    constructor() {
        this.curl = bdir.getCurlExecutable();
        this.tmpDir = this._initTmpDir();
        this.md5Dir = path.join(this.tmpDir, 'md5');
        this._showInitInfo();
    }

    _showInitInfo() {
        logger.info('Downloader initialized with:');
        logger.info(`Platform: ${process.platform}`);
        logger.info(`Curl executable: ${this.curl}`);
        logger.info(`Temporary directory: ${this.tmpDir}`);
        logger.info(`MD5 cache directory: ${this.md5Dir}`);
    }

    _getDriveInfo(drive) {
        try {
            if (process.platform === 'win32') {
                const command = `powershell -Command "Get-WmiObject Win32_LogicalDisk -Filter \\"DeviceID='${drive.charAt(0)}:'\\" | Select-Object Size,FreeSpace"`;
                const output = execSync(command, { encoding: 'utf8' });
                const matches = output.match(/Size\s*:\s*(\d+)\s*FreeSpace\s*:\s*(\d+)/);
                if (matches) {
                    return {
                        size: parseInt(matches[1]),
                        free: parseInt(matches[2])
                    };
                }
            } else {
                const stats = fs.statSync(drive);
                return {
                    size: stats.size || 0,
                    free: (stats.size || 0) - (stats.used || 0)
                };
            }
        } catch (error) {
            logger.warning(`Unable to get drive info for ${drive}: ${error.message}`);
            return {
                size: 0,
                free: 0
            };
        }
    }

    _formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    _getCacheStats() {
        let totalSize = 0;
        let totalFiles = 0;

        try {
            if (fs.existsSync(this.tmpDir)) {
                const files = fs.readdirSync(this.tmpDir);
                totalFiles = files.length;
                files.forEach(file => {
                    const filePath = path.join(this.tmpDir, file);
                    if (fs.statSync(filePath).isFile()) {
                        totalSize += fs.statSync(filePath).size;
                    }
                });
            }
        } catch (error) {
            logger.error('Error reading cache stats:', error);
        }

        return { totalFiles, totalSize };
    }

    _initTmpDir() {
        let tmpDir;
        if (process.platform === 'win32') {
            tmpDir = this._getWindowsTmpDir();
        } else {
            tmpDir = path.join('/home', '.tmp', 'downloads');
        }

        [tmpDir, path.join(tmpDir, 'md5')].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        return tmpDir;
    }

    _getWindowsTmpDir() {
        const eDriveTmp = 'E:\\.tmp';
        if (this._isDriveAvailable('E:\\')) {
            try {
                if (!fs.existsSync(eDriveTmp)) {
                    fs.mkdirSync(eDriveTmp, { recursive: true });
                }
                return eDriveTmp;
            } catch (error) {
                logger.warning('Could not use or create E:\\.tmp');
            }
        }

        for (let i = 69; i >= 68; i--) { // E to D
            const drive = String.fromCharCode(i) + ':\\';
            const driveTmp = path.join(drive, '.tmp');
            if (this._isDriveAvailable(drive)) {
                try {
                    if (!fs.existsSync(driveTmp)) {
                        fs.mkdirSync(driveTmp, { recursive: true });
                    }
                    return driveTmp;
                } catch (error) {
                    logger.warning(`Could not use or create ${driveTmp}`);
                }
            }
        }

        // Fallback to C:\.tmp
        const cDriveTmp = 'C:\\.tmp';
        try {
            if (!fs.existsSync(cDriveTmp)) {
                fs.mkdirSync(cDriveTmp, { recursive: true });
            }
            return cDriveTmp;
        } catch (error) {
            logger.error('Failed to create temporary directory in C: drive:', error);
            throw new Error('Could not create temporary directory in any drive');
        }
    }

    _isDriveAvailable(drive) {
        try {
            fs.accessSync(drive, fs.constants.R_OK | fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    _getWindowsDrives() {
        const drives = [];
        // Only check C, D, and E drives
        for (let i = 67; i <= 69; i++) { // C to E
            const drive = String.fromCharCode(i) + ':\\';
            if (this._isDriveAvailable(drive)) {
                drives.push(drive);
            }
        }
        return drives;
    }

    _getMd5(data) {
        return crypto.createHash('md5').update(data).digest('hex');
    }

    _getUrlMd5(url) {
        return this._getMd5(url);
    }

    _getMd5FilePath(url) {
        const md5Name = this._getUrlMd5(url);
        return path.join(this.md5Dir, `${md5Name}.md5`);
    }

    _getCachedFilePath(url) {
        const md5Name = this._getUrlMd5(url);
        return path.join(this.tmpDir, md5Name);
    }

    _verifyMd5(filePath, expectedMd5) {
        try {
            const fileData = fs.readFileSync(filePath);
            const actualMd5 = this._getMd5(fileData);
            return actualMd5 === expectedMd5;
        } catch (error) {
            return false;
        }
    }

    _sanitizeFileName(url) {
        try {
            const urlObj = new URL(url);
            let fileName = path.basename(urlObj.pathname);
            if (!path.extname(fileName) || fileName === '' || /[<>:"/\\|?*]/.test(fileName)) {
                fileName = urlObj.pathname.split('/').filter(Boolean).pop() || urlObj.hostname;
                if (!path.extname(fileName)) {
                    fileName += '.html';
                }
            }

            fileName = fileName
                .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars
                .replace(/\s+/g, '_')           // Replace spaces
                .replace(/_+/g, '_')            // Remove multiple underscores
                .substring(0, 255);             // Limit length

            return fileName || `download_${this._getUrlMd5(url).substring(0, 8)}`;
        } catch (error) {
            // Fallback to MD5 hash if URL parsing fails
            return `download_${this._getUrlMd5(url).substring(0, 8)}.bin`;
        }
    }

    download(url, saveDir = null, options = {}) {
        const {
            removeOld = true,
            createDir = true
        } = options;

        try {
            const fileName = this._sanitizeFileName(url);
            const targetDir = saveDir || this.tmpDir;
            
            if (createDir && !fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            const filePath = path.join(targetDir, fileName);
            const md5FilePath = this._getMd5FilePath(url);
            const cachedFilePath = this._getCachedFilePath(url);

            // Log download info
            logger.info('Download details:');
            logger.info(`URL: ${url}`);
            logger.info(`Target file: ${filePath}`);
            logger.info(`Cache file: ${cachedFilePath}`);

            // Check if we have a cached version
            if (fs.existsSync(md5FilePath) && fs.existsSync(cachedFilePath)) {
                const expectedMd5 = fs.readFileSync(md5FilePath, 'utf8').trim();
                const isValid = this._verifyMd5(cachedFilePath, expectedMd5);

                if (isValid) {
                    logger.info('Using cached file');
                    fs.copyFileSync(cachedFilePath, filePath);
                    return filePath;
                } else {
                    logger.warning('Cache invalid, cleaning up');
                    fs.unlinkSync(cachedFilePath);
                    fs.unlinkSync(md5FilePath);
                }
            }

            if (removeOld && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            logger.info('Starting download...');
            const command = `${this.curl} -L -k -o "${cachedFilePath}" "${url}"`;
            pipeExecCmd(command);

            if (!fs.existsSync(cachedFilePath)) {
                throw new Error('Download failed: File not found after download');
            }

            const fileData = fs.readFileSync(cachedFilePath);
            const md5 = this._getMd5(fileData);
            fs.writeFileSync(md5FilePath, md5);

            fs.copyFileSync(cachedFilePath, filePath);
            logger.success('Download completed successfully');

            return filePath;
        } catch (error) {
            logger.error('Download failed:', error);
            throw error;
        }
    }
}

export default new Downloader(); 