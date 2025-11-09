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
const logger = require('#@logger');

class DeepSeekLauncher {
    constructor() {
        this.modelName = 'DeepSeek-VL';
        this.repoUrl = 'https://github.com/deepseek-ai/DeepSeek-VL.git';
        this.defaultModelPath = 'deepseek-ai/deepseek-vl-1.3b-chat';
        this.platform = this.detectPlatform();
        this.baseDir = this.getBaseDirectory();
        this.installDir = path.join(this.baseDir, this.modelName);
    }

    detectPlatform() {
        const platform = os.platform();

        if (platform === 'win32') {
            return 'Windows';
        }

        try {
            const unameOutput = require('child_process').execSync('uname -a').toString();
            if (unameOutput.includes('Microsoft') || unameOutput.includes('WSL')) {
                return 'WSL';
            }
            return 'Linux';
        } catch (error) {
            return 'Linux';
        }
    }

    getBaseDirectory() {
        let baseDir;

        if (this.platform === 'Windows') {
            baseDir = 'D:\\programing';
        } else if (this.platform === 'WSL') {
            baseDir = '/mnt/d/programing';
        } else {
            baseDir = this.findLinuxBaseDirectory();
        }

        return baseDir;
    }

    findLinuxBaseDirectory() {
        const mountsToCheck = [
            '/mnt/dev_sda/programing',
            '/mnt/dev_sdb/programing',
            '/mnt/dev_sdc/programing',
            '/mnt/dev_nvme0n1/programing'
        ];

        for (const mountPath of mountsToCheck) {
            if (fs.existsSync(mountPath)) {
                return mountPath;
            }
        }

        const homeProgaming = path.join(os.homedir(), 'programing');
        if (fs.existsSync(homeProgaming)) {
            return homeProgaming;
        }

        return '/mnt/d/programing';
    }

    isInstalled() {
        if (!fs.existsSync(this.installDir)) {
            return false;
        }

        const gitDir = path.join(this.installDir, '.git');
        if (!fs.existsSync(gitDir)) {
            return false;
        }

        const requirementsFile = path.join(this.installDir, 'requirements.txt');
        if (!fs.existsSync(requirementsFile)) {
            return false;
        }

        const fileCount = this.countFiles(this.installDir);
        if (fileCount < 10) {
            return false;
        }

        return true;
    }

    countFiles(directory) {
        let count = 0;

        try {
            const items = fs.readdirSync(directory);

            for (const item of items) {
                const fullPath = path.join(directory, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    count += this.countFiles(fullPath);
                } else {
                    count++;
                }
            }
        } catch (error) {
            logger.warn(`Error counting files in ${directory}: ${error.message}`);
        }

        return count;
    }

    getStatus() {
        const isInstalled = this.isInstalled();

        const status = {
            isInstalled: isInstalled,
            installDirectory: this.installDir,
            baseDirectory: this.baseDir,
            platform: this.platform,
            modelName: this.modelName,
            modelPath: this.defaultModelPath,
            repoUrl: this.repoUrl
        };

        if (isInstalled) {
            const gitDir = path.join(this.installDir, '.git');
            const requirementsFile = path.join(this.installDir, 'requirements.txt');
            const fileCount = this.countFiles(this.installDir);

            status.hasGit = fs.existsSync(gitDir);
            status.hasRequirements = fs.existsSync(requirementsFile);
            status.fileCount = fileCount;
            status.isValid = true;
        } else {
            status.hasGit = false;
            status.hasRequirements = false;
            status.fileCount = 0;
            status.isValid = false;
        }

        return status;
    }

    getConfig() {
        const status = this.getStatus();

        const config = {
            enabled: status.isInstalled,
            modelPath: this.defaultModelPath,
            modelDir: this.installDir,
            pythonCommand: this.platform === 'Windows' ? 'python' : 'python3',
            timeout: 30000,
            platform: this.platform
        };

        return config;
    }

    getInstallationInstructions() {
        const coreNodeDir = path.resolve(__dirname, '..', '..', '..');
        const shellsDir = path.join(coreNodeDir, 'scripts', 'shells');

        const instructions = {
            windows: {
                scriptPath: path.join(shellsDir, 'win', 'install_powershells', 'Step95_InstallDeepSeek.ps1'),
                command: '.\\Step95_InstallDeepSeek.ps1',
                workingDirectory: path.join(shellsDir, 'win', 'install_powershells')
            },
            linux: {
                scriptPath: path.join(shellsDir, 'linux', 'debian', 'install_shells', '95_install_deepseek.sh'),
                command: './95_install_deepseek.sh',
                workingDirectory: path.join(shellsDir, 'linux', 'debian', 'install_shells')
            },
            manual: {
                steps: [
                    `1. Navigate to base directory: cd ${this.baseDir}`,
                    `2. Clone repository: git clone ${this.repoUrl}`,
                    `3. Navigate to model directory: cd ${this.modelName}`,
                    `4. Install dependencies: ${this.platform === 'Windows' ? 'python' : 'python3'} -m pip install -r requirements.txt`
                ]
            }
        };

        return instructions;
    }

    showInstallationPrompt() {
        const status = this.getStatus();

        if (status.isInstalled) {
            logger.info('DeepSeek-VL is already installed');
            logger.info(`Installation directory: ${status.installDirectory}`);
            return;
        }

        logger.warn('DeepSeek-VL is not installed');
        logger.info('');
        logger.info('=== Installation Instructions ===');
        logger.info('');

        const instructions = this.getInstallationInstructions();

        if (this.platform === 'Windows' || this.platform === 'WSL') {
            logger.info('Windows/WSL Installation:');
            logger.info(`  1. Open PowerShell as Administrator`);
            logger.info(`  2. Navigate to: ${instructions.windows.workingDirectory}`);
            logger.info(`  3. Run: ${instructions.windows.command}`);
        }

        if (this.platform === 'Linux' || this.platform === 'WSL') {
            logger.info('');
            logger.info('Linux Installation:');
            logger.info(`  1. Navigate to: ${instructions.linux.workingDirectory}`);
            logger.info(`  2. Make script executable: chmod +x install_deepseek.sh`);
            logger.info(`  3. Run: ${instructions.linux.command}`);
        }

        logger.info('');
        logger.info('Manual Installation:');
        instructions.manual.steps.forEach(step => logger.info(`  ${step}`));
        logger.info('');
        logger.info('===============================');
        logger.info('');
    }

    validateConfiguration(config) {
        const errors = [];
        const warnings = [];

        if (!config) {
            errors.push('Configuration is required');
            return { valid: false, errors, warnings };
        }

        if (!config.modelDir) {
            errors.push('modelDir is required in configuration');
        } else if (!fs.existsSync(config.modelDir)) {
            errors.push(`Model directory not found: ${config.modelDir}`);
            warnings.push('Run installation script to install DeepSeek-VL');
        }

        if (!config.modelPath) {
            warnings.push('modelPath not specified, using default: ' + this.defaultModelPath);
        }

        if (!config.pythonCommand) {
            warnings.push('pythonCommand not specified, using default: ' + (this.platform === 'Windows' ? 'python' : 'python3'));
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    checkAndPromptInstallation(config) {
        const status = this.getStatus();

        if (!status.isInstalled) {
            logger.error('DeepSeek-VL is not installed!');
            this.showInstallationPrompt();
            throw new Error('DeepSeek-VL not installed. Please run the installation script.');
        }

        if (!status.isValid) {
            logger.error('DeepSeek-VL installation is invalid or corrupted!');
            this.showInstallationPrompt();
            throw new Error('DeepSeek-VL installation is invalid. Please reinstall.');
        }

        const validation = this.validateConfiguration(config);

        if (!validation.valid) {
            logger.error('Configuration validation failed:');
            validation.errors.forEach(error => logger.error(`  - ${error}`));
            throw new Error('Invalid DeepSeek configuration');
        }

        if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => logger.warn(`  - ${warning}`));
        }

        logger.info('DeepSeek-VL is installed and ready');
        logger.info(`Installation directory: ${status.installDirectory}`);
        logger.info(`File count: ${status.fileCount}`);

        return true;
    }

    static getInstance() {
        if (!DeepSeekLauncher.instance) {
            DeepSeekLauncher.instance = new DeepSeekLauncher();
        }
        return DeepSeekLauncher.instance;
    }
}

DeepSeekLauncher.instance = null;

function getInstance() {
    return DeepSeekLauncher.getInstance();
}

function isInstalled() {
    const launcher = getInstance();
    return launcher.isInstalled();
}

function getStatus() {
    const launcher = getInstance();
    return launcher.getStatus();
}

function getConfig() {
    const launcher = getInstance();
    return launcher.getConfig();
}

function showInstallationPrompt() {
    const launcher = getInstance();
    launcher.showInstallationPrompt();
}

function checkAndPromptInstallation(config) {
    const launcher = getInstance();
    return launcher.checkAndPromptInstallation(config);
}

function validateConfiguration(config) {
    const launcher = getInstance();
    return launcher.validateConfiguration(config);
}

function getInstallationInstructions() {
    const launcher = getInstance();
    return launcher.getInstallationInstructions();
}

module.exports = {
    DeepSeekLauncher,
    getInstance,
    isInstalled,
    getStatus,
    getConfig,
    showInstallationPrompt,
    checkAndPromptInstallation,
    validateConfiguration,
    getInstallationInstructions
};
