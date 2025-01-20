const os = require('os');
const { packageMap } = require('./linux-apt/plist_map.js');
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
        const pkgInfo = packageMap[shortName];
        if (pkgInfo) {
            return pkgInfo;
        }
        return null;
    }

    // Install by predefined key
    async smartInstall(shortName) {
        const mapping = this.getPackageMapping(shortName);
        log.info(`mapping: shortName ${shortName}`);
        if (!mapping) {
            log.warn(`No predefined package found for "${shortName}"`);
            log.info('\nAvailable predefined packages:');
            return false;
        }

        log.info(`Found package mapping for "${shortName}":`);
        console.log(mapping)

        try {
            if (this.isWindows) {
                if (mapping.packages.winget) {
                    return await wingetTools.install(mapping.packages.winget);
                }
                log.warn('No Windows package defined for this software');
                return false;
            } else {
                const manager = await packageManagerFactory.getPackageManager();
                const packageType = manager.type
                const pkgList = mapping[packageType]
                if (pkgList.length > 0) {
                    log.info(`Installing ${pkgList.join(', ')} using ${packageType}...`);
                    return await linuxTools.install(pkgList);
                }
                log.warn(`No Linux package defined for this system by packageType: ${packageType}`);
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

