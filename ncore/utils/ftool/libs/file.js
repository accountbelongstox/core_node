'use strict';
import fs from 'fs';
import path from 'path';
// import util from 'util';
import { promises as fsPromises } from 'fs';
import Base from '#@base';

class File extends Base {
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

    async delete(filename) {
        if (fs.existsSync(filename)) {
            if ((await fs.lstat(filename)).isDirectory()) {
                await this.deleteFolderAsync(filename);
            } else {
                await fsPromises.unlink(filename);
            }
        }
    }

    deleteFile(filePath) {
        fs.unlinkSync(filePath);
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

    async deleteFolderAsync(folderPath) {
        if (this.isLocked(folderPath)) {
            setTimeout(() => {
                this.deleteFolderAsync(folderPath);
            }, 500);
        } else {
            if ((await fsPromises.lstat(folderPath)).isDirectory() && !folderPath.endsWith('.asar')) {
                await fsPromises.rmdir(folderPath, { recursive: true });
            } else {
                await fsPromises.unlink(folderPath);
            }
        }
    }

    async fsExists(fPath) {
        try {
            await fs.access(fPath);
            return true;
        } catch {
            return false;
        }
    }

    readFile(filePath) {
        try {
            return this.read(filePath, 'utf-8');
        } catch (err) {
            console.error(`Failed to read file: ${err}`);
            return null;
        }
    }

    readLines(filePath) {
        try {
            const rawData = this.read(filePath, 'utf-8');
            return rawData.split('\n');
        } catch (err) {
            console.error(`Failed to read file: ${err}`);
            return [];
        }
    }

    readFirstLine(filePath) {
        try {
            const rawData = this.read(filePath, 'utf-8');
            return rawData.split('\n')[0];
        } catch (err) {
            console.error(`Failed to read file: ${err}`);
            return '';
        }
    }

    readBinary(filePath) {
        try {
            return this.read(filePath, 'utf-8');
        } catch (err) {
            console.error(`Failed to read file: ${err}`);
            return null;
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
            console.error(`Error getting modification time: ${error.message}`);
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

    saveFile(filePath, text) {
        if (!path.isAbsolute(filePath)) {
            filePath = path.join(this.get_cwe(), filePath);
        }
        this.mkdir(path.dirname(filePath));
        fs.writeFileSync(filePath, text, 'utf-8');
        return filePath;
    }

    readJSON(filePath) {
        if (!this.isFile(filePath)) {
            return {};
        }
        let content = this.readFile(filePath);
        try {
            return JSON.parse(content);
        } catch (err) {
            console.error(`Failed to parse JSON file: ${err}`);
            return {};
        }
    }

    readByRequire(filePath) {
        if (!filePath) return null;
        return this.isFile(filePath) ? require(filePath) : null;
    }

    readByPackage(directoryPath) {
        if (!directoryPath) return null;
        if (this.isDirectory(directoryPath)) {
            directoryPath = path.join(directoryPath, 'package.json');
        }
        return this.isFile(directoryPath) ? require(directoryPath) : null;
    }

    saveJSON(filePath, jsonText) {
        if (typeof jsonText !== 'string') {
            jsonText = JSON.stringify(jsonText, null, 2);
        }
        this.mkdir(path.dirname(filePath));
        fs.writeFileSync(filePath, jsonText, 'utf-8');
    }

    async mkdir(directoryPath) {
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
            if (this.isDirectory(fPath)) {
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
            console.error(`Failed to rename file: ${e}`);
        }
    }
}

File.toString = () => '[class File]';
export default new File();
