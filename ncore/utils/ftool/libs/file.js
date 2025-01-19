const fs = require('fs');
const path = require('path');
let log;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

class File {
    exists(filename) { 
        return fs.existsSync(filename);
    }

    isFile(filename) {
        if (!filename || typeof filename !== "string") {
            return false;
        }
        if (fs.existsSync(filename)) {
            const stats = fs.statSync(filename);
            return stats.isFile();
        }
        return false;
    }

    isAbsulutePath(filename) {
        return path.isAbsolute(filename);
    }

    isValideFile(filename) {
        const isValidFile = this.isFile(filename) && this.getFileSize(filename) > 0;
        return isValidFile ? filename : null;
    }

    isDir(filename) {
        if (!filename || typeof filename !== "string") {
            return false;
        }
        if (fs.existsSync(filename)) {
            const stats = fs.statSync(filename);
            return stats.isDirectory();
        }
        return false;
    }

    deleteSync(filename) {
        if (fs.existsSync(filename)) {
            if (fs.lstatSync(filename).isDirectory()) {
                this.deleteFolder(filename);
            } else {
                this.deleteFile(filename);
            }
        }
    }

    delete(filename) {
        if (fs.existsSync(filename)) {
            if (this.isDir(filename)) {
                this.deleteFolderAsync(filename);
            } else {
                this.deleteFile(filename);
            }
        }
    }

    deleteFile(filePath) {
        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            log.error(`Failed to delete file: ${error}`);
        }
    }

    deleteFolder(folderPath) {
        if (fs.existsSync(folderPath)) {
            if (fs.lstatSync(folderPath).isDirectory() && !folderPath.endsWith('.asar')) {
                fs.rmSync(folderPath, {
                    force: true,
                    recursive: true,
                    maxRetries: 50,
                    retryDelay: 1000,
                });
            } else {
                fs.unlinkSync(folderPath);
            }
        }
    }

    deleteFolderAsync(folderPath) {
        if (this.isLocked(folderPath)) {
            setTimeout(() => {
                this.deleteFolderAsync(folderPath);
            }, 500);
        } else {
            if (this.isDir(folderPath) && !folderPath.endsWith('.asar')) {
                fs.rmdirSync(folderPath, { recursive: true });
            } else {
                fs.unlinkSync(folderPath);
            }
        }
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
            return -1;
        }
    }

    getModificationTime(fp) {
        if (!fs.existsSync(fp)) {
            return 0;
        }
        try {
            const stats = fs.statSync(fp);
            return stats.mtime.getTime();
        } catch (error) {
            log.error(`Error getting modification time: ${error.message}`);
            return 0;
        }
    }

    isModifiedYesterday(fp) {
        const modificationTime = this.getModificationTime(fp);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return modificationTime < yesterday.getTime();
    }

    mkdir(directoryPath) {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }
        return directoryPath;
    }

    isUpdateFile(source, target) {
        if (!this.isFile(target)) {
            return true;
        }
        return this.getModificationTime(source) > this.getModificationTime(target);
    }

    isLocked(fPath) {
        if (fs.existsSync(fPath)) {
            if (this.isDir(fPath)) {
                return this.isDirectoryLocked(fPath);
            } else {
                return this.isFileLocked(fPath);
            }
        }
        return false;
    }

    isFileLocked(filePath) {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        try {
            const fd = fs.openSync(filePath, 'r+');
            fs.closeSync(fd);
            return false;
        } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                return true;
            }
            return false;
        }
    }

    isDirectoryLocked(dirPath) {
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            return false;
        }
        const tempName = path.join(path.dirname(dirPath), `temp_${Date.now()}_${path.basename(dirPath)}`);
        try {
            fs.renameSync(dirPath, tempName);
            fs.renameSync(tempName, dirPath);
            return false;
        } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                return true;
            }
            return false;
        }
    }

    rename(oldPath, newPath) {
        try {
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
            }
        } catch (e) {
            log.error(`Failed to rename file: ${e}`);
        }
    }
}

File.toString = () => '[class File]';
module.exports = new File();