import fs from 'fs';
import path from 'path';
import Base from '#@base';

class DirectoryUtils extends Base {
    constructor() {
        super();
    }

    getElectronRootByBuild() {
        return this.findRootDirectory(path.resolve(__dirname));
    }

    findRootDirectory(currentPath) {
        const hasRequiredFolders = this.checkRequiredFolders(currentPath);
        if (hasRequiredFolders) {
            return currentPath;
        }
        const parentPath = this.getParentDirectory(currentPath);
        if (currentPath === parentPath) {
            return null;
        }
        return this.findRootDirectory(parentPath);
    }

    checkRequiredFolders(dir) {
        const hasResources = fs.existsSync(path.join(dir, 'resources'));
        const hasLocales = fs.existsSync(path.join(dir, 'locales'));
        return hasResources && hasLocales;
    }

    getParentDirectory(dir) {
        return path.resolve(dir, '..');
    }
}

export default DirectoryUtils;
