const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { cacheDir } = require('./apt_utils.js');
const logger = require('#@logger');
const { pipeExecCmd, runCommand } = require('#@commander');
const packageManagerMap = require('./pmanager_map.js');

const log = logger;

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
            
            // A failed list update (or yum/dnf check-update exit 100) does not block the install attempt
            if (pipeExecCmd(updateCmd) === null) {
                logger.warn('Package list update did not finish cleanly; installing with the current lists');
            } else {
                logger.success('Package lists updated successfully');
            }

            // Install packages
            logger.info(`Installing packages: ${packages.join(', ')}`);
            const installCmd = manager.type === 'opkg' ?
                `${manager.commands.install} ${packages.join(' ')}` :
                this.wrapSudo(`${manager.commands.install} ${packages.join(' ')}`);

            if (pipeExecCmd(installCmd) === null) {
                logger.error(`Failed to install packages: ${packages.join(', ')}`);
                return false;
            }
            logger.success('Package installation completed');

            // Verify installation by exit status (and the installed marker where the manager has one)
            let allInstalled = true;
            for (const pkg of packages) {
                if (await this.isInstalled(pkg)) {
                    logger.success(`Successfully installed "${pkg}"`);
                } else {
                    logger.error(`Failed to verify installation of "${pkg}"`);
                    allInstalled = false;
                }
            }

            return allInstalled;
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
                `${manager.commands.remove} ${packageName}` :
                this.wrapSudo(`${manager.commands.remove} ${packageName}`);
            
            if (pipeExecCmd(cmd) === null) {
                logger.error(`Failed to remove package ${packageName}`);
                return false;
            }
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
            if (pipeExecCmd(cmd) === null) {
                logger.error(`Failed to purge package ${packageName}`);
                return false;
            }
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

            if (pipeExecCmd(this.wrapSudo('apt-get autoremove -y')) === null) {
                logger.error('Failed to remove unused packages');
                return false;
            }
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

            if (pipeExecCmd(cmd) === null) {
                logger.error('Failed to clean package cache');
                return false;
            }
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

        const result = runCommand(`${manager.commands.check} ${packageName}`);
        if (!result.success) {
            return false;
        }
        return manager.installedPattern ? result.stdout.includes(manager.installedPattern) : true;
    }

    async search(packageName) {
        const manager = await this.getPackageManager();
        if (!manager) return [];

        try {
            const result = runCommand(`${manager.commands.search} ${packageName}`);
            if (!result.success) {
                return [];
            }
            const lines = result.stdout.split('\n').filter(line => line.trim());

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
