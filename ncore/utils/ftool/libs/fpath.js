'use strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Base from '#@base';

class FPath extends Base {
    

    get_base_name(filePath) {
        if(!filePath)return filePath;
        return path.basename(filePath);
    }

    get_base_dir(filePath) {
        return path.dirname(filePath);
    }

    get_ext(filePath) {
        return path.extname(filePath).slice(1);
    }

    equal(path1, path2) {
        const normalizedPath1 = path.normalize(path1);
        const normalizedPath2 = path.normalize(path2);
        return normalizedPath1 == normalizedPath2;
    }

    ensure_absolute(filePath, basePath = this.getCwd()) {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        return path.join(basePath, filePath);
    }
    
    getPath(fpath) {
        if (fs.existsSync(fpath) && fs.statSync(fpath).isFile()) {
            return fpath;
        }
        const public_dir = this.getPublic(fpath);
        if (fs.existsSync(public_dir) && fs.statSync(public_dir).isFile()) {
            return public_dir;
        }

        fpath = path.join(this.getCwd(), fpath);
        if (fs.existsSync(fpath) && fs.statSync(fpath).isFile()) {
            return fpath;
        }

        return fpath;
    }

    getPublic(fpath) {
        const cwd = this.getCwd();
        if (!path.isAbsolute(fpath)) {
            return path.join(cwd, fpath);
        }
        return fpath;
    }

    getResource(filename) {
        const resourcePath = path.join(this.getCwd(), 'resource');
        if (!fs.existsSync(resourcePath)) {
            fs.mkdirSync(resourcePath, { recursive: true });
        }
        if (!filename) return resourcePath;
        if (!path.isAbsolute(filename)) {
            return path.join(resourcePath, filename);
        }
        return filename;
    }

    resolvePath(fpath, relativePath = null, resolve = true) {
        if (!resolve) {
            return fpath;
        }
        if (!path.isAbsolute(fpath)) {
            if (fs.existsSync(fpath)) {
                return path.resolve(fpath);
            }

            let rootPath = this.getCwd();
            if (relativePath !== null) {
                rootPath = path.join(rootPath, relativePath);
            }

            fpath = path.join(rootPath, fpath);
        }

        return fpath;
    }

    getUserDir(dir) {
        let homedir = os.homedir();
        if (dir) {
            homedir = path.join(homedir, dir);
        }
        this.mkBasedir(homedir);
        return homedir;
    }

    getPrivateUserDir(dir) {
        let private_dir = this.getUserDir('.desktop_icons');
        if (dir) {
            private_dir = path.join(private_dir, dir);
        }
        this.mkBasedir(private_dir);
        return private_dir;
    }

    getTempPath(dir) {
        return this.resolvePath(`temp/${dir}`);
    }

    getAppRoot(dir) {
        let dirs = ['node_modules', 'src'];
        let rootPath = this.getCwd();
        let result = this.findDirectoryWithSubdirs(rootPath, dirs);
        if (dir && result) {
            result = path.join(result, dir);
        }
        return result;
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

    
    slicePathLevels(filePath, levels) {
        const parts = path.normalize(filePath).split(path.sep);
        const truncatedParts = parts.slice(0, levels + 1);
        return truncatedParts.join(path.sep);
    }
    replaceDir(src, new_pre, level) {
        src = this.slicePathLevels(src, level)
        src = path.join(new_pre, src)
        return src
    }
    getDrive(pf) {
        const match = /^[a-zA-Z]+/.exec(pf);
        if (match) {
            return match[0].toLowerCase();
        }
        return null;
    }
    isDrive(pf, drive) {
        const pf_drive = this.getDrive(pf)
        if (pf_drive == drive) {
            return true
        }
        return false;
    }
    isRootPath(path) {
        const cleanedPath = path.replace(/\/$/, '').toLowerCase();
        const windowsRootPattern = /^[a-z]:$/;
        const unixRootPattern = /^\/$/;
        return windowsRootPattern.test(cleanedPath) || unixRootPattern.test(cleanedPath);
    }

    
    removePathFrom(pathA, pathB) {
        const partsA = pathA.split(/[\/\\]/);
        const partsB = pathB.split(/[\/\\]/);

        const compareIgnoreCase = (str1, str2) => str1.toLowerCase() === str2.toLowerCase();

        let index = 0;
        while (index < partsA.length && index < partsB.length && compareIgnoreCase(partsA[index], partsB[index])) {
            index++;
        }
        const remainingPartsB = partsB.slice(index);
        return remainingPartsB.join('/');
    }
    
    getExtension(filePath) {
        return path.extname(filePath);
    }
    replaceExtension(filePath, newExtension) {
        const fileName = path.basename(filePath);
        const originalExtension = path.extname(filePath);
        if (originalExtension === '') {
            const newFilePath = `${filePath}.${newExtension}`;
            return newFilePath;
        } else {
            const newFilePath = path.join(path.dirname(filePath), `${fileName.replace(originalExtension, '')}.${newExtension}`);
            return newFilePath;
        }
    }

    
    replacePathByLevel(oldPath, n, newPath) {
        const segments = oldPath.split(/[\/\\]+/);
        if (n <= 0 || n > segments.length) {
            return oldPath
        }
        return this.getNormalPath(path.join(newPath, segments.slice(n).join('/')));
    }
    getLevelPath(path, n, x) {
        const segments = path.split(/[\/\\]+/);
        if (x === undefined) {
            return segments[n];
        } else {
            return segments.slice(n, x + 1).join('/');
        }
    }
    getSafeFilename(url) {
        const possibleFilename = url.split('/').pop();
        const invalidCharacters = /[<>:"/\\|?*\x00-\x1F\s]+/g;
        const safeFilename = possibleFilename.replace(invalidCharacters, '_');
        return safeFilename;
    }
    isExecutable(filePath) {
        const extname = path.extname(filePath).toLowerCase();
        const executableExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.vbs'];
        return executableExtensions.includes(extname);
    }
    
    isImageFile(filePath) {
        if (!this.isFile(filePath)) {
            return false
        }
        const ext = path.extname(filePath).toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico'];
        return imageExtensions.includes(ext);
    }

    //isZip
    isCompressedFile(filePath) {
        if (!this.isFile(filePath)) {
            return false;
        }
        const ext = path.extname(filePath).toLowerCase();
        const compressedExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tar.gz', '.tar.bz2', '.tar.xz', '.tgz', '.tbz2', '.txz'];
        return compressedExtensions.includes(ext);
    }

    

    matchPathStartwith(filePath, pathList) {
        filePath = path.normalize(filePath)
        for (let p of pathList) {
            p = path.normalize(p)
            if (filePath.startsWith(p)) {
                return p;
            }
        }
        return false;
    }

    pathReplace(filePath, a, b) {
        filePath = path.normalize(filePath)
        a = path.normalize(a)
        b = path.normalize(b)
        filePath = filePath.replace(a, b)
        return filePath;
    }

    addPathPrefix(a, p) {
        const normalizedA = path.normalize(a);
        const normalizedP = path.normalize(p);
        if (normalizedP.startsWith(normalizedA)) {
            return normalizedP;
        }
        const joinedPath = path.join(normalizedA, normalizedP);
        const relativePath = path.relative(this.getCwd(), joinedPath);
        if (!relativePath.startsWith('..')) {
            return relativePath;
        }
        return joinedPath;
    }

    getRelativePath(sortPath, longPath) {
        const relativePath = path.relative(sortPath, longPath);
        const partsB = relativePath.split(path.sep);
        const partsA = sortPath.split(path.sep);
        while (partsB.length > 0 && partsA.length > 0 && partsB[0] === partsA[0]) {
            partsB.shift();
            partsA.shift();
        }
        const resultPath = partsB.join(path.sep);
        return resultPath;
    }

    getNormalPath(p) {
        return path.normalize(p);
    }


}

export default  new FPath();
