import Base from '#@base';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class FileTool extends Base {
    constructor() {
        super();
    }

    copyFilesRecursively(srcPath, destPath, overwrite = false) {
        if (!fs.existsSync(srcPath)) {
            throw new Error(`Source path does not exist: ${srcPath}`);
        }

        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }

        fs.readdirSync(srcPath).forEach(file => {
            const srcFile = path.join(srcPath, file);
            const destFile = path.join(destPath, file);

            if (fs.statSync(srcFile).isDirectory()) {
                this.copyFilesRecursively(srcFile, destFile, overwrite);
            } else {
                if (overwrite || !fs.existsSync(destFile)) {
                    fs.copyFileSync(srcFile, destFile);
                }
            }
        });
    }

    copyAndReplaceFile(srcFile, destFile, overwrite = false) {
        if (!fs.existsSync(srcFile)) {
            throw new Error(`Source file does not exist: ${srcFile}`);
        }

        if (overwrite || !fs.existsSync(destFile)) {
            fs.copyFileSync(srcFile, destFile);
        }
    }

    copyFilesToContainer(srcPath, containerName, containerPath, overwrite = false) {
        if (!fs.existsSync(srcPath)) {
            throw new Error(`Source path does not exist: ${srcPath}`);
        }

        const command = `docker cp ${srcPath} ${containerName}:${containerPath}`;
        execSync(command, { stdio: 'inherit' });

        if (overwrite) {
            // Docker `cp` command will overwrite files if they already exist in the container.
        }
    }

    copyFileToContainer(srcFile, containerName, containerPath, overwrite = false) {
        if (!fs.existsSync(srcFile)) {
            throw new Error(`Source file does not exist: ${srcFile}`);
        }

        const command = `docker cp ${srcFile} ${containerName}:${containerPath}`;
        execSync(command, { stdio: 'inherit' });

        if (overwrite) {
            // Docker `cp` command will overwrite files if they already exist in the container.
        }
    }

    removeFileOrFolderFromContainer(srcPath, containerName) {
        const command = `docker exec ${containerName} rm -rf ${srcPath}`;
        execSync(command, { stdio: 'inherit' });
    }
}

export default FileTool;
