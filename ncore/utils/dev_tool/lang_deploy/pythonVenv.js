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

const { execCmdResultText, pipeExecCmd } = require('#@commander');
const { LANG_COMPILER_DIR } = require('#@global_dir');
const fs = require('fs');
const path = require('path');
const gconfig = require('#@gconfig');
const {isDebug} = require('#@global_vars');

let log;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        debug: (...args) => logger.debug(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: (...args) => isDebug ? console.debug('[DEBUG]', ...args) : null
    };
}

let printInit = false;

class PythonVenv {
    constructor() {
        this.platform = process.platform;
        this.venvDir = null; // Will be set after getting system info
    }

    async getSystemInfo() {
        try {
            let systemName = 'unknown';
            let systemVersion = 'unknown';
            let pythonVersion = 'unknown';

            if (this.platform === 'win32') {
                systemName = 'windows';
                const versionOutput = await execCmdResultText('ver');
                systemVersion = versionOutput.match(/\d+\.\d+\.\d+/)?.[0] || 'unknown';
            } else {
                // Linux system detection
                const osRelease = await execCmdResultText('cat /etc/os-release');
                if (osRelease.includes('debian')) {
                    systemName = 'debian';
                    systemVersion = (await execCmdResultText('cat /etc/debian_version')).trim();
                } else if (osRelease.includes('ubuntu')) {
                    systemName = 'ubuntu';
                    const versionLine = osRelease.split('\n').find(line => line.startsWith('VERSION_ID='));
                    systemVersion = versionLine ? versionLine.split('=')[1].replace(/"/g, '') : 'unknown';
                } else if (osRelease.includes('centos')) {
                    systemName = 'centos';
                    systemVersion = (await execCmdResultText('cat /etc/centos-release')).match(/\d+\.\d+/)?.[0] || 'unknown';
                }
            }

            // Get Python version
            try {
                const pythonCmd = this.platform === 'win32' ? 'python --version' : 'python3 --version';
                pythonVersion = (await execCmdResultText(pythonCmd)).replace('Python ', '').trim();
            } catch (error) {
                log.error('Error getting Python version:', error);
            }

            return { systemName, systemVersion, pythonVersion };
        } catch (error) {
            log.error('Error getting system info:', error);
            return { systemName: 'unknown', systemVersion: 'unknown', pythonVersion: 'unknown' };
        }
    }

    async initializeVenvDir() {
        const { systemName, systemVersion, pythonVersion } = await this.getSystemInfo();
        this.venvDir = path.join(LANG_COMPILER_DIR, `pyenv_${systemName}_${systemVersion}_python${pythonVersion}`);
        return this.venvDir;
    }

    checkVenvEmpty() {
        try {
            if (!this.venvDir || !fs.existsSync(this.venvDir)) {
                return true;
            }
            const files = fs.readdirSync(this.venvDir);
            return files.length === 0;
        } catch (error) {
            log.error('Error checking venv directory:', error);
            return true;
        }
    }

    async cleanVenv() {
        try {
            if (this.venvDir && fs.existsSync(this.venvDir)) {
                if (this.checkVenvEmpty()) {
                    fs.rmSync(this.venvDir, { recursive: true, force: true });
                    log.info('Removed empty venv directory');
                }
            }
        } catch (error) {
            log.error('Error cleaning venv directory:', error);
        }
    }

    async createVenv() {
        try {
            await this.initializeVenvDir();
            await this.cleanVenv();

            if (!fs.existsSync(this.venvDir)) {
                fs.mkdirSync(this.venvDir, { recursive: true });
            }

            log.info('Creating new Python virtual environment...');
            const command = this.platform === 'win32'
                ? `python -m venv "${this.venvDir}"`
                : `python3 -m venv "${this.venvDir}"`;

            await execCmdResultText(command);

            // Verify venv creation
            const binDir = this.platform === 'win32' ? 'Scripts' : 'bin';
            const pythonPath = path.join(this.venvDir, binDir, this.platform === 'win32' ? 'python.exe' : 'python3');
            const pipPath = path.join(this.venvDir, binDir, this.platform === 'win32' ? 'pip.exe' : 'pip3');

            if (!fs.existsSync(pythonPath) || !fs.existsSync(pipPath)) {
                throw new Error('Virtual environment creation failed - executables not found');
            }

            log.success('Python virtual environment created successfully');
            return {
                success: true,
                venvPath: this.venvDir,
                pythonPath,
                pipPath
            };
        } catch (error) {
            log.error('Failed to create virtual environment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async ensureVenv() {
        try {
            await this.initializeVenvDir();

            if (this.checkVenvEmpty()) {
                log.info('Virtual environment is empty or does not exist, creating new one...');
                const venvStatus = await this.createVenv();
                log.info(venvStatus)
                return venvStatus;
            }

            const binDir = this.platform === 'win32' ? 'Scripts' : 'bin';
            const pythonPath = path.join(this.venvDir, binDir, this.platform === 'win32' ? 'python.exe' : 'python3');
            const pipPath = path.join(this.venvDir, binDir, this.platform === 'win32' ? 'pip.exe' : 'pip3');

            if (!fs.existsSync(pythonPath) || !fs.existsSync(pipPath)) {
                log.warn('Virtual environment appears corrupted, recreating...');
                return await this.createVenv();
            }
            gconfig.setConfig('PY_PATH', pythonPath);
            gconfig.setConfig('PY_PIP_PATH', pipPath);
            gconfig.setConfig('PY_VENV_PATH', this.venvDir);

            if (!printInit) {
                log.debug(`Virtual environment is ready! ${path.basename(this.venvDir)} ${pythonPath}`);
                printInit = true;
            }

            return {
                success: true,
                venvPath: this.venvDir,
                pythonPath,
                pipPath
            };
        } catch (error) {
            log.error('Failed to ensure virtual environment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async checkPipConfig(pipPath) {
        try {
            const result = await execCmdResultText(`"${pipPath}" config list`);
            return result.includes('global.index-url');
        } catch (error) {
            log.error('Error checking pip config:', error);
            return false;
        }
    }

    async configurePython(printResult = false) {
        let result = {

        }
        try {
            const venvStatus = await this.ensureVenv();
            if (!venvStatus.success) {
                result.success = false
                result.error = venvStatus.error
                log.error('Failed to ensure virtual environment');
                if(printResult){
                    console.log(result)
                    log.error(venvStatus.error)
                }
                return result
            }

            const { pythonPath, pipPath, venvPath } = venvStatus;

            // Check cache first
            if (gconfig.getConfig('PY_CONFIG_DONE')) {
                result.success = true
                result.pythonPath = pythonPath
                result.pipPath = pipPath
                result.venvPath = venvPath
                result.message = 'Configuration already exists'
                if(printResult){
                    console.log(result)
                    log.success('Python environment already as PY_CONFIG_DONE');
                }
                return result
            }

            // Check current pip config
            const hasConfig = await this.checkPipConfig(pipPath);
            if (hasConfig) {
                log.info('Pip global.index-url already configured');
                gconfig.setConfig('PY_CONFIG_DONE', true);
                result.success = true
                result.pythonPath = pythonPath
                result.pipPath = pipPath
                result.venvPath = venvPath
                result.message = 'Configuration already exists'
                if(printResult){
                    console.log(result)
                    log.success('Python environment already configured');
                }
                return result
            }

            // Configure pip
            log.info('Configuring pip global.index-url...');
            const mirrorUrl = 'https://pypi.tuna.tsinghua.edu.cn/simple';
            const configCmd = `"${pipPath}" config set global.index-url ${mirrorUrl}`;

            await execCmdResultText(configCmd);

            // Verify configuration
            const verifyConfig = await this.checkPipConfig(pipPath);
            if (!verifyConfig) {
                result.success = false
                result.error = 'Failed to verify pip configuration'
                log.error('Failed to verify pip configuration');
                if(printResult){
                    console.log(result)
                }
                return result
            }

            // Save successful configuration to cache
            gconfig.setConfig('PY_CONFIG_DONE', true);

            log.success('Python environment configured successfully');
            result.success = true
            result.pythonPath = pythonPath
            result.pipPath = pipPath
            result.venvPath = venvPath
            result.message = 'Configuration completed'
            if(printResult){
                console.log(result)
                log.success('Python environment configured successfully');
            }
            return result

        } catch (error) {
            log.error('Failed to configure Python environment:', error);
            result.success = false
            result.error = error.message
            if(printResult){
                console.log(result)
                log.error('Failed to configure Python environment:', error);
            }
            return result
        }
    }
}

module.exports = new PythonVenv();
