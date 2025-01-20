const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { cacheDir } = require('./apt_utils.js');
const logger = require('#@logger');
const { pipeExecCmd, execCmd } = require('#@commander');
const packageManagerMap = require('./pmanager_map.js');

const log = {
    colors: {
        reset: '\x1b[0m',
        // Regular colors
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        // Bright colors
        brightRed: '\x1b[91m',
        brightGreen: '\x1b[92m',
        brightYellow: '\x1b[93m',
        brightBlue: '\x1b[94m',
        brightMagenta: '\x1b[95m',
        brightCyan: '\x1b[96m',
        brightWhite: '\x1b[97m',
    },

    info: function (...args) {
        console.log(this.colors.cyan + '[INFO]' + this.colors.reset, ...args);
    },
    warn: function (...args) {
        console.warn(this.colors.yellow + '[WARN]' + this.colors.reset, ...args);
    },
    error: function (...args) {
        console.error(this.colors.red + '[ERROR]' + this.colors.reset, ...args);
    },
    success: function (...args) {
        console.log(this.colors.green + '[SUCCESS]' + this.colors.reset, ...args);
    },
    debug: function (...args) {
        console.log(this.colors.magenta + '[DEBUG]' + this.colors.reset, ...args);
    },
    command: function (...args) {
        console.log(this.colors.brightBlue + '[COMMAND]' + this.colors.reset, ...args);
    }
};

class PackageManagerFactory {
    constructor() {
        this.packageManager = null;
        this.cacheFile = path.join(cacheDir, 'package_manager.json');
        this.isLinux = os.platform() === 'linux';
        this.updateCacheFile = path.join(cacheDir, 'apt_update.json');
        this.sourcesPath = '/etc/apt/sources.list.d';
        this.mainSourceFile = '/etc/apt/sources.list';
        this.systemInfo = null;
        this.hasSudo = this.commandExists('sudo');
    }

    async detectSystemInfo() {
        if (!this.isLinux) return null;
        if (this.systemInfo) return this.systemInfo;

        try {
            let info = {
                os: os.platform(),
                type: 'unknown',
                version: 'unknown',
                packageManager: 'unknown'
            };

            // Check for OpenWrt
            if (fs.existsSync('/etc/openwrt_release')) {
                info.type = 'openwrt';
                try {
                    const release = fs.readFileSync('/etc/openwrt_release', 'utf8');
                    const version = release.match(/DISTRIB_RELEASE='(.+)'/);
                    if (version) info.version = version[1];
                } catch (e) { }
            }
            // Check for Alpine
            else if (fs.existsSync('/etc/alpine-release')) {
                info.type = 'alpine';
                try {
                    info.version = fs.readFileSync('/etc/alpine-release', 'utf8').trim();
                } catch (e) { }
            }
            // Check for other distributions
            else if (fs.existsSync('/etc/os-release')) {
                const release = fs.readFileSync('/etc/os-release', 'utf8');
                const id = release.match(/^ID=(.+)$/m);
                const version = release.match(/^VERSION_ID=(.+)$/m);
                if (id) info.type = id[1].replace(/"/g, '');
                if (version) info.version = version[1].replace(/"/g, '');
            }

            this.systemInfo = info;
            return info;
        } catch (error) {
            log.error('Error detecting system info:', error);
            return null;
        }
    }

    async detectPackageManager() {
        if (!this.isLinux) {
            log.error('Not a Linux system');
            return null;
        }
        try {
            const sysInfo = await this.detectSystemInfo();
            log.info('Detected system:', sysInfo);
            for (const [cmd, config] of Object.entries(packageManagerMap)) {
                if (this.commandExists(cmd)) {
                    log.info(`Detected ${config.type} package manager`);
                    return config;
                }
            }
            return null;
        } catch (error) {
            log.error('Error detecting package manager:', error);
            return null;
        }
    }

    commandExists(cmd) {
        try {
            execSync(`which ${cmd}`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    async getPackageManager() {
        if (this.packageManager) {
            return this.packageManager;
        }
        try {
            const detectedManager = await this.detectPackageManager();
            if (detectedManager) {
                this.packageManager = detectedManager;
                return detectedManager;
            }
            log.error('No supported package manager found');
            return null;
        } catch (error) {
            log.error('Error getting package manager:', error);
            return null;
        }
    }

    wrapSudo(cmd) {
        return this.hasSudo ? `sudo ${cmd}` : cmd;
    }

    async installPackage(packageNameOrList) {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            const sysInfo = await this.detectSystemInfo();
            logger.info(`Installing on ${sysInfo.type} ${sysInfo.version} using ${manager.type}`);

            // Convert input to array
            const packages = Array.isArray(packageNameOrList) ? packageNameOrList : [packageNameOrList];
            if (packages.length === 0) {
                logger.warn('No packages specified for installation');
                return false;
            }

            // Update package lists first
            const updateCmd = manager.type === 'opkg' ? 
                manager.commands.update : 
                this.wrapSudo(manager.commands.update);
            
            try {
                await pipeExecCmd(updateCmd);
                logger.success('Package lists updated successfully');
            } catch (error) {
                logger.error('Failed to update package lists:', error);
                return false;
            }

            // Install packages
            logger.info(`Installing packages: ${packages.join(', ')}`);
            const installCmd = manager.type === 'opkg' ?
                `${manager.commands.install} ${packages.join(' ')}` :
                this.wrapSudo(`${manager.commands.install} ${packages.join(' ')}`);

            try {
                await pipeExecCmd(installCmd);
                logger.success('Package installation completed');

                // Verify installation
                let allInstalled = true;
                for (const pkg of packages) {
                    const checkCmd = `${manager.commands.check} ${pkg}`;
                    try {
                        await execCmd(checkCmd);
                        logger.success(`Successfully installed "${pkg}"`);
                    } catch {
                        logger.error(`Failed to verify installation of "${pkg}"`);
                        allInstalled = false;
                    }
                }

                return allInstalled;
            } catch (error) {
                logger.error('Failed to install packages:', error);
                return false;
            }
        } catch (error) {
            logger.error('Package installation failed:', error);
            return false;
        }
    }

    async remove(packageName) {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            const cmd = manager.type === 'opkg' ? 
                `${manager.commands.install} remove ${packageName}` :
                this.wrapSudo(`${manager.commands.install} remove ${packageName}`);
            
            await pipeExecCmd(cmd);
            logger.success(`Package ${packageName} removed successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to remove package ${packageName}:`, error);
            return false;
        }
    }

    async purge(packageName) {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            // Only apt-based systems support purge
            if (manager.type !== 'apt') {
                return this.remove(packageName);
            }

            const cmd = this.wrapSudo(`apt-get purge -y ${packageName}`);
            await pipeExecCmd(cmd);
            logger.success(`Package ${packageName} purged successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to purge package ${packageName}:`, error);
            return false;
        }
    }

    async autoremove() {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            // Only apt-based systems support autoremove
            if (manager.type !== 'apt') {
                logger.info('Autoremove is only supported on apt-based systems');
                return true;
            }

            await pipeExecCmd(this.wrapSudo('apt-get autoremove -y'));
            logger.success('Unused packages removed successfully');
            return true;
        } catch (error) {
            logger.error('Failed to remove unused packages:', error);
            return false;
        }
    }

    async clean() {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            if (!manager.commands.clean) {
                logger.info('Clean operation not supported for this package manager');
                return true;
            }

            const cmd = manager.type === 'opkg' ? 
                manager.commands.clean : 
                this.wrapSudo(manager.commands.clean);

            await pipeExecCmd(cmd);
            logger.success('Package cache cleaned successfully');
            return true;
        } catch (error) {
            logger.error('Failed to clean package cache:', error);
            return false;
        }
    }

    async isInstalled(packageName) {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            const result = await execCmd(`${manager.commands.check} ${packageName}`);
            return result.trim() !== '';
        } catch (error) {
            return false;
        }
    }

    async search(packageName) {
        const manager = await this.getPackageManager();
        if (!manager) return [];

        try {
            const result = await pipeExecCmd(`${manager.commands.search} ${packageName}`);
            const lines = result.split('\n').filter(line => line.trim());

            // Different package managers have different output formats
            switch (manager.type) {
                case 'apt':
                    return lines.map(line => {
                        const [name, ...descParts] = line.split(' - ');
                        return {
                            name: name.trim(),
                            description: descParts.join(' - ').trim()
                        };
                    });

                case 'yum':
                case 'dnf':
                    return lines.map(line => {
                        const match = line.match(/^(.+?)\s*:\s*(.+)$/);
                        return match ? {
                            name: match[1].trim(),
                            description: match[2].trim()
                        } : null;
                    }).filter(Boolean);

                case 'pacman':
                    const packages = [];
                    let currentPackage = null;
                    for (const line of lines) {
                        if (line.startsWith('    ')) {
                            if (currentPackage) {
                                currentPackage.description = line.trim();
                                packages.push(currentPackage);
                                currentPackage = null;
                            }
                        } else {
                            const parts = line.split(' ');
                            currentPackage = { name: parts[0], description: '' };
                        }
                    }
                    return packages;

                default:
                    // Generic format for other package managers
                    return lines.map(line => ({
                        name: line.split(/\s+/)[0],
                        description: line.substring(line.indexOf(' ')).trim()
                    }));
            }
        } catch (error) {
            logger.error(`Failed to search for package ${packageName}:`, error);
            return [];
        }
    }
}

// Create singleton instance
const packageManagerFactory = new PackageManagerFactory();
module.exports = packageManagerFactory;
