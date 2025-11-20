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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class BaseUtils {
    execCmd(command, useShell = true, cwd = null, inheritIO = true) {
        try {
            const options = {
                shell: useShell,
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
                shell: useShell,
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