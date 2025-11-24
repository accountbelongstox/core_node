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
 * Platform-specific paths:
 *   Windows: C:\Users\{username}\.core_node
 *   Linux:   /var/_core_node
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

    let cacheDir;

    if (process.platform === 'win32') {
        cacheDir = path.join(os.homedir(), '.core_node');
    } else {
        cacheDir = '/var/_core_node';

        try {
            fs.accessSync('/var', fs.constants.W_OK);
        } catch (error) {
            cacheDir = path.join(os.homedir(), '.core_node');
        }
    }

    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    _systemCacheDir = cacheDir;
    return cacheDir;
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
    isWsl,
    isDesktopLinux,
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
