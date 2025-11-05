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

const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./Logger.js');
const CommandExecutor = require('./CommandExecutor.js');

class ModelInitializer {
    constructor() {
        this.executor = new CommandExecutor();
        this.platform = this.detectPlatform();
        this.baseDir = this.getBaseDirectory();
        this.modelName = 'DeepSeek-VL';
        this.modelDir = path.join(this.baseDir, this.modelName);
        this.repoUrl = 'https://github.com/deepseek-ai/DeepSeek-VL.git';
    }

    detectPlatform() {
        const platform = os.platform();
        let detectedPlatform = 'unknown';
        let isWSL = false;

        if (platform === 'win32') {
            detectedPlatform = 'windows';
        } else if (platform === 'linux') {
            try {
                const release = fs.readFileSync('/proc/version', 'utf-8').toLowerCase();
                if (release.includes('microsoft') || release.includes('wsl')) {
                    isWSL = true;
                    detectedPlatform = 'wsl';
                } else {
                    detectedPlatform = 'linux';
                }
            } catch (error) {
                detectedPlatform = 'linux';
            }
        } else if (platform === 'darwin') {
            detectedPlatform = 'macos';
        }

        logger.info('Detected platform: ' + detectedPlatform + (isWSL ? ' (WSL)' : ''));
        return detectedPlatform;
    }

    getBaseDirectory() {
        let baseDir = '';

        if (this.platform === 'windows') {
            baseDir = 'D:\\programing';
        } else if (this.platform === 'wsl') {
            baseDir = '/mnt/d/programing';
        } else if (this.platform === 'linux') {
            const devDirs = ['/mnt/dev_sda', '/mnt/dev_sdb', '/mnt/dev_nvme0n1', '/mnt/dev'];
            let i;
            let foundDir = null;

            for (i = 0; i < devDirs.length; i++) {
                const dir = devDirs[i];
                if (fs.existsSync(dir)) {
                    foundDir = dir;
                    logger.info('Found device mount: ' + dir);
                    break;
                }
            }

            if (foundDir) {
                baseDir = path.join(foundDir, 'programing');
            } else {
                baseDir = path.join(os.homedir(), 'programing');
                logger.warn('No /mnt/dev_* found, using home directory');
            }
        } else {
            baseDir = path.join(os.homedir(), 'programing');
        }

        logger.info('Base directory: ' + baseDir);
        return baseDir;
    }

    ensureBaseDirectory() {
        try {
            if (!fs.existsSync(this.baseDir)) {
                logger.info('Creating base directory: ' + this.baseDir);
                fs.mkdirSync(this.baseDir, { recursive: true });
                logger.info('Base directory created successfully');
                return true;
            } else {
                logger.info('Base directory already exists: ' + this.baseDir);
                return true;
            }
        } catch (error) {
            logger.error('Failed to create base directory: ' + error.message);
            return false;
        }
    }

    async checkModelExists() {
        logger.info('Checking if model exists: ' + this.modelDir);

        if (!fs.existsSync(this.modelDir)) {
            logger.warn('Model directory does not exist: ' + this.modelDir);
            return false;
        }

        const requiredFiles = [
            'README.md',
            'requirements.txt',
            'deepseek_vl',
            'cli_chat.py'
        ];

        const verified = await this.executor.verifyDirectory(this.modelDir, {
            minFiles: 5,
            requiredFiles: requiredFiles
        });

        if (verified) {
            logger.info('Model exists and verified');
        } else {
            logger.warn('Model directory exists but verification failed');
        }

        return verified;
    }

    async cloneModel() {
        logger.info('Cloning DeepSeek-VL model from GitHub');

        if (!this.ensureBaseDirectory()) {
            return {
                success: false,
                error: 'Failed to create base directory'
            };
        }

        const result = await this.executor.gitClone(this.repoUrl, this.modelDir, {
            depth: 1
        });

        if (result.verified) {
            logger.info('Model cloned and verified successfully');
            return {
                success: true,
                message: 'Model cloned successfully',
                path: this.modelDir
            };
        } else {
            logger.error('Model clone failed or verification failed');
            return {
                success: false,
                error: 'Model clone verification failed',
                details: result
            };
        }
    }

    async installDependencies() {
        logger.info('Installing model dependencies');

        const requirementsFile = path.join(this.modelDir, 'requirements.txt');

        if (!fs.existsSync(requirementsFile)) {
            logger.error('requirements.txt not found: ' + requirementsFile);
            return {
                success: false,
                error: 'requirements.txt not found'
            };
        }

        const pythonCmd = await this.executor.checkPythonCommand();
        if (!pythonCmd) {
            logger.error('Python not found. Please install Python first.');
            return {
                success: false,
                error: 'Python not found'
            };
        }

        logger.info('Using Python command: ' + pythonCmd);

        const result = await this.executor.pipInstall(requirementsFile, {
            requirements: true,
            cwd: this.modelDir
        });

        return {
            success: result.success,
            verified: result.verified,
            message: result.success ? 'Dependencies installed' : 'Installation failed',
            details: result
        };
    }

    async initializeModel() {
        logger.info('=== Initializing DeepSeek-VL Model ===');
        logger.info('Platform: ' + this.platform);
        logger.info('Base directory: ' + this.baseDir);
        logger.info('Model directory: ' + this.modelDir);
        logger.info('');

        const exists = await this.checkModelExists();

        if (exists) {
            logger.info('Model already exists and verified');
            return {
                success: true,
                message: 'Model already exists',
                path: this.modelDir,
                skippedClone: true
            };
        }

        logger.info('Model not found, cloning from GitHub');
        const cloneResult = await this.cloneModel();

        if (!cloneResult.success) {
            return cloneResult;
        }

        logger.info('Model cloned successfully, installing dependencies');
        const installResult = await this.installDependencies();

        return {
            success: installResult.success,
            message: installResult.success ? 'Model initialized successfully' : 'Dependency installation failed',
            path: this.modelDir,
            cloneResult: cloneResult,
            installResult: installResult
        };
    }

    getModelPath(modelSize = '1.3b') {
        const modelPaths = {
            '1.3b-base': 'deepseek-ai/deepseek-vl-1.3b-base',
            '1.3b-chat': 'deepseek-ai/deepseek-vl-1.3b-chat',
            '1.3b': 'deepseek-ai/deepseek-vl-1.3b-chat',
            '7b-base': 'deepseek-ai/deepseek-vl-7b-base',
            '7b-chat': 'deepseek-ai/deepseek-vl-7b-chat',
            '7b': 'deepseek-ai/deepseek-vl-7b-chat'
        };

        return modelPaths[modelSize] || modelPaths['1.3b-chat'];
    }

    getStatus() {
        const exists = fs.existsSync(this.modelDir);
        let fileCount = 0;
        let hasRequirements = false;
        let hasCode = false;

        if (exists) {
            try {
                const files = fs.readdirSync(this.modelDir);
                fileCount = files.length;
                hasRequirements = fs.existsSync(path.join(this.modelDir, 'requirements.txt'));
                hasCode = fs.existsSync(path.join(this.modelDir, 'deepseek_vl'));
            } catch (error) {
            }
        }

        return {
            platform: this.platform,
            baseDir: this.baseDir,
            modelDir: this.modelDir,
            exists: exists,
            fileCount: fileCount,
            hasRequirements: hasRequirements,
            hasCode: hasCode,
            isValid: exists && hasRequirements && hasCode && fileCount > 5
        };
    }
}

module.exports = ModelInitializer;
