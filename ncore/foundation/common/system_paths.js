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

/**
 * System Paths Module
 *
 * Defines system-wide cache and data directories for core_node applications.
 * Platform-specific runtime data roots:
 *   Windows: D:\www\core_node
 *   Linux:   /www/www/core_node on the shared NTFS disk, else /www/core_node
 *
 * Directory Structure:
 *   .core_node/
 *       ├── cache/              # Application cache files
 *       ├── config/             # Configuration files
 *       ├── data/               # Persistent data
 *       ├── logs/               # Log files
 *       ├── browser/            # Browser session data (cookies, localStorage)
 *       └── ui_state/           # UI state cache
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

let _systemCacheDir = null;
let _xdgCacheHome = null;
const NTFS_FILE_SYSTEMS = new Set(['ntfs', 'ntfs3', 'fuseblk', 'ntfs-3g']);
const WINDOWS_DATA_DRIVE_ROOT = 'D:\\';
const WWW_DIR_NAME = 'www';
const CORE_NODE_DATA_DIR_NAME = 'core_node';
const CACHE_DIR_NAME = 'cache';
const GLOBAL_VAR_DIR_NAME = 'global_var';
const LEGACY_USER_DATA_DIR_NAME = '.core_node';
const LEGACY_LINUX_DATA_DIR = '/var/_core_node';
const WINDOWS_WWW_BASE = path.join(WINDOWS_DATA_DRIVE_ROOT, WWW_DIR_NAME);
const WINDOWS_CORE_NODE_DATA_DIR = path.join(WINDOWS_WWW_BASE, CORE_NODE_DATA_DIR_NAME);
const WINDOWS_SHARED_CACHE_DIR = path.join(WINDOWS_WWW_BASE, CACHE_DIR_NAME);
const SHARED_GLOBAL_VAR_KEYS = new Set([
    'POSTGRES_PASSWORD',
    'MERCURE_PUBLISHER_JWT',
    'MERCURE_SUBSCRIBER_JWT',
    'DNSPOD_API_TOKEN',
    'DNSPOD_EMAIL',
    'TAILSCALE_DOMAIN_1',
    'DOMAIN_API_REGION_PREFIX',
    'DOMAIN_UI_BINDING',
    'START_WEB_SERVER',
    'WEB_SERVER_PLANE',
    'PHP_RUNTIME_PLANE',
    'SELECTED_REGION',
    'GIT_PUSH_BRANCH',
    'GIT_UPDATE_TYPE'
]);

function getMountInfo(target) {
    if (process.platform !== 'linux' || !fs.existsSync('/proc/mounts')) {
        return null;
    }
    try {
        const lines = fs.readFileSync('/proc/mounts', 'utf8').split('\n');
        let best = null;
        for (const line of lines) {
            const parts = line.split(' ');
            if (parts.length < 3) {
                continue;
            }
            const mountPoint = parts[1].replace(/\\040/g, ' ');
            if (target === mountPoint || target.startsWith(mountPoint.replace(/\/$/, '') + '/')) {
                if (!best || mountPoint.length > best.mountPoint.length) {
                    best = { mountPoint, source: parts[0], fileSystem: parts[2] };
                }
            }
        }
        return best;
    } catch (error) {
        return null;
    }
}

function wwwDataRootMounted() {
    const wwwMount = getMountInfo('/www');
    const rootMount = getMountInfo('/');
    return Boolean(
        wwwMount &&
        rootMount &&
        wwwMount.source !== rootMount.source &&
        NTFS_FILE_SYSTEMS.has(wwwMount.fileSystem) &&
        fs.existsSync('/www/www')
    );
}

function getLinuxWwwBase() {
    return wwwDataRootMounted() ? '/www/www' : '/www';
}

function getLegacySystemCacheDirs() {
    const directories = [path.join(os.homedir(), LEGACY_USER_DATA_DIR_NAME)];
    if (process.platform === 'linux') {
        directories.unshift(LEGACY_LINUX_DATA_DIR);
    }
    return directories;
}

function normalizeGlobalVarKey(key) {
    return String(key || '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

function getOsVarTag() {
    if (process.platform === 'win32') {
        const build = Number(os.release().split('.')[2] || 0);
        return build >= 22000 ? 'WIN11' : 'WIN10';
    }
    if (process.platform === 'linux') {
        try {
            const values = {};
            const lines = fs.readFileSync('/etc/os-release', 'utf8').split('\n');
            for (const line of lines) {
                const separator = line.indexOf('=');
                if (separator > 0) {
                    values[line.slice(0, separator)] = line.slice(separator + 1).replace(/^"|"$/g, '');
                }
            }
            const distribution = String(values.ID || 'LINUX').toUpperCase();
            const majorVersion = String(values.VERSION_ID || '0').split('.')[0];
            return `${distribution}_${majorVersion}`;
        } catch (error) {
            return 'LINUX_0';
        }
    }
    return process.platform.toUpperCase();
}

function getGlobalVarWriteName(key) {
    const normalized = normalizeGlobalVarKey(key);
    return SHARED_GLOBAL_VAR_KEYS.has(normalized)
        ? normalized
        : `${getOsVarTag()}_${normalized}`;
}

function getGlobalVarReadNames(key) {
    const normalized = normalizeGlobalVarKey(key);
    return SHARED_GLOBAL_VAR_KEYS.has(normalized)
        ? [normalized]
        : [`${getOsVarTag()}_${normalized}`, normalized];
}

function getGlobalVarLogicalName(fileName) {
    const normalized = normalizeGlobalVarKey(fileName);
    const currentPrefix = `${getOsVarTag()}_`;
    const taggedMatch = normalized.match(/^(WIN10|WIN11|[A-Z]+_[0-9]+)_(.+)$/);
    if (normalized.startsWith(currentPrefix)) {
        return normalized.slice(currentPrefix.length);
    }
    if (taggedMatch) {
        return null;
    }
    return normalized;
}

function getGlobalVarDirs() {
    const canonicalDir = path.join(getSystemCacheDir(), GLOBAL_VAR_DIR_NAME);
    const directories = [canonicalDir];
    for (const baseDir of getLegacySystemCacheDirs()) {
        directories.push(path.join(baseDir, GLOBAL_VAR_DIR_NAME));
        directories.push(path.join(baseDir, '.global_vars'));
    }
    return [...new Set(directories)];
}

/**
 * User-level XDG cache root (~/.cache on Linux, D:\www\cache on Windows).
 * @returns {string}
 */
function getXdgCacheHome() {
    if (_xdgCacheHome) {
        return _xdgCacheHome;
    }

    let cacheHome = process.env.XDG_CACHE_HOME;
    if (!cacheHome) {
        if (process.platform === 'win32') {
            cacheHome = WINDOWS_SHARED_CACHE_DIR;
        } else if (process.env.CORE_NODE_CACHE_DIR) {
            cacheHome = path.join(process.env.CORE_NODE_CACHE_DIR, 'xdg');
        } else if (wwwDataRootMounted()) {
            cacheHome = path.join(getLinuxWwwBase(), 'cache', 'xdg');
        } else {
            cacheHome = path.join(os.homedir(), '.cache');
        }
    }

    if (!fs.existsSync(cacheHome)) {
        fs.mkdirSync(cacheHome, { recursive: true });
    }

    _xdgCacheHome = cacheHome;
    return cacheHome;
}

function getSharedDownloadCacheDir() {
    const configuredDir = (process.env.CORE_NODE_CACHE_DIR || '').trim();
    const preferredDir = process.platform === 'win32'
        ? WINDOWS_SHARED_CACHE_DIR
        : wwwDataRootMounted()
            ? path.join(getLinuxWwwBase(), CACHE_DIR_NAME)
            : path.join(LEGACY_LINUX_DATA_DIR, CACHE_DIR_NAME);
    const candidates = configuredDir
        ? [configuredDir]
        : [preferredDir, path.join(os.homedir(), CORE_NODE_DATA_DIR_NAME, CACHE_DIR_NAME)];
    let cacheDir = preferredDir;
    for (const candidate of candidates) {
        try {
            fs.mkdirSync(candidate, { recursive: true });
            fs.accessSync(candidate, fs.constants.W_OK);
            cacheDir = candidate;
            break;
        } catch (error) {
            continue;
        }
    }
    return cacheDir;
}

/**
 * Check if running in WSL
 * @returns {boolean}
 */
function isWsl() {
    if (process.platform !== 'linux') {
        return false;
    }

    if (fs.existsSync('/mnt/c/Windows')) {
        return true;
    }

    if (fs.existsSync('/proc/version')) {
        const versionInfo = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
        if (versionInfo.includes('microsoft') || versionInfo.includes('wsl')) {
            return true;
        }
    }

    return false;
}

/**
 * Check if running on desktop Linux
 * @returns {boolean}
 */
function isDesktopLinux() {
    if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
        return true;
    }

    if (process.env.DESKTOP_SESSION || process.env.XDG_SESSION_TYPE) {
        return true;
    }

    return false;
}

/**
 * Get system cache directory
 * @returns {string}
 */
function getSystemCacheDir() {
    if (_systemCacheDir) {
        return _systemCacheDir;
    }

    const configuredDir = (process.env.CORE_NODE_DATA_DIR || '').trim();
    const preferredDir = process.platform === 'win32'
        ? WINDOWS_CORE_NODE_DATA_DIR
        : path.join(getLinuxWwwBase(), CORE_NODE_DATA_DIR_NAME);
    const candidates = configuredDir
        ? [configuredDir]
        : process.platform === 'win32'
            ? [preferredDir]
            : [preferredDir, LEGACY_LINUX_DATA_DIR, path.join(os.homedir(), CORE_NODE_DATA_DIR_NAME)];

    for (const candidate of candidates) {
        try {
            fs.mkdirSync(candidate, { recursive: true });
            fs.accessSync(candidate, fs.constants.W_OK);
            _systemCacheDir = candidate;
            return _systemCacheDir;
        } catch (error) {
            continue;
        }
    }
    _systemCacheDir = preferredDir;
    return _systemCacheDir;
}

/**
 * Get UI state cache directory
 * @returns {string}
 */
function getUiStateCacheDir() {
    const dir = path.join(getSystemCacheDir(), 'ui_state');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/**
 * Get application cache directory
 * @returns {string}
 */
function getAppCacheDir() {
    const dir = path.join(getSystemCacheDir(), 'cache');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/**
 * Get application config directory
 * @returns {string}
 */
function getAppConfigDir() {
    const dir = path.join(getSystemCacheDir(), 'config');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/**
 * Get application data directory
 * @returns {string}
 */
function getAppDataDir() {
    const dir = path.join(getSystemCacheDir(), 'data');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/**
 * Get application logs directory
 * @returns {string}
 */
function getAppLogsDir() {
    const dir = path.join(getSystemCacheDir(), 'logs');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/**
 * Get browser session directory
 * @param {string} profileName - Profile name for browser session
 * @returns {string}
 */
function getBrowserSessionDir(profileName = 'default') {
    const dir = path.join(getSystemCacheDir(), 'browser', profileName);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/**
 * Get browser user data directory (for Puppeteer)
 * @param {string} profileName - Profile name
 * @returns {string}
 */
function getBrowserUserDataDir(profileName = 'default') {
    const dir = path.join(getBrowserSessionDir(profileName), 'user_data');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/**
 * Get browser cookies file path
 * @param {string} profileName - Profile name
 * @returns {string}
 */
function getBrowserCookiesPath(profileName = 'default') {
    return path.join(getBrowserSessionDir(profileName), 'cookies.json');
}

/**
 * Get browser localStorage file path
 * @param {string} profileName - Profile name
 * @returns {string}
 */
function getBrowserLocalStoragePath(profileName = 'default') {
    return path.join(getBrowserSessionDir(profileName), 'localStorage.json');
}

/**
 * Get browser session state file path
 * @param {string} profileName - Profile name
 * @returns {string}
 */
function getBrowserSessionStatePath(profileName = 'default') {
    return path.join(getBrowserSessionDir(profileName), 'session_state.json');
}

// Constants
const SYSTEM_CACHE_DIR = getSystemCacheDir();
const UI_STATE_CACHE_DIR = getUiStateCacheDir();
const APP_CACHE_DIR = getAppCacheDir();
const APP_CONFIG_DIR = getAppConfigDir();
const APP_DATA_DIR = getAppDataDir();
const APP_LOGS_DIR = getAppLogsDir();

module.exports = {
    WINDOWS_DATA_DRIVE_ROOT,
    WWW_DIR_NAME,
    CORE_NODE_DATA_DIR_NAME,
    CACHE_DIR_NAME,
    GLOBAL_VAR_DIR_NAME,
    LEGACY_USER_DATA_DIR_NAME,
    LEGACY_LINUX_DATA_DIR,
    WINDOWS_WWW_BASE,
    WINDOWS_CORE_NODE_DATA_DIR,
    WINDOWS_SHARED_CACHE_DIR,
    SHARED_GLOBAL_VAR_KEYS,
    isWsl,
    isDesktopLinux,
    wwwDataRootMounted,
    getLinuxWwwBase,
    getLegacySystemCacheDirs,
    normalizeGlobalVarKey,
    getOsVarTag,
    getGlobalVarWriteName,
    getGlobalVarReadNames,
    getGlobalVarLogicalName,
    getGlobalVarDirs,
    getXdgCacheHome,
    getSharedDownloadCacheDir,
    getSystemCacheDir,
    getUiStateCacheDir,
    getAppCacheDir,
    getAppConfigDir,
    getAppDataDir,
    getAppLogsDir,
    getBrowserSessionDir,
    getBrowserUserDataDir,
    getBrowserCookiesPath,
    getBrowserLocalStoragePath,
    getBrowserSessionStatePath,
    SYSTEM_CACHE_DIR,
    UI_STATE_CACHE_DIR,
    APP_CACHE_DIR,
    APP_CONFIG_DIR,
    APP_DATA_DIR,
    APP_LOGS_DIR
};
