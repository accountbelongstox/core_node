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

function fsexists(filename) { 
    return fs.existsSync(filename);
}

function isFile(filename) {
    if (!filename || typeof filename !== "string") {
        return false;
    }
    if (fs.existsSync(filename)) {
        const stats = fs.statSync(filename);
        return stats.isFile();
    }
    return false;
}

function isAbsolutePath(filename) {
    return path.isAbsolute(filename);
}

function isValidFile(filename) {
    const isValidFile = isFile(filename) && getFileSize(filename) > 0;
    return isValidFile ? filename : null;
}

function isDir(filename) {
    if (!filename || typeof filename !== "string") {
        return false;
    }
    if (fs.existsSync(filename)) {
        const stats = fs.statSync(filename);
        return stats.isDirectory();
    }
    return false;
}

function deleteSync(filename) {
    if (fs.existsSync(filename)) {
        if (fs.lstatSync(filename).isDirectory()) {
            deleteFolder(filename);
        } else {
            deleteFile(filename);
        }
    }
}

function deleteFileOrDir(filename) {
    if (fs.existsSync(filename)) {
        if (isDir(filename)) {
            deleteFolderAsync(filename);
        } else {
            deleteFile(filename);
        }
    }
}

function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        log.error(`Failed to delete file: ${error}`);
    }
}

function deleteFolder(folderPath) {
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

function deleteFolderAsync(folderPath) {
    if (isLocked(folderPath)) {
        setTimeout(() => {
            deleteFolderAsync(folderPath);
        }, 500);
    } else {
        if (isDir(folderPath) && !folderPath.endsWith('.asar')) {
            fs.rmdirSync(folderPath, { recursive: true });
        } else {
            fs.unlinkSync(folderPath);
        }
    }
}

function getFileSize(filePath) {
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

function getModificationTime(fp) {
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

function isModifiedYesterday(fp) {
    const modificationTime = getModificationTime(fp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return modificationTime < yesterday.getTime();
}

function mkdir(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
    return directoryPath;
}

function isUpdateFile(source, target) {
    if (!isFile(target)) {
        return true;
    }
    return getModificationTime(source) > getModificationTime(target);
}

function isLocked(fPath) {
    if (fs.existsSync(fPath)) {
        if (isDir(fPath)) {
            return isDirectoryLocked(fPath);
        } else {
            return isFileLocked(fPath);
        }
    }
    return false;
}

function isFileLocked(filePath) {
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

function isDirectoryLocked(dirPath) {
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

function fsrename(oldPath, newPath) {
    try {
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
        }
    } catch (e) {
        log.error(`Failed to rename file: ${e}`);
    }
}

module.exports = {
    fsexists,
    isFile,
    isAbsolutePath,
    isValidFile,
    isDir,
    deleteSync,
    deleteFileOrDir,
    deleteFile,
    deleteFolder,
    deleteFolderAsync,
    getFileSize,
    getModificationTime,
    isModifiedYesterday,
    mkdir,
    isUpdateFile,
    isLocked,
    isFileLocked,
    isDirectoryLocked,
    fsrename
};
