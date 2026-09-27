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
 * Global Configuration - Shared configuration for Ncore Module Caller
 *
 * Simple global state management for the HTTP API service.
 */

const os = require('os');
const path = require('path');
const serviceContract = require('#@/config/service_contract.js');
const localRpcGuard = require('#@foundation/common/local_rpc_guard.js');

const DEFAULT_HTTP_PORT = serviceContract.port('ncore_backend');
const DEFAULT_NCORE_ROOT = path.join(__dirname, '..');
const DEFAULT_ALLOWED_CALLS = [];
const MODULE_PATH_SEPARATOR = '/';

let _globalConfig = null;

/**
 * Global configuration class for Ncore Module Caller service.
 * Manages service settings, network info, and runtime state.
 */
class GlobalConfig {
    constructor() {
        // Core settings
        this.ncoreRoot = DEFAULT_NCORE_ROOT;
        this.httpPort = DEFAULT_HTTP_PORT;

        // Network settings
        this.host = localRpcGuard.defaultBindHost();
        this.localIp = null;

        // Runtime state
        this.serverRunning = false;

        // API access control
        this.apiEnabled = true;
        this.allowFileImport = true;
        this.debugMode = false;

        // Module call history
        this.callHistory = [];
        this.maxHistorySize = 100;

        // Security
        this.allowedCalls = DEFAULT_ALLOWED_CALLS.slice();

        // Browser options
        this.autoLaunchBrowser = true;
        this.browserType = 'edge';
    }

    /**
     * Enable API access
     */
    enableApi() {
        this.apiEnabled = true;
        console.log('[Config] API access enabled');
    }

    /**
     * Disable API access
     */
    disableApi() {
        this.apiEnabled = false;
        console.log('[Config] API access disabled');
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[Config] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
        console.log('[Config] Debug mode disabled');
    }

    /**
     * Update local network information
     */
    updateNetworkInfo() {
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    this.localIp = iface.address;
                    return;
                }
            }
        }

        this.localIp = '127.0.0.1';
    }

    /**
     * Add entry to call history
     * @param {string} moduleName - Module name
     * @param {string} functionName - Function name
     * @param {boolean} success - Whether the call was successful
     * @param {string|null} error - Error message if any
     */
    addCallHistory(moduleName, functionName, success, error = null) {
        const entry = {
            timestamp: Date.now(),
            module: moduleName,
            function: functionName,
            success: success,
            error: error
        };

        this.callHistory.push(entry);

        if (this.callHistory.length > this.maxHistorySize) {
            this.callHistory = this.callHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Normalize a module path relative to ncoreRoot; absolute or escaping paths are rejected
     * @param {string} modulePath - Module path
     * @returns {string|null}
     */
    normalizeModulePath(modulePath) {
        const normalized = path.posix.normalize(String(modulePath || '').replace(/\\/g, MODULE_PATH_SEPARATOR));

        if (!normalized || normalized === '.' || path.isAbsolute(String(modulePath || '')) || normalized.startsWith(MODULE_PATH_SEPARATOR)
            || normalized === '..' || normalized.startsWith('../') || /^[A-Za-z]:/.test(normalized)) {
            return null;
        }

        return normalized;
    }

    /**
     * Check if a module/function pair is in the explicit allow-list
     * @param {string} modulePath - Module path relative to ncoreRoot
     * @param {string} functionName - Exported function name
     * @returns {Object} { allowed: boolean, reason: string, modulePath: string|null }
     */
    isCallAllowed(modulePath, functionName) {
        const normalized = this.normalizeModulePath(modulePath);

        if (!normalized || !functionName) {
            return { allowed: false, reason: 'call_not_allowed', modulePath: null };
        }

        for (const entry of this.allowedCalls) {
            if (this.normalizeModulePath(entry.module) === normalized && entry.function === functionName) {
                return { allowed: true, reason: 'call_allowed', modulePath: normalized };
            }
        }

        return { allowed: false, reason: 'call_not_allowed', modulePath: null };
    }

    /**
     * Check if module appears in the explicit allow-list
     * @param {string} modulePath - Module path
     * @returns {Object} { allowed: boolean, reason: string }
     */
    isModuleAllowed(modulePath) {
        const normalized = this.normalizeModulePath(modulePath);
        const allowed = Boolean(normalized) && this.allowedCalls.some((entry) => this.normalizeModulePath(entry.module) === normalized);

        return { allowed, reason: allowed ? 'call_allowed' : 'call_not_allowed' };
    }

    /**
     * Get current configuration status
     * @returns {Object} Configuration status
     */
    getStatus() {
        return {
            ncoreRoot: this.ncoreRoot,
            httpPort: this.httpPort,
            host: this.host,
            localIp: this.localIp,
            serverRunning: this.serverRunning,
            apiEnabled: this.apiEnabled,
            allowFileImport: this.allowFileImport,
            debugMode: this.debugMode,
            callHistoryCount: this.callHistory.length,
            allowedCalls: this.allowedCalls,
            autoLaunchBrowser: this.autoLaunchBrowser,
            browserType: this.browserType
        };
    }

    /**
     * String representation
     * @returns {string}
     */
    toString() {
        const apiStatus = this.apiEnabled ? 'ENABLED' : 'DISABLED';
        return `<GlobalConfig port=${this.httpPort} api=${apiStatus} debug=${this.debugMode}>`;
    }
}

/**
 * Get or create global configuration singleton
 * @returns {GlobalConfig}
 */
function getGlobalConfig() {
    if (_globalConfig === null) {
        _globalConfig = new GlobalConfig();
    }
    return _globalConfig;
}

/**
 * Initialize global configuration
 * @param {Object} options - Configuration options
 * @param {string} options.ncoreRoot - Root directory of ncore
 * @param {number} options.httpPort - HTTP server port
 * @param {string} options.host - Host to bind to
 * @param {boolean} options.debug - Enable debug mode
 * @returns {GlobalConfig}
 */
function initGlobalConfig(options = {}) {
    if (_globalConfig === null) {
        _globalConfig = new GlobalConfig();
    }

    if (options.ncoreRoot) {
        _globalConfig.ncoreRoot = options.ncoreRoot;
    }

    if (options.httpPort) {
        _globalConfig.httpPort = options.httpPort;
    }

    if (options.host) {
        _globalConfig.host = options.host;
    }

    if (options.debug !== undefined) {
        _globalConfig.debugMode = options.debug;
    }

    if (options.autoLaunchBrowser !== undefined) {
        _globalConfig.autoLaunchBrowser = options.autoLaunchBrowser;
    }

    if (options.browserType) {
        _globalConfig.browserType = options.browserType;
    }

    if (Array.isArray(options.allowedCalls)) {
        _globalConfig.allowedCalls = options.allowedCalls.filter((entry) => entry && entry.module && entry.function);
    }

    _globalConfig.updateNetworkInfo();

    console.log(`[Config] Initialized: ${_globalConfig.toString()}`);
    console.log(`[Config] Ncore Root: ${_globalConfig.ncoreRoot}`);
    console.log(`[Config] Server will listen on ${_globalConfig.host}:${_globalConfig.httpPort}`);

    return _globalConfig;
}

module.exports = {
    GlobalConfig,
    getGlobalConfig,
    initGlobalConfig,
    DEFAULT_HTTP_PORT,
    DEFAULT_NCORE_ROOT
};
