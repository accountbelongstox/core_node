const fs = require('fs');
const path = require('path');
const os = require('os');
const homeDir = os.homedir();
let log;

try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        debug: (...args) => logger.debug ? logger.debug(...args) : console.log('[DEBUG]', ...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args)
    };
}
let globalVarDir,localDir;

try {
    const {GLOBAL_VAR_DIR, LOCAL_DIR} = require('../gdir');
    globalVarDir = GLOBAL_VAR_DIR
    localDir = LOCAL_DIR
} catch (error) {
    localDir = os.platform() === 'win32'
        ? path.join(homeDir, '.core_node')
        : '/usr/core_node';
    globalVarDir = os.platform() === 'win32'
        ? path.join(homeDir, '.core_node/global_var')
        : path.join(localDir, 'global_var');
}
function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}
mkdir(globalVarDir);

function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}
mkdir(globalVarDir);

class ConfigTool {
    constructor(configDir) {
        this.platform = process.platform;
        this.configDir = configDir ? configDir : globalVarDir;
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
            log.info(`Created config directory: ${this.configDir}`);
        }
    }

    /**
     * Set a config value by key, or multiple configs if key is an object
     * @param {string|object} key - The config key or an object containing multiple key-value pairs
     * @param {string|number|object} [value] - The value to store (not used if key is an object)
     * @returns {boolean} - Success status
     */
    setConfig(key, value) {
        try {
            // Handle object input
            if (typeof key === 'object' && key !== null) {
                let success = true;
                for (const [k, v] of Object.entries(key)) {
                    if (!this._setSingleConfig(k, v)) {
                        success = false;
                        log.error(`Failed to set config for key: ${k}`);
                    }
                }
                return success;
            }
            
            // Handle single key-value pair
            return this._setSingleConfig(key, value);
        } catch (error) {
            log.error(`Error in setConfig:`, error);
            return false;
        }
    }

    /**
     * Convert value to appropriate type when reading from config
     * @private
     */
    _convertValue(value) {
        if (typeof value !== 'string') return value;
        value = value.trim();

        // Check for null values
        if (['null', 'NULL', 'NUL', 'undefined'].includes(value)) {
            return null;
        }

        // Check for boolean values
        if (['true', 'TRUE', 'True'].includes(value)) return true;
        if (['false', 'FALSE', 'False'].includes(value)) return false;

        // Check for number
        if (/^-?\d+(\.\d+)?$/.test(value)) {
            const num = Number(value);
            return Number.isNaN(num) ? value : num;
        }

        // Check for JSON objects/arrays
        try {
            if ((value.startsWith('{') && value.endsWith('}')) || 
                (value.startsWith('[') && value.endsWith(']'))) {
                return JSON.parse(value);
            }
        } catch (error) {
            log.debug(`Failed to parse JSON value: ${value}`);
        }

        return value;
    }

    /**
     * Convert value to string for storage
     * @private
     */
    _stringifyValue(value) {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * Internal method to set a single config value
     * @private
     */
    _setSingleConfig(key, value) {
        try {
            const upperKey = key.toUpperCase();
            const filePath = path.join(this.configDir, upperKey);
            
            // Convert value to string format for storage
            const stringValue = this._stringifyValue(value);
            
            // Write to file, overwriting if exists
            fs.writeFileSync(filePath, stringValue, 'utf8');
            log.debug(`Config set: ${upperKey} = ${stringValue}`);
            return true;
        } catch (error) {
            log.error(`Error setting config for ${key}:`, error);
            return false;
        }
    }

    /**
     * Get a config value by key
     * @param {string} key - The config key
     * @returns {any} - The config value converted to appropriate type or empty string if not found
     */
    getConfig(key) {
        try {
            const upperKey = key.toUpperCase();
            const filePath = path.join(this.configDir, upperKey);
            
            if (!fs.existsSync(filePath)) {
                log.debug(`Config not found: ${upperKey}`);
                return '';
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            const convertedValue = this._convertValue(content);
            log.debug(`Config read: ${upperKey} = ${content} (converted to ${typeof convertedValue})`);
            return convertedValue;
        } catch (error) {
            log.error(`Error getting config for ${key}:`, error);
            return '';
        }
    }

    /**
     * Get all config keys
     * @returns {string[]} - Array of config keys
     */
    getAllKeys() {
        try {
            const files = fs.readdirSync(this.configDir);
            log.debug(`Found ${files.length} config keys`);
            return files;
        } catch (error) {
            log.error('Error getting config keys:', error);
            return [];
        }
    }

    getConfigAll = () => {
        const files = fs.readdirSync(this.configDir);
        const config = {};
        for (const file of files) {
            const key = file.toUpperCase();
            config[key] = this.getConfig(key);
        }
        return config;
    }

    /**
     * Clear a config value by key
     * @param {string} key - The config key to clear
     */
    clearConfig(key) {
        try {
            const upperKey = key.toUpperCase();
            const filePath = path.join(this.configDir, upperKey);
            
            if (fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, '', 'utf8');
                log.debug(`Config cleared: ${upperKey}`);
            }
        } catch (error) {
            // Silently fail as per requirements
            log.error(`Error clearing config for ${key}:`, error);
        }
    }
}

module.exports = new ConfigTool();
