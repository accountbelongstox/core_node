const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { cacheDir } = require('./apt_utils.js');
const { getPackagesForSystem, getPackagesForCategory } = require('../../common/package_map.js');

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

            // Check OpenWrt (opkg)
            if (this.commandExists('opkg')) {
                log.info('Detected OpenWrt package manager: opkg');
                return {
                    type: 'opkg',
                    commands: {
                        install: 'opkg install',
                        update: 'opkg update',
                        search: 'opkg find',
                        check: 'opkg list-installed | grep -q',
                        list: 'opkg list-installed'
                    }
                };
            }

            // Check Alpine Linux (apk)
            if (this.commandExists('apk')) {
                log.info('Detected Alpine package manager: apk');
                return {
                    type: 'apk',
                    commands: {
                        install: 'apk add',
                        update: 'apk update',
                        search: 'apk search -v',
                        check: 'apk info -e',
                        list: 'apk info'
                    }
                };
            }

            // Check APT (Debian/Ubuntu)
            if (this.commandExists('apt')) {
                return {
                    type: 'apt',
                    commands: {
                        install: 'apt install -y',
                        update: 'apt update',
                        search: 'apt search',
                        check: 'dpkg -l'
                    }
                };
            }

            // Check YUM (RHEL/CentOS)
            if (this.commandExists('yum')) {
                return {
                    type: 'yum',
                    commands: {
                        install: 'yum install -y',
                        update: 'yum check-update',
                        search: 'yum search',
                        check: 'rpm -q'
                    }
                };
            }

            // Check DNF (Fedora)
            if (this.commandExists('dnf')) {
                return {
                    type: 'dnf',
                    commands: {
                        install: 'dnf install -y',
                        update: 'dnf check-update',
                        search: 'dnf search',
                        check: 'rpm -q'
                    }
                };
            }

            // Check Pacman (Arch Linux)
            if (this.commandExists('pacman')) {
                return {
                    type: 'pacman',
                    commands: {
                        install: 'pacman -S --noconfirm',
                        update: 'pacman -Sy',
                        search: 'pacman -Ss',
                        check: 'pacman -Q'
                    }
                };
            }

            // Check Zypper (openSUSE)
            if (this.commandExists('zypper')) {
                return {
                    type: 'zypper',
                    commands: {
                        install: 'zypper install -y',
                        update: 'zypper refresh',
                        search: 'zypper search',
                        check: 'rpm -q'
                    }
                };
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
            // Try to load from cache first
            const manager = await this.loadFromCache();
            if (manager) {
                this.packageManager = manager;
                return manager;
            }

            // Detect package manager if not in cache
            const detectedManager = await this.detectPackageManager();
            if (detectedManager) {
                await this.saveToCache(detectedManager);
                this.packageManager = detectedManager;
                return detectedManager;
            }

            throw new Error('No supported package manager found');
        } catch (error) {
            log.error('Error getting package manager:', error);
            return null;
        }
    }

    async loadFromCache() {
        try {
            const fs = require('fs');
            if (fs.existsSync(this.cacheFile)) {
                const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
                if (cache && cache.timestamp && Date.now() - cache.timestamp < 86400000) { // 24 hours
                    return cache.manager;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async saveToCache(manager) {
        try {
            const fs = require('fs');
            const cache = {
                timestamp: Date.now(),
                manager
            };
            fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
        } catch (error) {
            log.error('Error saving to cache:', error);
        }
    }

    async checkSourcesUpdated() {
        if (!this.isLinux) return false;

        try {
            const fs = require('fs');
            const updateCache = this.loadUpdateCache();
            const lastUpdateTime = updateCache ? updateCache.timestamp : 0;

            // Check main sources.list file
            const mainSourceStats = fs.statSync(this.mainSourceFile);
            if (mainSourceStats.mtimeMs > lastUpdateTime) {
                return true;
            }

            // Check sources.list.d directory
            if (fs.existsSync(this.sourcesPath)) {
                const files = fs.readdirSync(this.sourcesPath);
                for (const file of files) {
                    if (!file.endsWith('.list')) continue;

                    const filePath = path.join(this.sourcesPath, file);
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs > lastUpdateTime) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            log.error('Error checking sources update:', error);
            return true; // If error, assume update needed
        }
    }

    loadUpdateCache() {
        try {
            const fs = require('fs');
            if (fs.existsSync(this.updateCacheFile)) {
                return JSON.parse(fs.readFileSync(this.updateCacheFile, 'utf8'));
            }
        } catch (error) {
            log.error('Error loading update cache:', error);
        }
        return null;
    }

    saveUpdateCache() {
        try {
            const fs = require('fs');
            const cache = {
                timestamp: Date.now()
            };
            fs.writeFileSync(this.updateCacheFile, JSON.stringify(cache, null, 2));
        } catch (error) {
            log.error('Error saving update cache:', error);
        }
    }

    async updatePackageList() {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            const sysInfo = await this.detectSystemInfo();

            switch (manager.type) {
                case 'apt':
                    // ... existing apt update logic ...
                    break;

                case 'apk':
                    // Alpine doesn't need source checking
                    execSync('sudo apk update', { stdio: 'inherit' });
                    break;

                case 'opkg':
                    // OpenWrt update
                    execSync('opkg update', { stdio: 'inherit' });
                    break;

                default:
                    // Use generic update command
                    execSync(`sudo ${manager.commands.update}`, { stdio: 'inherit' });
            }

            log.success('Package lists updated successfully');
            return true;

        } catch (error) {
            log.error('Failed to update package lists:', error);
            return false;
        }
    }

    async installPackage(packageName) {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            const sysInfo = await this.detectSystemInfo();
            log.info(`Installing on ${sysInfo.type} ${sysInfo.version} using ${manager.type}`);

            // Update package lists if needed
            await this.updatePackageList();

            // Check if already installed
            const checkCmd = `${manager.commands.check} ${packageName}`;
            try {
                execSync(checkCmd, { stdio: 'ignore' });
                log.info(`Package "${packageName}" is already installed`);
                return true;
            } catch {
                // Package not installed, continue with installation
            }

            // Install package
            log.info(`Installing ${packageName} using ${manager.type}...`);
            const installCmd = manager.type === 'opkg' ?
                `${manager.commands.install} ${packageName}` :
                `sudo ${manager.commands.install} ${packageName}`;

            execSync(installCmd, { stdio: 'inherit' });

            // Verify installation
            try {
                execSync(checkCmd, { stdio: 'ignore' });
                log.success(`Successfully installed "${packageName}"`);
                return true;
            } catch {
                log.error(`Failed to verify installation of "${packageName}"`);
                return false;
            }
        } catch (error) {
            log.error(`Failed to install "${packageName}":`, error);
            return false;
        }
    }

    async installPackageSet(packageSet = 'minimal') {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            const sysInfo = await this.detectSystemInfo();
            const packages = getPackagesForSystem(manager.type, packageSet);

            log.info(`Installing ${packageSet} package set (${packages.length} packages) on ${sysInfo.type}`);
            log.info('Packages to install:', packages.join(', '));

            let success = true;
            for (const pkg of packages) {
                const result = await this.installPackage(pkg);
                if (!result) {
                    log.warn(`Failed to install ${pkg}`);
                    success = false;
                }
            }

            return success;
        } catch (error) {
            log.error(`Failed to install package set ${packageSet}:`, error);
            return false;
        }
    }

    async installCategory(category) {
        const manager = await this.getPackageManager();
        if (!manager) return false;

        try {
            const packages = getPackagesForCategory(manager.type, category);
            if (!packages.length) {
                log.warn(`No packages found for category ${category}`);
                return false;
            }

            log.info(`Installing ${category} packages:`, packages.join(', '));
            let success = true;
            for (const pkg of packages) {
                const result = await this.installPackage(pkg);
                if (!result) {
                    log.warn(`Failed to install ${pkg}`);
                    success = false;
                }
            }

            return success;
        } catch (error) {
            log.error(`Failed to install category ${category}:`, error);
            return false;
        }
    }
}

// Create singleton instance
const packageManagerFactory = new PackageManagerFactory();
module.exports = packageManagerFactory;

// Test code
if (require.main === module) {
    async function runTests() {
        console.log('Running Package Manager Factory tests...');

        // Test 1: Detect package manager
        console.log('\nTest 1: Detecting package manager');
        const manager = await packageManagerFactory.getPackageManager();
        console.log('Detected package manager:', manager);

        // Test 2: Install a package
        const packageName = 'git';
        console.log(`\nTest 2: Installing ${packageName}`);
        const result = await packageManagerFactory.installPackage(packageName);
        console.log('Installation result:', result);
    }

    runTests().catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });
} 