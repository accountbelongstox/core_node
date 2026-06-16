#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { IS_WINDOWS, safeReadFile, safeExists, safeStat, safeMkdir, parseKeyValueFile } = require('./fs_tools.js');

// System detection - cached variables
let SYSTEM_NAME = '';
let SYSTEM_VERSION = '';
let IS_WSL = null;
let IS_PRODUCTION = null;
let HAS_DESKTOP_ENVIRONMENT = null;
let BASE_DATA_DIRECTORY = null;
let CORE_NODE_DIR = null;
let CORE_NODE_PROJECT_ROOT = null;
let IS_DEBIAN_BASED = null;
let IS_DEBIAN = null;
let IS_UBUNTU = null;
let IS_CENTOS = null;

/**
 * Detect system name and version from /etc/os-release
 */
function detectSystemInfo() {
    if (SYSTEM_NAME && SYSTEM_VERSION) {
        return { name: SYSTEM_NAME, version: SYSTEM_VERSION };
    }

    // Windows detection
    if (IS_WINDOWS) {
        SYSTEM_NAME = 'windows';
        SYSTEM_VERSION = os.release();
        return { name: SYSTEM_NAME, version: SYSTEM_VERSION };
    }

    // Linux detection
    try {
        if (safeExists('/etc/os-release')) {
            const kv = parseKeyValueFile('/etc/os-release');
            const osId = kv.ID || '';
            const versionId = kv.VERSION_ID || '';

            // Handle special cases
            switch (osId) {
                case 'centos':
                case 'almalinux':
                case 'rocky':
                    SYSTEM_NAME = 'centos';
                    SYSTEM_VERSION = versionId;
                    break;
                case 'ubuntu':
                    SYSTEM_NAME = 'ubuntu';
                    SYSTEM_VERSION = versionId;
                    break;
                case 'debian':
                    SYSTEM_NAME = 'debian';
                    SYSTEM_VERSION = versionId;
                    break;
                default:
                    SYSTEM_NAME = osId || 'linux';
                    SYSTEM_VERSION = versionId || '';
            }
        } else if (safeExists('/etc/redhat-release')) {
            // Older RedHat-based systems
            const content = safeReadFile('/etc/redhat-release');
            if (content) {
                const match = content.match(/release\s+(\d+)/);
                SYSTEM_NAME = 'centos';
                SYSTEM_VERSION = match ? match[1] : '';
            }
        } else if (safeExists('/etc/lsb-release')) {
            // Older Ubuntu systems
            const kv = parseKeyValueFile('/etc/lsb-release');
            SYSTEM_NAME = (kv.DISTRIB_ID || '').toLowerCase() || 'linux';
            SYSTEM_VERSION = kv.DISTRIB_RELEASE || '';
        } else {
            // Fallback to uname
            SYSTEM_NAME = os.type().toLowerCase();
            SYSTEM_VERSION = os.release();
        }
    } catch (error) {
        // Fallback
        SYSTEM_NAME = 'linux';
        SYSTEM_VERSION = '';
    }

    return { name: SYSTEM_NAME, version: SYSTEM_VERSION };
}

/**
 * Detect if running in WSL environment
 */
function detectWSL() {
    if (IS_WSL !== null) {
        return IS_WSL;
    }

    // Windows is not WSL
    if (IS_WINDOWS) {
        IS_WSL = false;
        return false;
    }

    // Check for /mnt/c/Users (Windows user directory in WSL)
    if (safeExists('/mnt/c/Users')) {
        IS_WSL = true;
        return true;
    }

    // Check /proc/version for WSL indicators
    const version = safeReadFile('/proc/version');
    if (version) {
        const versionLower = version.toLowerCase();
        if (versionLower.includes('microsoft') || versionLower.includes('wsl')) {
            IS_WSL = true;
            return true;
        }
    }

    IS_WSL = false;
    return false;
}

/**
 * Detect if has desktop environment
 */
function detectDesktopEnvironment() {
    if (HAS_DESKTOP_ENVIRONMENT !== null) {
        return HAS_DESKTOP_ENVIRONMENT;
    }
    
    // Simplified detection - in daemon context, assume no desktop
    // Desktop detection would require checking DISPLAY, WAYLAND_DISPLAY, etc.
    // but we can't use process.env, so we'll assume production/server environment
    HAS_DESKTOP_ENVIRONMENT = false;
    return false;
}

/**
 * Detect if production environment
 */
function detectProduction() {
    if (IS_PRODUCTION !== null) {
        return IS_PRODUCTION;
    }
    
    // If WSL, not production
    if (detectWSL()) {
        IS_PRODUCTION = false;
        return false;
    }

    // Check for desktop environment
    if (detectDesktopEnvironment()) {
        IS_PRODUCTION = false;
        return false;
    }

    // Not WSL and not desktop = production
    IS_PRODUCTION = true;
    return true;
}

/**
 * Get optimal base directory for data storage
 * Windows: Uses C:\www or user's Documents/www
 * Linux: Priority: WSL /mnt/d -> NTFS mount -> Data disk mount -> /www
 */
function getBaseDataDirectory() {
    if (BASE_DATA_DIRECTORY !== null) {
        return BASE_DATA_DIRECTORY;
    }
    
    // Windows detection
    if (IS_WINDOWS) {
        // Try C:\www first
        const cWww = 'C:\\www';
        if (safeExists(cWww)) {
            BASE_DATA_DIRECTORY = cWww;
            return BASE_DATA_DIRECTORY;
        }
        
        // Fallback: Use user's Documents/www
        try {
            const homedir = os.homedir();
            const docsWww = path.join(homedir, 'Documents', 'www');
            if (safeExists(docsWww)) {
                BASE_DATA_DIRECTORY = docsWww;
                return BASE_DATA_DIRECTORY;
            }
            
            // Create it if doesn't exist
            BASE_DATA_DIRECTORY = docsWww;
            return BASE_DATA_DIRECTORY;
        } catch (error) {
            // Final fallback
            BASE_DATA_DIRECTORY = cWww;
            return BASE_DATA_DIRECTORY;
        }
    }
    
    // Linux detection - Priority 1: WSL /mnt/d
    if (detectWSL()) {
        if (safeExists('/mnt/d')) {
            BASE_DATA_DIRECTORY = '/mnt/d';
            return BASE_DATA_DIRECTORY;
        }
    }

    // Linux detection - Priority 2: Check common mount points
    const commonMounts = ['/mnt/d', '/mnt/e', '/data', '/www'];
    for (const mount of commonMounts) {
        const stat = safeStat(mount);
        if (stat && stat.isDirectory()) {
            BASE_DATA_DIRECTORY = mount;
            return BASE_DATA_DIRECTORY;
        }
    }

    // Fallback: /www
    BASE_DATA_DIRECTORY = '/www';
    return BASE_DATA_DIRECTORY;
}

/**
 * Map web path (matching gvar_common.sh map_web_path logic)
 * @param {string} pathKey - Path key to map
 * @param {string} subPath - Optional sub-path to append
 * @returns {string} Mapped path
 */
function mapWebPath(pathKey, subPath) {
    // Windows: Use Windows-style paths
    if (IS_WINDOWS) {
        const dataBase = getBaseDataDirectory();
        let basePath = path.join(dataBase, 'www');
        
        switch (pathKey) {
            case 'www':
                return basePath;
            case 'wwwroot':
                return path.join(basePath, 'wwwroot');
            case 'build_dir':
                return path.join(basePath, '_build_dir');
            case 'programing':
                return path.join(basePath, 'programing');
            case 'core_node':
                return path.join(basePath, 'programing', 'core_node');
            default:
                // For other keys, return Windows-style path
                if (subPath) {
                    return path.join(basePath, pathKey, subPath);
                }
                return path.join(basePath, pathKey);
        }
    }
    
    // Linux detection
    const dataBase = getBaseDataDirectory();
    let basePath = '';

    // Determine base path for www based on environment
    if (detectWSL()) {
        basePath = `${dataBase}/www`;
    } else if (detectProduction()) {
        basePath = '/www';
    } else {
        // Desktop environment: use data base + /www, unless data base is already /www
        if (dataBase === '/www') {
            basePath = '/www';
        } else {
            basePath = `${dataBase}/www`;
        }
    }

    // Get system info
    const systemInfo = detectSystemInfo();
    const sysName = systemInfo.name;
    const sysVersion = systemInfo.version.split('.')[0]; // Get major version only

    // Map paths using common base path
    let mappedPath = '';

    switch (pathKey) {
        case 'wwwroot':
            mappedPath = `${basePath}/wwwroot`;
            break;
        case 'pycore_db':
            mappedPath = `${basePath}/wwwroot/pycore_db`;
            break;
        case 'laravel_db':
            mappedPath = `${basePath}/wwwroot/laravel_db`;
            break;
        case 'nginxconfig':
            mappedPath = `${basePath}/nginxconfig`;
            break;
        case 'shared-data':
            mappedPath = `${basePath}/shared-data`;
            break;
        case 'backup':
            mappedPath = `${basePath}/backup`;
            break;
        case 'www':
            mappedPath = basePath;
            break;
        case 'compile_dir':
            // Compile directory for development languages
            // Format: _ubuntu_24, _debian_12, _centos_8
            mappedPath = `${dataBase}/_${sysName}_${sysVersion}`;
            break;
        case 'applications_dir':
            mappedPath = `${dataBase}/_${sysName}_${sysVersion}/applications`;
            break;
        case 'nginx':
            mappedPath = '/etc/nginx';
            break;
        case 'php':
            mappedPath = '/etc/php';
            break;
        case 'logs':
            mappedPath = '/var/log';
            break;
        case 'app_manager_logs':
            // Unified App Manager log namespace ROOT (scripts/app_manager/linux_sh).
            // Kept on the native Linux fs like 'logs'. Retired predecessor:
            // 'app_manager_logs_old'. MUST stay in sync with gvar_common.sh.
            mappedPath = '/opt/_core_node/logs';
            break;
        case 'app_manager_logs_old':
            // Retired App Manager log root (formerly 'core_node_unified_manager').
            mappedPath = '/opt/core_node_unified_manager/logs';
            break;
        case 'programing':
            mappedPath = `${basePath}/programing`;
            break;
        case 'core_node':
            mappedPath = `${basePath}/programing/core_node`;
            break;
        case 'npm_global':
            mappedPath = `${dataBase}/_${sysName}_${sysVersion}/npm-global`;
            break;
        case 'dev_system':
            mappedPath = `${dataBase}/_${sysName}_${sysVersion}`;
            break;
        default:
            // Default: return the key as-is (assume it's already a path)
            mappedPath = pathKey;
            break;
    }

    // If sub_path is provided, concatenate it to the mapped path
    if (subPath) {
        // Remove leading slash from sub_path if present to avoid double slashes
        const cleanSubPath = subPath.replace(/^\//, '');
        mappedPath = path.join(mappedPath, cleanSubPath);
    }

    return mappedPath;
}

/**
 * Get core node project root directory
 */
function getCoreNodeProjectRoot() {
    if (CORE_NODE_PROJECT_ROOT !== null) {
        return CORE_NODE_PROJECT_ROOT;
    }
    
    const baseDir = getBaseDataDirectory();
    CORE_NODE_PROJECT_ROOT = path.join(baseDir, 'programing', 'core_node');
    return CORE_NODE_PROJECT_ROOT;
}

/**
 * Get core node directory based on this script's location
 * This script is at: core_node/scripts/nodetools/gvar_common.js
 * So we need to go up 2 levels: nodetools -> scripts -> core_node
 */
function getCoreNodeDir() {
    if (CORE_NODE_DIR !== null) {
        return CORE_NODE_DIR;
    }
    
    // Get directory of this script
    const scriptDir = __dirname;
    
    // Go up 2 levels to reach core_node root
    const coreNodeDir = path.resolve(scriptDir, '../..');
    
    // Verify this is actually core_node directory by checking for markers
    if (!safeExists(path.join(coreNodeDir, '.secret_keys')) && 
        !safeExists(path.join(coreNodeDir, 'package.json'))) {
        // Windows fallback paths
        if (IS_WINDOWS) {
            const windowsFallbacks = [
                'C:\\www\\programing\\core_node',
                path.join(os.homedir(), 'Documents', 'www', 'programing', 'core_node'),
                'C:\\programing\\core_node'
            ];
            
            for (const fallbackPath of windowsFallbacks) {
                if (safeExists(fallbackPath)) {
                    CORE_NODE_DIR = fallbackPath;
                    return CORE_NODE_DIR;
                }
            }
            
            // Final Windows fallback
            CORE_NODE_DIR = 'C:\\www\\programing\\core_node';
            return CORE_NODE_DIR;
        }
        
        // Linux fallback: check common paths based on environment
        const fallbackPaths = [];
        
        if (detectWSL()) {
            fallbackPaths.push('/mnt/d/programing/core_node');
        }
        fallbackPaths.push('/usr/wwwroot/core_node', '/opt/core_node');
        
        for (const fallbackPath of fallbackPaths) {
            if (safeExists(fallbackPath)) {
                CORE_NODE_DIR = fallbackPath;
                return CORE_NODE_DIR;
            }
        }
        
        // Final fallback
        CORE_NODE_DIR = '/opt/core_node';
        return CORE_NODE_DIR;
    }
    
    CORE_NODE_DIR = coreNodeDir;
    return CORE_NODE_DIR;
}

/**
 * Check if system is Debian-based (includes both Debian and Ubuntu)
 */
function isDebianBased() {
    if (IS_DEBIAN_BASED !== null) {
        return IS_DEBIAN_BASED;
    }
    
    // Windows is not Debian-based
    if (IS_WINDOWS) {
        IS_DEBIAN_BASED = false;
        return false;
    }
    
    IS_DEBIAN_BASED = safeExists('/etc/debian_version');
    return IS_DEBIAN_BASED;
}

/**
 * Check if system is Debian
 */
function isDebian() {
    if (IS_DEBIAN !== null) {
        return IS_DEBIAN;
    }
    
    // Windows is not Debian
    if (IS_WINDOWS) {
        IS_DEBIAN = false;
        return false;
    }
    
    if (!isDebianBased()) {
        IS_DEBIAN = false;
        return false;
    }
    
    IS_DEBIAN = !safeExists('/etc/lsb-release');
    return IS_DEBIAN;
}

/**
 * Check if system is Ubuntu
 */
function isUbuntu() {
    if (IS_UBUNTU !== null) {
        return IS_UBUNTU;
    }
    
    // Windows is not Ubuntu
    if (IS_WINDOWS) {
        IS_UBUNTU = false;
        return false;
    }
    
    const content = safeReadFile('/etc/lsb-release');
    if (!content) {
        IS_UBUNTU = false;
        return false;
    }
    
    IS_UBUNTU = content.toLowerCase().includes('ubuntu');
    return IS_UBUNTU;
}

/**
 * Check if system is CentOS/RHEL based
 */
function isCentos() {
    if (IS_CENTOS !== null) {
        return IS_CENTOS;
    }
    
    // Windows is not CentOS
    if (IS_WINDOWS) {
        IS_CENTOS = false;
        return false;
    }
    
    if (safeExists('/etc/centos-release') || safeExists('/etc/redhat-release')) {
        IS_CENTOS = true;
        return true;
    }
    
    const content = safeReadFile('/etc/os-release');
    if (content) {
        IS_CENTOS = /centos|rhel|rocky|almalinux/.test(content.toLowerCase());
        return IS_CENTOS;
    }
    
    IS_CENTOS = false;
    return false;
}

/**
 * Ensure web directory exists with proper permissions
 * Note: chown is not supported without execSync, so ownership changes are skipped
 * @param {string} pathKey - Path key to map
 * @param {string|number} permissions - Permissions (default: '755')
 * @param {string} owner - Owner in format 'user:group' (optional, ignored without execSync)
 * @returns {string} Actual path created
 */
function ensureWebDirectory(pathKey, permissions = '755', owner) {
    const { safeMkdir } = require('./fs_tools.js');
    
    // Map to appropriate path using string key
    const actualPath = mapWebPath(pathKey);
    
    // Create directory if it doesn't exist
    if (!safeExists(actualPath)) {
        console.error(`Creating directory: ${actualPath} (mapped from key: ${pathKey})`);
        const mode = IS_WINDOWS ? undefined : 0o755;
        if (!safeMkdir(actualPath, { recursive: true, mode })) {
            console.error(`Failed to create directory: ${actualPath}`);
            return actualPath;
        }
    }
    
    // Set permissions (Linux only)
    if (!IS_WINDOWS) {
        try {
            const permNum = typeof permissions === 'string' ? parseInt(permissions, 8) : permissions;
            fs.chmodSync(actualPath, permNum);
        } catch (error) {
            // Ignore permission errors
        }
    }
    
    // Note: chown requires execSync, so ownership changes are skipped
    // Callers should handle ownership separately if needed
    
    return actualPath;
}

/**
 * Create script-specific temporary directory
 * @param {string} scriptName - Name of the script
 * @returns {string} Path to temporary directory
 */
function createScriptTempDir(scriptName) {
    const GLOBAL_TEMP_DIR = IS_WINDOWS ? os.tmpdir() : '/usr/tmp';
    const scriptTempDir = path.join(GLOBAL_TEMP_DIR, scriptName);
    
    if (!safeExists(scriptTempDir)) {
        const mode = IS_WINDOWS ? undefined : 0o777;
        if (!safeMkdir(scriptTempDir, { recursive: true, mode })) {
            console.error(`Failed to create temp directory: ${scriptTempDir}`);
        }
    }
    
    return scriptTempDir;
}

/**
 * Clean up script-specific temporary directory
 * @param {string} scriptName - Name of the script
 */
function cleanupScriptTempDir(scriptName) {
    const GLOBAL_TEMP_DIR = IS_WINDOWS ? os.tmpdir() : '/usr/tmp';
    const scriptTempDir = path.join(GLOBAL_TEMP_DIR, scriptName);
    
    if (safeExists(scriptTempDir)) {
        try {
            fs.rmSync(scriptTempDir, { recursive: true, force: true });
        } catch (error) {
            console.error(`Failed to cleanup temp directory: ${error.message}`);
        }
    }
}

// Initialize system detection (skip Linux-specific on Windows)
detectSystemInfo();
if (!IS_WINDOWS) {
    detectWSL();
    detectProduction();
} else {
    // Windows: set defaults
    IS_WSL = false;
    IS_PRODUCTION = false;
    HAS_DESKTOP_ENVIRONMENT = true; // Windows always has desktop
}

module.exports = {
    // Platform detection
    IS_WINDOWS,
    
    // System info
    getSystemInfo: detectSystemInfo,
    getSystemName: () => SYSTEM_NAME,
    getSystemVersion: () => SYSTEM_VERSION,
    
    // Environment detection
    isWSL: detectWSL,
    isProduction: detectProduction,
    hasDesktopEnvironment: detectDesktopEnvironment,
    
    // System type checks
    isDebianBased,
    isDebian,
    isUbuntu,
    isCentos,
    
    // Path mapping
    getBaseDataDirectory,
    mapWebPath,
    getCoreNodeProjectRoot,
    getCoreNodeDir,
    
    // Directory management
    ensureWebDirectory,
    createScriptTempDir,
    cleanupScriptTempDir,
    
    // Constants (for compatibility)
    SYSTEM_NAME,
    SYSTEM_VERSION,
    IS_WSL,
    IS_PRODUCTION
};

