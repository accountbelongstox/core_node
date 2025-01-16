const os = require('os');
const path = require('path');
const { packageMap } = require('./common/package_map.js');
const packageManagerFactory = require('./linux-apt/package_manager.js');
const wingetManager = require('./winget/winget.js');
const { execCmdResultText } = require('./common/cmder.js');
const softwareFinder = require('./win-soft/software_finder.js');
const fileFinder = require('./common/ffinder.js');

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        debug: (...args) => logger.debug(...args),
        command: (...args) => logger.command(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args),
        command: (...args) => console.log('[COMMAND]', ...args)
    };
}

/**
 * Windows package management functions
 */
const wingetTools = {
    // Install package by winget ID
    install: async (packageId) => {
        return await wingetManager.installById(packageId);
    },

    // Search packages
    search: async (searchTerm) => {
        return await wingetManager.search(searchTerm);
    },

    // Get installed packages
    getInstalled: async () => {
        return await wingetManager.getInstalledPackages();
    }
};

/**
 * Linux package management functions
 */
const linuxTools = {
    // Install package by name
    install: async (packageName) => {
        return await packageManagerFactory.installPackage(packageName);
    }
};

/**
 * Smart package installer
 * Installs packages based on predefined keys or direct package names
 */
class SmartInstaller {
    constructor() {
        this.isWindows = os.platform() === 'win32';
    }

    // Get package mapping from predefined keys
    getPackageMapping(shortName) {
        for (const [category, packages] of Object.entries(packageMap)) {
            for (const [system, pkgList] of Object.entries(packages)) {
                if (pkgList.some(pkg =>
                    pkg.toLowerCase().includes(shortName.toLowerCase()) ||
                    pkg.toLowerCase().replace(/[-_.]/g, '').includes(shortName.toLowerCase().replace(/[-_.]/g, ''))
                )) {
                    return {
                        category,
                        packages: {
                            winget: packages.winget?.[0] || null,
                            linux: packages[this.isWindows ? 'winget' : packageManagerFactory.packageManager?.type] || []
                        }
                    };
                }
            }
        }
        return null;
    }

    // Install by predefined key
    async smartInstall(shortName) {
        const mapping = this.getPackageMapping(shortName);

        if (!mapping) {
            log.warn(`No predefined package found for "${shortName}"`);
            log.info('\nAvailable predefined packages:');

            for (const [category, packages] of Object.entries(packageMap)) {
                const system = this.isWindows ? 'winget' : 'apt';
                const pkgList = packages[system] || [];
                if (pkgList.length > 0) {
                    log.info(`\n${category}:`);
                    pkgList.forEach(pkg => log.info(`  - ${pkg}`));
                }
            }

            return false;
        }

        log.info(`Found package mapping for "${shortName}":`);
        log.info(`Category: ${mapping.category}`);
        log.info(`Package name: ${this.isWindows ? mapping.packages.winget : mapping.packages.linux[0]}`);

        try {
            if (this.isWindows) {
                if (mapping.packages.winget) {
                    return await wingetTools.install(mapping.packages.winget);
                }
                log.warn('No Windows package defined for this software');
                return false;
            } else {
                if (mapping.packages.linux.length > 0) {
                    return await linuxTools.install(mapping.packages.linux[0]);
                }
                log.warn('No Linux package defined for this system');
                return false;
            }
        } catch (error) {
            log.error('Installation failed:', error);
            return false;
        }
    }

    // Install by direct package name
    async install(packageName) {
        return this.isWindows ?
            await wingetTools.install(packageName) :
            await linuxTools.install(packageName);
    }
}

async function getSoftwarePath(software,searchLevel = 2,useCache = true) {
    if(useCache && fileFinder.isFinderCacheValid(software)) {
        return fileFinder.getFinderCache(software);
    }
    return await softwareFinder.findSoftware(software, true,searchLevel, useCache);;
}

const smartInstaller = new SmartInstaller();

module.exports = {
    wingetTools,
    linuxTools,
    smartInstaller,
    getSoftwarePath
};

// Test code
if (require.main === module) {
    async function runTests() {
        const { wingetTools, linuxTools, smartInstaller, getSoftwarePath } = require('./index.js');

        log.info('Running tests...');

        // // Windows specific tests
        // if (os.platform() === 'win32') {
        //     log.info('\nWindows Tests:');
        //     log.info('\nSearching for 7zip:');
        //     const results = await wingetTools.search('7zip');
        //     log.info('Search results:', results);

        //     log.info('\nGetting installed packages:');
        //     const installed = await wingetTools.getInstalled();
        //     log.info('Installed packages:', installed);

        //     log.info('\nInstalling Git:');
        //     await wingetTools.install('Git.Git');
        // }
        // // Linux specific tests
        // else {
        //     log.info('\nLinux Tests:');
        //     log.info('\nInstalling git:');
        //     await linuxTools.install('git');
        // }

        // // Cross-platform tests
        // log.info('\nCross-platform Tests:');
        // log.info('\nInstalling by key (7z):');
        // await smartInstaller.smartInstall('7z');

        // log.info('\nDirect install:');
        // const pkg = os.platform() === 'win32' ? 'Python.Python.3.11' : 'python3';
        // await smartInstaller.install(pkg);

        const path = await getSoftwarePath('7z',2,false)
        log.info('7z path:', path || 'Not found');
    }

    runTests().catch(error => {
        log.error('Test failed:', error);
        process.exit(1);
    });
}
