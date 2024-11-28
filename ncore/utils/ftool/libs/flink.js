import fs from 'fs';
import path from 'path';

class Flink {
    constructor() {
    }
    symlink(src, target, force = false) {
        if (force) {
            if (fs.existsSync(target)) {
                const stats = fs.lstatSync(target);
                if (stats.isDirectory()) {
                    this.deleteFolder(target);
                } else if (stats.isSymbolicLink()) {
                    fs.unlinkSync(target);
                } else {
                    console.warn(`${target} exists and is not a symbolic link. Aborting.`);
                    return;
                }
            }
        }

        if (!fs.existsSync(src)) {
            this.mkdir(src);
        }
        if (!fs.existsSync(target)) {
            fs.symlinkSync(src, target, 'junction');
            console.log(`Successfully created symlink from ${src} to ${target}`);
        }
    }
    
    // Synchronous wrapper for the symlink method
    symlinkSync(src, target, force = false) {
        this.symlink(src, target, force);
    }

    // Method to check if a path is a symbolic link
    isSymbolicLink(folderPath) {
        if (!fs.existsSync(folderPath)) {
            return false;
        }
        try {
            const stats = fs.lstatSync(folderPath);
            return stats.isSymbolicLink();
        } catch (error) {
            console.error(`isSymbolicLink-Error: ${error}`);
            return false;
        }
    }

    // Method to create a directory if it doesn't exist
    mkdir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    // Method to delete a folder recursively
    deleteFolder(folderPath) {
        if (fs.existsSync(folderPath)) {
            fs.readdirSync(folderPath).forEach((file) => {
                const currentPath = path.join(folderPath, file);
                if (fs.lstatSync(currentPath).isDirectory()) {
                    this.deleteFolder(currentPath);
                } else {
                    fs.unlinkSync(currentPath);
                }
            });
            fs.rmdirSync(folderPath);
        }
    }

    // Method to link a folder to a target, with validation and force option
    linkToTarget(src, target, force = false) {
        if (fs.existsSync(target)) {
            if (this.isSymbolicLink(target)) {
                fs.unlinkSync(target);
            } else {
                console.warn(`${target} exists and is not a symbolic link. Aborting.`);
                return;
            }
        }
        this.symlinkSync(src, target, force);
    }
}

export default new Flink();
