const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPackageManagerForDistro } = require('./package_map.js');
const { readCache, writeCache } = require('../tool/common/cache_manager.js');

// Cache keys
const SYSTEM_INFO_CACHE_KEY = 'system_info';

/**
 * Get Windows system information
 * @returns {Object} Windows system information
 */
function getWindowsInfo() {
    try {
        const systemInfo = {
            id: 'windows',
            versionId: os.release(),
            prettyName: `Windows ${os.release()}`,
            isWindows: true,
            isDebian: false,
            isUbuntu: false,
            packageManager: {
                name: 'winget',
                type: 'WINGET',
                commands: {
                    install: 'winget install',
                    remove: 'winget uninstall',
                    update: 'winget upgrade',
                    search: 'winget search',
                    list: 'winget list',
                    verify: 'winget show'
                }
            },
            details: {
                arch: process.arch,
                platform: process.platform,
                windowsVersion: os.release(),
                hasWinget: false,
                programFiles: process.env['ProgramFiles'],
                programFilesX86: process.env['ProgramFiles(x86)'],
                localAppData: process.env['LOCALAPPDATA'],
                appData: process.env['APPDATA'],
                // Linux compatibility fields (null/empty)
                hasApt: false,
                hasAptGet: false,
                hasDpkg: false,
                sourcesListPath: null,
                sourcesListDir: null,
                repositories: [],
                architecture: process.arch
            }
        };

        // Check if winget exists by looking for the executable in common locations
        const wingetPaths = [
            path.join(process.env['LOCALAPPDATA'], 'Microsoft', 'WindowsApps', 'winget.exe'),
            path.join(process.env['ProgramFiles'], 'WindowsApps', 'Microsoft.DesktopAppInstaller_*', 'winget.exe')
        ];

        systemInfo.details.hasWinget = wingetPaths.some(wingetPath => {
            try {
                return fs.existsSync(wingetPath);
            } catch (e) {
                return false;
            }
        });

        if (!systemInfo.details.hasWinget) {
            systemInfo.packageManager = null;
        }

        return systemInfo;
    } catch (e) {
        return {
            id: 'windows',
            versionId: 'unknown',
            prettyName: 'Windows Unknown',
            isWindows: true,
            isDebian: false,
            isUbuntu: false,
            packageManager: null,
            details: {
                arch: process.arch,
                platform: process.platform,
                hasWinget: false,
                hasApt: false,
                hasAptGet: false,
                hasDpkg: false,
                sourcesListPath: null,
                sourcesListDir: null,
                repositories: [],
                architecture: process.arch,
                programFiles: process.env['ProgramFiles'],
                programFilesX86: process.env['ProgramFiles(x86)'],
                localAppData: process.env['LOCALAPPDATA'],
                appData: process.env['APPDATA']
            }
        };
    }
}

/**
 * Get package manager info based on system type and distribution
 * @param {string} id Distribution ID
 * @returns {Object|null} Package manager info
 */
function detectPackageManager(id) {
    // Get package manager from map
    const manager = getPackageManagerForDistro(id);
    if (manager) {
        return manager;
    }

    // Default to APT for unknown Debian-based systems
    if (fs.existsSync('/usr/bin/apt') || fs.existsSync('/usr/bin/apt-get')) {
        return getPackageManagerForDistro('debian');
    }

    return null;
}

/**
 * Get system information
 * @returns {Object} System information
 */
function getSystemInfo() {
    // Try to read from cache first
    const cachedInfo = readCache(SYSTEM_INFO_CACHE_KEY);
    if (cachedInfo) {
        return cachedInfo;
    }

    // Check if Windows
    if (os.platform() === 'win32') {
        const windowsInfo = getWindowsInfo();
        // Save to cache
        writeCache(SYSTEM_INFO_CACHE_KEY, windowsInfo);
        return windowsInfo;
    }

    // Linux system detection
    try {
        let id = 'unknown';
        let versionId = 'unknown';
        let prettyName = '';
        let isDebian = false;
        let isUbuntu = false;

        if (fs.existsSync('/etc/os-release')) {
            const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
            id = osRelease.match(/^ID=(.*)$/m)?.[1]?.toLowerCase().replace(/["']/g, '') || id;
            versionId = osRelease.match(/^VERSION_ID=(.*)$/m)?.[1]?.replace(/["']/g, '') || versionId;
            prettyName = osRelease.match(/^PRETTY_NAME=(.*)$/m)?.[1]?.replace(/["']/g, '') || '';
        }

        // Distribution-specific checks
        if (fs.existsSync('/etc/lsb-release')) {
            const lsbContent = fs.readFileSync('/etc/lsb-release', 'utf8');
            if (/^DISTRIB_ID=Ubuntu$/m.test(lsbContent)) {
                id = 'ubuntu';
                isUbuntu = true;
                versionId = lsbContent.match(/^DISTRIB_RELEASE=(.*)$/m)?.[1] || versionId;
                const codename = lsbContent.match(/^DISTRIB_CODENAME=(.*)$/m)?.[1] || '';
                if (codename) {
                    prettyName = `Ubuntu ${versionId} (${codename})`;
                }
            }
        }

        if (fs.existsSync('/etc/debian_version') && !isUbuntu) {
            const debianVersion = fs.readFileSync('/etc/debian_version', 'utf8').trim();
            id = 'debian';
            isDebian = true;
            versionId = debianVersion;
            prettyName = `Debian ${versionId}`;
        }

        const packageManager = detectPackageManager(id);
        const systemInfo = {
            id,
            versionId,
            prettyName,
            isDebian,
            isUbuntu,
            isWindows: false,
            packageManager: packageManager ? {
                name: packageManager.name,
                type: packageManager.key,
                commands: {
                    install: packageManager.installCmd,
                    remove: packageManager.removeCmd,
                    update: packageManager.updateCmd,
                    search: packageManager.searchCmd,
                    list: packageManager.listCmd,
                    verify: packageManager.verifyCmd
                }
            } : null,
            details: {
                arch: process.arch,
                platform: process.platform
            }
        };

        // Save to cache
        writeCache(SYSTEM_INFO_CACHE_KEY, systemInfo);
        return systemInfo;
    } catch (e) {
        const fallbackInfo = {
            id: 'unknown',
            versionId: 'unknown',
            prettyName: 'Unknown System',
            isDebian: false,
            isUbuntu: false,
            isWindows: false,
            packageManager: null,
            details: {
                arch: process.arch,
                platform: process.platform
            }
        };
        return fallbackInfo;
    }
}

module.exports = {
    getSystemInfo
}; 