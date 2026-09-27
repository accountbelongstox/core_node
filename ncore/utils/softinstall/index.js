const os = require('os');
const { packageMap } = require('./linux-apt/plist_map.js');
const packageManagerFactory = require('./linux-apt/package_manager.js');
const wingetManager = require('./winget/winget.js');
const softwareFinder = require('./win-soft/software_finder.js');
const fileFinder = require('./ffinder.js');

const log = require('#@logger');

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

