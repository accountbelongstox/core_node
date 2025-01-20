const { execCmdResultText } = require('#@/ncore/basic/libs/commander.js');
const os = require('os');
const gconfig = require('#@/ncore/gvar/gconfig.js');

let log;
try {
    const logger = require('#@logger');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args)
    };
}

class PythonSetup {
    constructor() {
        this.platform = os.platform();
        this.pythonPath = null;
        this.pipPath = null;
        this.requiredPackages = [
            'python3-dev',
            'python3-setuptools',
            'python3-wheel',
            'python3-venv',
            'build-essential'
        ];
    }

    async getPythonPath() {
        try {
            const command = this.platform === 'win32' ? 'where python' : 'which python3';
            const result = await execCmdResultText(command);
            return result ? result.trim().split('\n')[0] : null; 
        } catch (error) {
            return null;
        }
    }

    async getPipPath() {
        try {
            const command = this.platform === 'win32' ? 'where pip' : 'which pip3';
            const result = await execCmdResultText(command);
            const pipPath = result.trim().split('\n')[0];
            return pipPath ? pipPath : null
        } catch (error) {
            console.log(error)
            return null;
        }
    }

    async checkPython3() {
        try {
            if (this.pythonPath) {
                return true;
            }
            await execCmdResultText('python3 --version');
            this.pythonPath = await this.getPythonPath();
            return true;
        } catch (error) {
            console.log(error)
            try {
                if (this.platform === 'win32') {
                    await execCmdResultText('python --version');
                    this.pythonPath = await this.getPythonPath();
                    return true;
                }
                return false;
            } catch (err) {
                console.log(err)
                return false;
            }
        }
    }

    async checkPip() {
        try {
            if (this.pipPath) {
                return true;
            }
            await execCmdResultText('pip3 --version');
            this.pipPath = await this.getPipPath();
            return this.pipPath ? true : false;
        } catch (error) {
            try {
                if (this.platform === 'win32') {
                    await execCmdResultText('pip --version');
                    this.pipPath = await this.getPipPath();
                    return true;
                }
                return false;
            } catch (err) {
                return false;
            }
        }
    }

    async installPython3() {
        try {
            switch (this.platform) {
                case 'linux':
                    const osRelease = await execCmdResultText('cat /etc/os-release');
                    if (osRelease.includes('Ubuntu') || osRelease.includes('Debian')) {
                        await execCmdResultText('sudo apt-get update && sudo apt-get install -y python3');
                    } else if (osRelease.includes('CentOS') || osRelease.includes('Red Hat')) {
                        await execCmdResultText('sudo yum install -y python3');
                    } else {
                        log.error('Unsupported Linux distribution');
                    }
                    break;
                case 'darwin':
                    await execCmdResultText('brew install python3');
                    break;
                case 'win32':
                    log.error('Please install Python3 manually from https://www.python.org/downloads/');
                    log.error('Manual Python installation required on Windows');
                default:
                    log.error(`Unsupported platform: ${this.platform}`);
            }
            this.pythonPath = await this.getPythonPath();
            return true;
        } catch (error) {
            log.error('Failed to install Python3:', error.message);
            return false;
        }
    }

    async installPip() {
        try {
            switch (this.platform) {
                case 'linux':
                    const osRelease = await execCmdResultText('cat /etc/os-release');
                    if (osRelease.includes('Ubuntu') || osRelease.includes('Debian')) {
                        await execCmdResultText('sudo apt-get update && sudo apt-get install -y python3-pip');
                    } else if (osRelease.includes('CentOS') || osRelease.includes('Red Hat')) {
                        await execCmdResultText('sudo yum install -y python3-pip');
                    } else {
                        throw new Error('Unsupported Linux distribution');
                    }
                    break;
                case 'darwin':
                    await execCmdResultText('curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py');
                    await execCmdResultText('python3 get-pip.py');
                    break;
                case 'win32':
                    await execCmdResultText('curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py');
                    await execCmdResultText('python get-pip.py');
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            this.pipPath = await this.getPipPath();
            return this.pipPath ? true : false;
        } catch (error) {
            log.error('Failed to install pip:', error.message);
            return false;
        }
    }

    async installPythonDependencies() {
        try {
            if(gconfig.getConfig('PY_CONFIG_DONE')){
                return true;
            }
            if (this.platform === 'linux') {
                const osRelease = await execCmdResultText('cat /etc/os-release');
                if (osRelease.includes('Ubuntu') || osRelease.includes('Debian')) {
                    log.info('Installing Python dependencies for Debian/Ubuntu...');
                    await execCmdResultText('sudo apt-get update');
                    for (const pkg of this.requiredPackages) {
                        try {
                            log.info(`Installing ${pkg}...`);
                            await execCmdResultText(`sudo apt-get install -y ${pkg}`);
                        } catch (error) {
                            log.warn(`Failed to install ${pkg}: ${error.message}`);
                        }
                    }
                } else if (osRelease.includes('CentOS') || osRelease.includes('Red Hat')) {
                    log.info('Installing Python dependencies for CentOS/RHEL...');
                    const rhelPackages = this.requiredPackages.map(pkg => 
                        pkg.replace('python3-', 'python3-').replace('build-essential', 'gcc gcc-c++ make')
                    );
                    for (const pkg of rhelPackages) {
                        try {
                            log.info(`Installing ${pkg}...`);
                            await execCmdResultText(`sudo yum install -y ${pkg}`);
                        } catch (error) {
                            log.warn(`Failed to install ${pkg}: ${error.message}`);
                        }
                    }
                }
                return true;
            }
            return true; // Skip for non-Linux platforms
        } catch (error) {
            log.error('Failed to install Python dependencies:', error.message);
            return false;
        }
    }

    async ensurePythonEnvironment() {
        try {
            if (this.pythonPath && this.pipPath) {
                return {
                    success: true,
                    pythonPath: this.pythonPath,
                    pipPath: this.pipPath
                };
            }

            // Install Python dependencies first on Linux
            if (this.platform === 'linux') {
                await this.installPythonDependencies();
            }

            // Check Python3
            if (!await this.checkPython3()) {
                log.warn('Python3 not found, attempting to install...');
                const pythonInstalled = await this.installPython3();
                if (!pythonInstalled) {
                    throw new Error('Failed to install Python3');
                }
            } else {
                log.warn(`global pythonPath: ${gconfig.getConfig('PY_PATH')}`);
            }

            // Check pip
            if (!await this.checkPip()) {
                log.warn('pip not found, attempting to install...');
                const pipInstalled = await this.installPip();
                if (!pipInstalled) {
                    log.error('Failed to install pip');
                }
            } else {
                log.warn(`global pipPath: ${gconfig.getConfig('PY_PIP_PATH')}`);
            }

            return {
                success: true,
                pythonPath: this.pythonPath,
                pipPath: this.pipPath
            };
        } catch (error) {
            log.error('Failed to ensure Python environment:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PythonSetup(); 