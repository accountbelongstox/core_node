const Base = require('#@base');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    const logger = require('#@logger');

    class FileTool extends Base {
        constructor() {
            super();
        }

        copyFilesRecursively(srcPath, destPath, overwrite = false) {
            if (!fs.existsSync(srcPath)) {
                logger.error(`Source path does not exist: ${srcPath}`);
                return false;
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
            return true;
        }

        copyAndReplaceFile(srcFile, destFile, overwrite = false) {
            if (!fs.existsSync(srcFile)) {
                logger.error(`Source file does not exist: ${srcFile}`);
                return false;
            }

            if (overwrite || !fs.existsSync(destFile)) {
                fs.copyFileSync(srcFile, destFile);
            }
            return true;
        }

        copyFilesToContainer(srcPath, containerName, containerPath, overwrite = false) {
            if (!fs.existsSync(srcPath)) {
                logger.error(`Source path does not exist: ${srcPath}`);
                return false;
            }

            const command = `docker cp ${srcPath} ${containerName}:${containerPath}`;
            execSync(command, { stdio: 'inherit' });

            if (overwrite) {
                // Docker `cp` command will overwrite files if they already exist in the container.
            }
            return true;
        }

        copyFileToContainer(srcFile, containerName, containerPath, overwrite = false) {
            if (!fs.existsSync(srcFile)) {
                logger.error(`Source file does not exist: ${srcFile}`);
                return false;
            }

            const command = `docker cp ${srcFile} ${containerName}:${containerPath}`;
            execSync(command, { stdio: 'inherit' });

            if (overwrite) {
                // Docker `cp` command will overwrite files if they already exist in the container.
            }
            return true;
        }

        removeFileOrFolderFromContainer(srcPath, containerName) {
            const command = `docker exec ${containerName} rm -rf ${srcPath}`;
            execSync(command, { stdio: 'inherit' });
        }
    }

    module.exports = FileTool;