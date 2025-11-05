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

const { spawn } = require('child_process');
const logger = require('./Logger.js');
const fs = require('fs');
const path = require('path');

class CommandExecutor {
    constructor(options = {}) {
        this.enableRealTimeOutput = options.enableRealTimeOutput !== false;
        this.outputCallback = options.outputCallback || null;
        this.errorCallback = options.errorCallback || null;
    }

    async execute(command, args = [], options = {}) {
        const cwd = options.cwd || process.cwd();
        const shell = options.shell !== false;
        const env = options.env || process.env;

        logger.info('Executing command: ' + command + ' ' + args.join(' '));
        logger.info('Working directory: ' + cwd);

        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: cwd,
                shell: shell,
                env: env,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            let hasError = false;

            child.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;

                if (this.enableRealTimeOutput) {
                    logger.info('[STDOUT] ' + output.trim());
                }

                if (this.outputCallback) {
                    this.outputCallback(output);
                }
            });

            child.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;

                if (this.enableRealTimeOutput) {
                    logger.warn('[STDERR] ' + output.trim());
                }

                if (this.errorCallback) {
                    this.errorCallback(output);
                }
            });

            child.on('error', (error) => {
                hasError = true;
                logger.error('Command execution error: ' + error.message);
                reject({
                    success: false,
                    error: error.message,
                    stdout: stdout,
                    stderr: stderr
                });
            });

            child.on('close', (code) => {
                if (hasError) {
                    return;
                }

                logger.info('Command completed with exit code: ' + code);

                resolve({
                    success: code === 0,
                    exitCode: code,
                    stdout: stdout,
                    stderr: stderr
                });
            });
        });
    }

    async gitClone(repoUrl, targetDir, options = {}) {
        logger.info('Cloning repository: ' + repoUrl);
        logger.info('Target directory: ' + targetDir);

        const parentDir = path.dirname(targetDir);
        if (!fs.existsSync(parentDir)) {
            logger.info('Creating parent directory: ' + parentDir);
            fs.mkdirSync(parentDir, { recursive: true });
        }

        const args = ['clone', repoUrl, targetDir];
        if (options.depth) {
            args.push('--depth', options.depth.toString());
        }
        if (options.branch) {
            args.push('--branch', options.branch);
        }

        const result = await this.execute('git', args, { cwd: parentDir });

        const isSuccess = this.verifyGitClone(targetDir);
        result.verified = isSuccess;

        if (isSuccess) {
            logger.info('Git clone verified successfully');
        } else {
            logger.error('Git clone verification failed');
        }

        return result;
    }

    verifyGitClone(targetDir) {
        try {
            if (!fs.existsSync(targetDir)) {
                logger.error('Target directory does not exist: ' + targetDir);
                return false;
            }

            const gitDir = path.join(targetDir, '.git');
            if (!fs.existsSync(gitDir)) {
                logger.error('No .git directory found in: ' + targetDir);
                return false;
            }

            const files = fs.readdirSync(targetDir);
            if (files.length <= 1) {
                logger.error('Directory is empty or only contains .git: ' + targetDir);
                return false;
            }

            logger.info('Directory verification passed. Files count: ' + files.length);
            return true;
        } catch (error) {
            logger.error('Verification error: ' + error.message);
            return false;
        }
    }

    async pipInstall(packageName, options = {}) {
        logger.info('Installing pip package: ' + packageName);

        const args = ['install', packageName];
        if (options.upgrade) {
            args.push('--upgrade');
        }
        if (options.requirements) {
            args[1] = '-r';
            args[2] = packageName;
        }

        const result = await this.execute('pip', args, options);

        const isSuccess = this.verifyPipInstall(packageName);
        result.verified = isSuccess;

        if (isSuccess) {
            logger.info('Pip package installation verified');
        } else {
            logger.warn('Pip package verification inconclusive');
        }

        return result;
    }

    verifyPipInstall(packageName) {
        try {
            const listResult = this.executeSync('pip', ['list']);
            const installed = listResult.stdout.includes(packageName);

            if (installed) {
                logger.info('Package found in pip list: ' + packageName);
            } else {
                logger.warn('Package not found in pip list: ' + packageName);
            }

            return installed;
        } catch (error) {
            logger.error('Pip verification error: ' + error.message);
            return false;
        }
    }

    executeSync(command, args = [], options = {}) {
        const { execSync } = require('child_process');
        const cwd = options.cwd || process.cwd();

        try {
            const result = execSync(command + ' ' + args.join(' '), {
                cwd: cwd,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe']
            });

            return {
                success: true,
                stdout: result,
                stderr: ''
            };
        } catch (error) {
            return {
                success: false,
                stdout: error.stdout || '',
                stderr: error.stderr || error.message
            };
        }
    }

    async checkCommand(command) {
        try {
            const result = await this.execute(command, ['--version']);
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async checkPythonCommand() {
        const commands = ['python', 'python3', 'py'];
        let i;

        for (i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            try {
                const result = await this.execute(cmd, ['--version']);
                if (result.success) {
                    logger.info('Found Python command: ' + cmd);
                    return cmd;
                }
            } catch (error) {
            }
        }

        logger.error('No Python command found');
        return null;
    }

    async verifyDirectory(dirPath, options = {}) {
        const minFiles = options.minFiles || 1;
        const requiredFiles = options.requiredFiles || [];

        try {
            if (!fs.existsSync(dirPath)) {
                logger.error('Directory does not exist: ' + dirPath);
                return false;
            }

            const stats = fs.statSync(dirPath);
            if (!stats.isDirectory()) {
                logger.error('Path is not a directory: ' + dirPath);
                return false;
            }

            const files = fs.readdirSync(dirPath);
            if (files.length < minFiles) {
                logger.error('Directory has fewer than ' + minFiles + ' files: ' + dirPath);
                return false;
            }

            let i;
            for (i = 0; i < requiredFiles.length; i++) {
                const requiredFile = requiredFiles[i];
                const fullPath = path.join(dirPath, requiredFile);
                if (!fs.existsSync(fullPath)) {
                    logger.error('Required file not found: ' + requiredFile);
                    return false;
                }
            }

            logger.info('Directory verification passed: ' + dirPath);
            return true;
        } catch (error) {
            logger.error('Directory verification error: ' + error.message);
            return false;
        }
    }
}

module.exports = CommandExecutor;
