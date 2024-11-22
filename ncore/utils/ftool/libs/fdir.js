import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Base from '#@base';

class FDir extends Base {
    constructor() {
        super();
    }

    findInParentDirectories(filename, currentDir = this.getCwd()) {
        let filePath = path.join(currentDir, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        while (currentDir !== path.parse(currentDir).root) {
            filePath = path.join(currentDir, filename);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
            currentDir = path.dirname(currentDir);
        }
        return null;
    }

    hasOnlyOneSubdirectory(dir) {
        try {
            const stats = fs.statSync(dir);
            if (!stats.isDirectory()) {
                return false;
            }
        } catch (error) {
            console.log(`hasOnlyOneSubdirectory-Error: `, error);
            return false;
        }
        const items = fs.readdirSync(dir);
        let subdirectoryCount = 0;
        for (const item of items) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                if (subdirectoryCount > 1) {
                    return false;
                }
                subdirectoryCount++;
            }
        }
        return subdirectoryCount === 1;
    }

    findFileUpward(fileName, currentDir = path.dirname(__dirname)) {
        const filePath = path.join(currentDir, fileName);
        if (fs.existsSync(filePath)) {
            return path.resolve(filePath);
        } else {
            const parentDir = path.dirname(currentDir);
            if (currentDir === parentDir) {
                return null;
            } else {
                return this.findFileUpward(fileName, parentDir);
            }
        }
    }

    findFileDownward(fileName, currentDir = path.dirname(__dirname)) {
        const filePath = path.join(currentDir, fileName);
        if (fs.existsSync(filePath)) {
            return path.resolve(filePath);
        } else {
            const subDirs = fs.readdirSync(currentDir).filter(item => fs.statSync(path.join(currentDir, item)).isDirectory());
            for (const subDir of subDirs) {
                const subDirPath = path.join(currentDir, subDir);
                const foundPath = this.findFileDownward(fileName, subDirPath);
                if (foundPath) {
                    return foundPath;
                }
            }
            return null;
        }
    }

    findFilesUpward(fileNames, currentDir = path.dirname(__dirname)) {
        const foundFiles = fileNames.every(fileName => fs.existsSync(path.join(currentDir, fileName)));
        if (foundFiles) {
            return path.resolve(currentDir);
        } else {
            const parentDir = path.dirname(currentDir);
            if (currentDir === parentDir) {
                return null;
            } else {
                return this.findFilesUpward(fileNames, parentDir);
            }
        }
    }

    findFilesDownward(fileNames, currentDir = path.dirname(__dirname)) {
        const foundFiles = fileNames.every(fileName => fs.existsSync(path.join(currentDir, fileName)));
        if (foundFiles) {
            return path.resolve(currentDir);
        } else {
            const subDirs = fs.readdirSync(currentDir).filter(item => fs.statSync(path.join(currentDir, item)).isDirectory());
            for (const subDir of subDirs) {
                const subDirPath = path.join(currentDir, subDir);
                const foundPath = this.findFilesDownward(fileNames, subDirPath);
                if (foundPath) {
                    return foundPath;
                }
            }
            return null;
        }
    }

    searchUpward(fileNames) {
        const currentDirectory = __dirname;
        let foundFilePath = null;

        const findFileUpward = (directory) => {
            const files = fs.readdirSync(directory);
            for (const file of files) {
                if (fileNames.includes(file)) {
                    foundFilePath = path.join(directory, file);
                    return foundFilePath;
                }
            }
            const upDir = path.resolve(directory, '..');
            if (!this.isRootPath(directory)) {
                return findFileUpward(upDir);
            } else {
                return null;
            }
        };

        this.isRootPath = (pathToCheck) => {
            const normalizedPath = path.resolve(pathToCheck).toLowerCase();
            return normalizedPath === path.parse(normalizedPath).root.toLowerCase();
        };

        findFileUpward(currentDirectory);
        return foundFilePath;
    }

    searchDownward(directory, fileNames) {
        let foundFilePath = null;
        const findFileDownward = (currentDirectory) => {
            const files = fs.readdirSync(currentDirectory);
            for (const file of files) {
                const filePath = path.join(currentDirectory, file);
                if (fileNames.includes(file)) {
                    foundFilePath = filePath;
                    return foundFilePath;
                }
                if (fs.statSync(filePath).isDirectory()) {
                    findFileDownward(filePath);
                }
            }
        };
        findFileDownward(directory);
        return foundFilePath;
    }

    containsAllDirs(rootPath, dirs) {
        const contents = fs.readdirSync(rootPath);
        return dirs.every(dir => contents.includes(dir));
    }

    getUnusedDrives() {
        try {
            const stdout = execSync('wmic logicaldisk get name').toString();
            const usedDrives = stdout.match(/[A-Z]:/g) || [];
            const allDrives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `${letter}:`);
            const unusedDrives = allDrives.filter(drive => !usedDrives.includes(drive));
            return unusedDrives;
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    }

    countFilesInDirectory(dir) {
        let count = 0;
        const walk = (directory) => {
            const items = fs.readdirSync(directory);
            for (const item of items) {
                const fullPath = path.join(directory, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    walk(fullPath);
                } else if (stat.isFile() || item.endsWith('.asar')) {
                    count++;
                }
            }
        };
        walk(dir);
        return count;
    }

    cleanOldFiles(directory, reserve = 1, callback) {
        fs.readdir(directory, (err, files) => {
            if (err) {
                return callback(err);
            }
            if (files.length < reserve) {
                return callback(null);
            }
            let processedFiles = 0;
            const filteredFiles = [];
            files.forEach(file => {
                fs.stat(path.join(directory, file), (err, stats) => {
                    if (err) {
                        return callback(err);
                    }
                    filteredFiles.push({
                        name: file,
                        time: stats.mtime || stats.birthtime
                    });
                    processedFiles++;
                    if (processedFiles === files.length) {
                        filteredFiles.sort((a, b) => b.time - a.time);
                        const filesToDelete = filteredFiles.slice(reserve);
                        let deletedFiles = 0;
                        filesToDelete.forEach(fileObj => {
                            fs.unlink(path.join(directory, fileObj.name), (err) => {
                                if (err) {
                                    return callback(err);
                                }
                                deletedFiles++;
                                if (deletedFiles === filesToDelete.length) {
                                    callback(null);
                                }
                            });
                        });
                    }
                });
            });
        });
    }

    findFileByExtname(dir, extname, level = Infinity) {
        const files = [];
        const searchFilesInDirectory = (currentDir, currentLevel) => {
            if (currentLevel > level) {
                return;
            }
            const items = fs.readdirSync(currentDir);
            items.forEach(item => {
                const itemPath = path.join(currentDir, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    searchFilesInDirectory(itemPath, currentLevel + 1);
                } else if (stat.isFile() && path.extname(itemPath) === extname) {
                    files.push(itemPath);
                }
            });
        };
        searchFilesInDirectory(dir, 0);
        return files;
    }

    findFileByCurrentDirExtname(dir, extname) {
        return this.findFileByExtname(dir, extname, 1);
    }

    readDirectory(dirPath) {
        let directory = {};
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                file = file.trim();
                directory[file] = this.readDirectory(filePath);
            } else {
                if (!Array.isArray(directory)) {
                    directory = [];
                }
                directory.push(file);
            }
        });
        return directory;
    }

    scanDir(directoryPath) {
        const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
        const subdirectories = entries
            .filter(entry => entry.isDirectory())
            .map(dir => path.join(directoryPath, dir.name));
        return subdirectories;
    }

    searchFile(dir, filename) {
        return this.findFile(dir, filename);
    }

    findFile(dir, targetFile) {
        if (!fs.statSync(dir).isDirectory()) {
            return null;
        }
        const files = fs.readdirSync(dir);
        for (let file of files) {
            let fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                let result = this.findFile(fullPath, targetFile);
                if (result) return result;
            } else if (file.toLowerCase() === targetFile.toLowerCase()) {
                return fullPath;
            }
        }
        return null;
    }

    readDir(directoryPath) {
        const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
        return entries;
    }

    getDirectorySize(directoryPath) {
        let totalSize = 0;
        const files = fs.readdirSync(directoryPath);
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                totalSize += stats.size;
            } else if (stats.isDirectory()) {
                totalSize += this.getDirectorySize(filePath);
            }
        }
        return totalSize;
    }

    findDirectoryWithSubdirs(baseDir, subdirs) {
        const allDirs = fs.readdirSync(baseDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const dir of allDirs) {
            const fullPath = path.join(baseDir, dir);
            const childDirs = fs.readdirSync(fullPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            if (subdirs.every(subdir => childDirs.includes(subdir))) {
                return fullPath;
            }
            const deepSearchResult = this.findDirectoryWithSubdirs(fullPath, subdirs);
            if (deepSearchResult) {
                return deepSearchResult;
            }
        }
        return null;
    }

    async deleteFolderAsync(folderPath, callback, retry = 50, retryStep = 0) {
        fs.lstat(folderPath, (err, stats) => {
            if (this.isLocked(folderPath) || err) {
                if (err) console.log(err);
                if (retryStep >= retry) {
                    if (callback) callback(false);
                }
                setTimeout(() => {
                    retryStep++;
                    this.deleteFolderAsync(folderPath, callback, retry, retryStep);
                }, 500);
            }
            if (stats.isDirectory() && !folderPath.endsWith('.asar')) {
                fs.rmdir(folderPath, { recursive: true }, () => {
                    if (callback) callback(true);
                });
            } else {
                fs.unlink(folderPath, () => {
                    if (callback) callback(true);
                });
            }
        });
    }
}

export default new FDir();
