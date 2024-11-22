import fs from 'fs';
import path from 'path';
import base64 from 'base64-js';
import os from 'os';
// import crypto from 'crypto';
// import { execSync } from 'child_process';
import Base from '#@base';

class PFile extends Base {
  constructor() {
    super();
  }

  b64encode(dataFile) {
    let data, suffix;
    if (this.isFile(dataFile)) {
      const ext = path.extname(dataFile).slice(1);
      suffix = `data:image/${ext};base64,`;
      data = fs.readFileSync(dataFile);
    } else {
      suffix = "";
      data = dataFile;
    }
    data = base64.fromByteArray(data).toString();
    return suffix + data;
  }

  renameRemoveSpace(filename) {
    const spacePattern = /\s+/g;
    if (spacePattern.test(filename)) {
      const newFilename = filename.replace(spacePattern, "");
      const newFilePath = path.join(path.dirname(filename), newFilename);
      this.cut(filename, newFilePath);
      filename = newFilePath;
    }
    return filename;
  }

  rename(filename, newFile) {
    newFile = this.normalPath(newFile);
    if (!path.isAbsolute(newFile)) {
      newFile = path.join(path.dirname(filename), newFile);
    }
    try {
      fs.renameSync(filename, newFile);
      filename = newFile;
    } catch (error) {
      this.warn(`Unable to modify file name: ${error}`);
    }
    return filename;
  }

  saveJson(fileName = null, data = {}, encoding = 'utf-8') {
    try {
      fileName = fileName || this.createFileName();
      const jsonContent = JSON.stringify(data, null, 2);
      this.save(fileName, jsonContent, encoding, true);
      return fileName;
    } catch (error) {
      this.warn(`Failed to save JSON data to file '${fileName}'. Error: ${error}`);
      return null;
    }
  }

  isEmpty(filePath) {
    if (!fs.existsSync(filePath)) return true;
    if (fs.statSync(filePath).isFile()) return fs.statSync(filePath).size === 0;
    if (fs.statSync(filePath).isDirectory()) return fs.readdirSync(filePath).length === 0;
    return true;
  }

  readBytes(fileName) {
    fileName = this.resolvePath(fileName);
    if (this.isFile(fileName)) {
      return fs.readFileSync(fileName);
    }
    return null;
  }

  remove(topPath) {
    console.log("delete: ", topPath);
    if (fs.existsSync(topPath)) {
      if (fs.statSync(topPath).isDirectory()) {
        fs.rmdirSync(topPath, { recursive: true });
      } else {
        fs.unlinkSync(topPath);
      }
    }
  }

  mkdir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return true;
    }
    return false;
  }

  isFile(path) {
    return fs.existsSync(path) && fs.statSync(path).isFile();
  }

  isDir(path) {
    return fs.existsSync(path) && fs.statSync(path).isDirectory();
  }

  copy(src, dst, skipDirs = [], skipFiles = [], info = true) {
    if (this.isEmpty(dst)) {
      this.remove(dst);
    }

    if (this.isFile(src)) {
      if (this.isDir(dst)) {
        dst = path.join(dst, path.basename(src));
      }
      this.mkbasedir(dst);
      fs.copyFileSync(src, dst);
      if (info) this.info(`Copied: ${src} to ${dst}`);
    } else if (this.isDir(src)) {
      fs.mkdirSync(dst, { recursive: true });
      const items = fs.readdirSync(src);
      for (const item of items) {
        const srcItem = path.join(src, item);
        const dstItem = path.join(dst, item);
        if (skipDirs.includes(item) || skipFiles.includes(item)) continue;
        this.copy(srcItem, dstItem, skipDirs, skipFiles, info);
      }
    } else {
      if (info) this.warn(`Error: Source '${src}' is neither a file nor a directory.`);
    }
  }

  cut(src, dst) {
    if (this.isFile(src)) {
      this.mkbasedir(dst);
      fs.renameSync(src, dst);
    } else {
      this.warn(`file cut error (src not exists): src:${src} dst:${dst}`);
    }
  }

  ensureDir(paths) {
    if (typeof paths === 'string') paths = [paths];
    const createdPaths = [];
    for (const dirPath of paths) {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        createdPaths.push(dirPath);
      }
    }
    return createdPaths;
  }

  ensureBaseDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  getExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  getNotDotExtension(filename) {
    return path.extname(filename).slice(1).toLowerCase();
  }

  replaceExtension(filePath, newExtension) {
    const baseName = path.basename(filePath, path.extname(filePath));
    return path.join(path.dirname(filePath), `${baseName}.${newExtension.replace(/^\./, '')}`);
  }

  incrementFilename(filePath) {
    const dirname = path.dirname(filePath);
    const ext = path.extname(filePath);
    const basename = path.basename(filePath, ext);
    const parts = basename.split('_');
    const lastPart = parts[parts.length - 1];
    if (lastPart && !isNaN(lastPart)) {
      parts[parts.length - 1] = String(Number(lastPart) + 1);
    } else {
      parts.push('1');
    }
    return path.join(dirname, `${parts.join('_')}${ext}`);
  }

  addTimestamp(dirPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(path.dirname(dirPath), `${path.basename(dirPath)}_${timestamp}`);
  }

  fileAdd(filePath, additionalString = "", delimiter = "_") {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    return path.join(dir, `${baseName}${delimiter}${additionalString}${ext}`);
  }

  removePath(basePath, targetPath) {
    try {
      const relativePath = path.relative(basePath, targetPath);
      return relativePath.startsWith("..") ? targetPath : relativePath;
    } catch (e) {
      return targetPath;
    }
  }

  getBin(subPath = '') {
    return path.join(this.getCwd(), 'pycore', 'bin', subPath);
  }

  platformPath(driveLetter, folderPath) {
    return os.platform() === 'win32'
      ? `${driveLetter.toUpperCase()}:\\${folderPath.replace(/\//g, '\\')}`
      : `/mnt/${driveLetter.toLowerCase()}/${folderPath}`;
  }

  getSize(filePath, unit = 'k') {
    if (!this.isFile(filePath)) return 0;
    const size = fs.statSync(filePath).size;
    switch (unit.toLowerCase()) {
      case 'm':
      case 'mb':
        return size / (1024 ** 2);
      case 'g':
      case 'gb':
        return size / (1024 ** 3);
      case 't':
      case 'tb':
        return size / (1024 ** 4);
      default:
        return size / 1024;
    }
  }

  dirInclude(dir, prefix) {
    const files = fs.readdirSync(dir);
    return files.some(file => file.startsWith(prefix));
  }

  dirFind(dir, prefix) {
    const files = fs.readdirSync(dir);
    return files.find(file => file.startsWith(prefix)) || null;
  }

  searchFile(startPath, targetFileName) {
    const files = [];
    const searchDir = dir => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
          searchDir(fullPath);
        } else if (item === targetFileName) {
          files.push(fullPath);
        }
      }
    };
    searchDir(startPath);
    return files;
  }

  removeOldSubdirs(dirPath, prefix = "", maxAge = null, exclude = null, include = null) {
    const now = Date.now();
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (!file.startsWith(prefix)) continue;
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      if ((maxAge && age < maxAge) || (exclude && file.includes(exclude)) || (include && !file.includes(include))) {
        continue;
      }
      if (stats.isDirectory()) {
        fs.rmdirSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }

  addPaths(basePath, subPath) {
    return path.join(basePath, subPath);
  }

  sanitizeFileName(fileName) {
    return fileName.replace(/[<>:"/\\|?*]/g, '_');
  }

  sanitizeDirName(dirName) {
    return dirName.replace(/[<>:"/\\|?*]/g, '_');
  }
}

export default new PFile();
