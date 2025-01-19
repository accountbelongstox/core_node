const path = require('path');
const fs = require('fs');

const Basedir = path.join(__dirname, '../../../');
const CoreNodePath = path.join(Basedir, '../');

function getBaseName(filePath) {
    if(!filePath) return filePath;
    return path.basename(filePath);
}

function getBaseDir(filePath) {
    return path.dirname(filePath);
}

function equal(path1, path2) {
    const normalizedPath1 = path.normalize(path1);
    const normalizedPath2 = path.normalize(path2);
    return normalizedPath1 === normalizedPath2;
}

function ensureAbsolute(filePath, basePath = process.cwd()) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    return path.join(basePath, filePath);
}

function findDirectoryWithSubdirs(baseDir, subdirs) {
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

        const deepSearchResult = findDirectoryWithSubdirs(fullPath, subdirs);
        if (deepSearchResult) {
            return deepSearchResult;
        }
    }
    return null;
}

function slicePathLevels(filePath, levels) {
    const parts = path.normalize(filePath).split(path.sep);
    const truncatedParts = parts.slice(0, levels + 1);
    return truncatedParts.join(path.sep);
}

function replaceDir(src, newPre, level) {
    src = slicePathLevels(src, level);
    src = path.join(newPre, src);
    return src;
}

function getDrive(pf) {
    const match = /^[a-zA-Z]+/.exec(pf);
    if (match) {
        return match[0].toLowerCase();
    }
    return null;
}

function isDrive(pf, drive) {
    const pfDrive = getDrive(pf);
    return pfDrive === drive;
}

function removePathFrom(pathA, pathB) {
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

function getExtension(filePath) {
    return path.extname(filePath);
}

function replaceExtension(filePath, newExtension) {
    const fileName = path.basename(filePath);
    const originalExtension = path.extname(filePath);
    if (originalExtension === '') {
        return `${filePath}.${newExtension}`;
    }
    return path.join(path.dirname(filePath), `${fileName.replace(originalExtension, '')}.${newExtension}`);
}

function replacePathByLevel(oldPath, n, newPath) {
    const segments = oldPath.split(/[\/\\]+/);
    if (n <= 0 || n > segments.length) {
        return oldPath;
    }
    return getNormalPath(path.join(newPath, segments.slice(n).join('/')));
}

function getLevelPath(pathStr, n, x) {
    const segments = pathStr.split(/[\/\\]+/);
    if (x === undefined) {
        return segments[n];
    }
    return segments.slice(n, x + 1).join('/');
}

function getSafeFilename(url) {
    const possibleFilename = url.split('/').pop();
    const invalidCharacters = /[<>:"/\\|?*\x00-\x1F\s]+/g;
    return possibleFilename.replace(invalidCharacters, '_');
}

function getNormalPath(p) {
    return path.normalize(p).replace(/\\/g, '/');
}

module.exports = {
    Basedir,
    CoreNodePath,
    getBaseName,
    getBaseDir,
    equal,
    ensureAbsolute,
    findDirectoryWithSubdirs,
    slicePathLevels,
    replaceDir,
    getDrive,
    isDrive,
    removePathFrom,
    getExtension,
    replaceExtension,
    replacePathByLevel,
    getLevelPath,
    getSafeFilename,
    getNormalPath
};
