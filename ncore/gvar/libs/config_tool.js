const fs = require('fs');
const path = require('path');
const os = require('os');
const homeDir = os.homedir();
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

const SCRIPT_NAME = `core_node`
const LOCAL_DIR = os.platform() === 'win32'
    ? path.join(homeDir, `.${SCRIPT_NAME}`)
    : `/usr/${SCRIPT_NAME}`;
const GLOBAL_VAR_DIR = path.join(LOCAL_DIR, 'global_var');


function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}

mkdir(GLOBAL_VAR_DIR);
mkdir(GLOBAL_VAR_DIR);

class ConfigTool {
    constructor(configDir) {
        this.platform = process.platform;
        this.configDir = configDir ? configDir : GLOBAL_VAR_DIR;
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
