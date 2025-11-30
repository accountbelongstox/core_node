// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const Base = require('#@base');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

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

    module.exports = FileTool;