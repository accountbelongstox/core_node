const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    class BaseUtils {
        execCmd(command, useShell = true, cwd = null, inheritIO = true) {
            try {
                const options = {
                    shell: useShell ? '/bin/sh' : false,
                    cwd: cwd || process.cwd(),
                    stdio: inheritIO ? 'inherit' : 'pipe'
                };

                if (Array.isArray(command)) {
                    command = command.join(' ');
                }

                return execSync(command, options);
            } catch (error) {
                this.error(`Failed to execute command: ${command}`);
                this.error(error);
                throw error;
            }
        }

        pipeExecCmd(command, useShell = true, cwd = null, inheritIO = true, env = process.env) {
            try {
                const options = {
                    shell: useShell ? '/bin/sh' : false,
                    cwd: cwd || process.cwd(),
                    stdio: inheritIO ? 'inherit' : 'pipe',
                    env: env
                };

                if (Array.isArray(command)) {
                    command = command.join(' ');
                }

                return execSync(command, options);
            } catch (error) {
                this.error(`Failed to execute command: ${command}`);
                this.error(error);
                throw error;
            }
        }

        info(message) {
            console.log('\x1b[36m%s\x1b[0m', `[INFO] ${message}`);
        }

        warn(message) {
            console.log('\x1b[33m%s\x1b[0m', `[WARN] ${message}`);
        }

        error(message) {
            console.log('\x1b[31m%s\x1b[0m', `[ERROR] ${message}`);
        }

        success(message) {
            console.log('\x1b[32m%s\x1b[0m', `[SUCCESS] ${message}`);
        }

        rmdirSyncRecursive(directoryPath) {
            if (fs.existsSync(directoryPath)) {
                fs.readdirSync(directoryPath).forEach((file) => {
                    const curPath = path.join(directoryPath, file);
                    if (fs.lstatSync(curPath).isDirectory()) {
                        this.rmdirSyncRecursive(curPath);
                    } else {
                        fs.unlinkSync(curPath);
                    }
                });
                fs.rmdirSync(directoryPath);
            }
        }

        readText(filePath) {
            try {
                return fs.readFileSync(filePath, 'utf8');
            } catch (error) {
                this.error(`Failed to read file: ${filePath}`);
                this.error(error);
                return null;
            }
        }
    }

    module.exports = BaseUtils;