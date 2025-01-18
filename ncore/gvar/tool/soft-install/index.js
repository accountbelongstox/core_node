const os = require('os');
const { packageMap } = require('../common/package_map.js');
const packageManagerFactory = require('./linux-apt/package_manager.js');
const wingetManager = require('./winget/winget.js');
const softwareFinder = require('./win-soft/software_finder.js');
const fileFinder = require('../common/ffinder.js');

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

    info: function(...args) {
        console.log(this.colors.cyan + '[INFO]' + this.colors.reset, ...args);
    },
    warn: function(...args) {
        console.warn(this.colors.yellow + '[WARN]' + this.colors.reset, ...args);
    },
    error: function(...args) {
        console.error(this.colors.red + '[ERROR]' + this.colors.reset, ...args);
    },
    success: function(...args) {
        console.log(this.colors.green + '[SUCCESS]' + this.colors.reset, ...args);
    },
    debug: function(...args) {
        console.log(this.colors.magenta + '[DEBUG]' + this.colors.reset, ...args);
    },
    command: function(...args) {
        console.log(this.colors.brightBlue + '[COMMAND]' + this.colors.reset, ...args);
    }
};

/**
 * Windows package management functions
 */
const wingetTools = {
    install: async (packageId) => {
        return await wingetManager.installById(packageId);
    },

    search: async (searchTerm) => {
        return await wingetManager.search(searchTerm);
    },

    getInstalled: async () => {
        return await wingetManager.getInstalledPackages();
    }
};


const linuxTools = {
    // Install package by name
    install: async (packageName) => {
        return await packageManagerFactory.installPackage(packageName);
    }
};


class SmartInstaller {
    constructor() {
        this.isWindows = os.platform() === 'win32';
    }

    // Get package mapping from predefined keys
    getPackageMapping(shortName) {
        // First check if there's a direct match in packageMap
        if (packageMap[shortName]) {
            const pkgInfo = packageMap[shortName];
            return {
                category: pkgInfo.category,
                packages: {
                    winget: pkgInfo.packages.winget || null,
                    linux: this.isWindows ? [] :
                        (pkgInfo.packages.linux?.[packageManagerFactory.packageManager?.type] || [])
                }
            };
        }

        // If no direct match, search through all packages
        for (const [category, packages] of Object.entries(packageMap)) {
            // Skip entries with special format
            if (packages.category) continue;

            for (const [system, pkgList] of Object.entries(packages)) {
                if (Array.isArray(pkgList) && pkgList.some(pkg =>
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

        console.log(mapping)
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

async function getSoftwarePath(software, searchLevel = 2, useCache = true) {
    if (useCache && fileFinder.isFinderCacheValid(software)) {
        return fileFinder.getFinderCache(software);
    }
    return await softwareFinder.findSoftware(software, true, searchLevel, useCache);;
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

        // const path = await getSoftwarePath('7z',2,false)
        // log.info('7z path:', path || 'Not found');
    }

    runTests().catch(error => {
        log.error('Test failed:', error);
        process.exit(1);
    });
}
