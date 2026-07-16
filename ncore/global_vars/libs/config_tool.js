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

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { getSystemCacheDir } = require('../../foundation/common/system_paths');
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

    info: function (...args) {
        console.log(this.colors.cyan + '[INFO]' + this.colors.reset, ...args);
    },
    warn: function (...args) {
        console.warn(this.colors.yellow + '[WARN]' + this.colors.reset, ...args);
    },
    error: function (...args) {
        console.error(this.colors.red + '[ERROR]' + this.colors.reset, ...args);
    },
    success: function (...args) {
        console.log(this.colors.green + '[SUCCESS]' + this.colors.reset, ...args);
    },
    debug: function (...args) {
        console.log(this.colors.magenta + '[DEBUG]' + this.colors.reset, ...args);
    },
    command: function (...args) {
        console.log(this.colors.brightBlue + '[COMMAND]' + this.colors.reset, ...args);
    }
};

const SCRIPT_NAME = `core_node`
const LOCAL_DIR = os.platform() === 'win32'
    ? path.join(homeDir, `.${SCRIPT_NAME}`)
    : `/usr/${SCRIPT_NAME}`;
const GLOBAL_VAR_DIR = path.join(LOCAL_DIR, 'global_var');

// Fallback directory for when we don't have permission to write to /usr/
const FALLBACK_LOCAL_DIR = path.join(homeDir, `.${SCRIPT_NAME}`);
const FALLBACK_GLOBAL_VAR_DIR = path.join(FALLBACK_LOCAL_DIR, 'global_var');

function mkdir(dirPath) {
    if (!dirPath) return null;
    try {
        return fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            log.warn(`Permission denied creating directory: ${dirPath}`);
            return null;
        }
        throw error;
    }
}

// Try to create the primary directory, fall back to user home if permission denied
let actualGlobalVarDir = GLOBAL_VAR_DIR;
if (!mkdir(GLOBAL_VAR_DIR)) {
    log.warn(`Cannot create ${GLOBAL_VAR_DIR}, using fallback: ${FALLBACK_GLOBAL_VAR_DIR}`);
    mkdir(FALLBACK_GLOBAL_VAR_DIR);
    actualGlobalVarDir = FALLBACK_GLOBAL_VAR_DIR;
}

// Global configuration settings
const configDir = actualGlobalVarDir;
const encryptionKey = crypto.scryptSync('K8x#mP9$vL2@nQ5^wR7&jD3*fH6', 'core_node_salt', 32);
const algorithm = 'aes-256-cbc';
const ivLength = 16;
const encryptedPrefix = 'ENC:';

// Fallback configuration directory for permission issues
let fallbackConfigDir = null;
if (configDir !== FALLBACK_GLOBAL_VAR_DIR) {
    fallbackConfigDir = FALLBACK_GLOBAL_VAR_DIR;
    mkdir(fallbackConfigDir);
}

if (!fs.existsSync(configDir)) {
    try {
        fs.mkdirSync(configDir, { recursive: true });
        log.info(`Created config directory: ${configDir}`);
    } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            log.warn(`Permission denied creating config directory: ${configDir}`);
            if (fallbackConfigDir) {
                log.info(`Using fallback config directory: ${fallbackConfigDir}`);
            }
        } else {
            throw error;
        }
    }
}

function encryptValue(text) {
    try {
        if (isEncrypted(text)) {
            return text; // Already encrypted
        }
        const iv = crypto.randomBytes(ivLength);
        const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        // Combine IV and encrypted text with prefix
        return `${encryptedPrefix}${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
        log.error('Encryption failed:', error);
        return text;
    }
}

function decryptValue(text) {
    try {
        if (!isEncrypted(text)) {
            return text; // Not encrypted
        }
        // Remove prefix and split IV and encrypted text
        const encryptedData = text.substring(encryptedPrefix.length);
        const [ivHex, encryptedText] = encryptedData.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        log.error('Decryption failed:', error);
        return text;
    }
}

function isEncrypted(text) {
    return typeof text === 'string' && text.startsWith(encryptedPrefix);
}

function needsEncryption(key) {
    const patterns = [
        /_pwd$/i,
        /_password$/i,
        /_key$/i,
        /_token$/i,
        /_secret$/i
    ];
    return patterns.some(pattern => pattern.test(key));
}

function _convertValue(value) {
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

function _stringifyValue(value) {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

function _setSingleConfigFallback(key, value) {
    if (!fallbackConfigDir) {
        log.error(`No fallback config directory available for ${key}`);
        return false;
    }

    try {
        const upperKey = key.toUpperCase();
        const filePath = path.join(fallbackConfigDir, upperKey);

        // Encrypt if necessary
        if (typeof value === 'string' && needsEncryption(key)) {
            value = encryptValue(value);
        }

        // Convert value to string format for storage
        const stringValue = _stringifyValue(value);

        // Check if file exists and content is different
        let shouldLog = false;
        if (fs.existsSync(filePath)) {
            const existingContent = fs.readFileSync(filePath, 'utf8');
            const isEncryptedValue = isEncrypted(existingContent);
            shouldLog = (existingContent !== stringValue) && !isEncryptedValue;
        }

        // Write to file, overwriting if exists
        fs.writeFileSync(filePath, stringValue, 'utf8');

        // Only log if content changed
        if (shouldLog) {
            log.debug(`Config updated (fallback): ${upperKey} = ${stringValue}`);
        }

        return true;
    } catch (error) {
        log.error(`Error setting fallback config for ${key}:`, error);
        return false;
    }
}

function _setSingleConfig(key, value) {
    try {
        const upperKey = key.toUpperCase();
        const filePath = path.join(configDir, upperKey);

        // Encrypt if necessary
        if (typeof value === 'string' && needsEncryption(key)) {
            value = encryptValue(value);
        }

        // Convert value to string format for storage
        const stringValue = _stringifyValue(value);

        // Check if file exists and content is different
        let shouldLog = false;
        if (fs.existsSync(filePath)) {
            try {
                const existingContent = fs.readFileSync(filePath, 'utf8');
                const isEncryptedValue = isEncrypted(existingContent);
                shouldLog = (existingContent !== stringValue) && !isEncryptedValue;
            } catch (readError) {
                if (readError.code === 'EACCES' || readError.code === 'EPERM') {
                    log.warn(`Permission denied reading config file: ${filePath}. Using fallback storage.`);
                    return _setSingleConfigFallback(key, value);
                }
                throw readError;
            }
        }

        // Write to file, overwriting if exists
        try {
            fs.writeFileSync(filePath, stringValue, 'utf8');
        } catch (writeError) {
            if (writeError.code === 'EACCES' || writeError.code === 'EPERM') {
                log.warn(`Permission denied writing config file: ${filePath}. Using fallback storage.`);
                return _setSingleConfigFallback(key, value);
            }
            throw writeError;
        }

        // Only log if content changed
        if (shouldLog) {
            log.debug(`Config updated: ${upperKey} = ${stringValue}`);
        }

        return true;
    } catch (error) {
        log.error(`Error setting config for ${key}:`, error);
        // Try fallback as last resort
        if (fallbackConfigDir && configDir !== fallbackConfigDir) {
            log.info(`Attempting fallback config storage for ${key}`);
            return _setSingleConfigFallback(key, value);
        }
        return false;
    }
}

function setConfig(key, value) {
    try {
        // Handle object input
        if (typeof key === 'object' && key !== null) {
            let success = true;
            for (const [k, v] of Object.entries(key)) {
                if (!_setSingleConfig(k, v)) {
                    success = false;
                    log.error(`Failed to set config for key: ${k}`);
                }
            }
            return success;
        }

        // Handle single key-value pair
        return _setSingleConfig(key, value);
    } catch (error) {
        log.error(`Error in setConfig:`, error);
        return false;
    }
}

function getConfig(key) {
    try {
        const upperKey = key.toUpperCase();

        // Hardcoded default values for common configurations
        const coreNodeDir = getSystemCacheDir();
        const defaultConfigs = {
            'FILE_CACHE': path.join(coreNodeDir, 'cache', 'files'),
            'BEHAVIOR_CACHE': path.join(coreNodeDir, 'cache', 'behavior'),
            'APP_CACHE_DIR': path.join(coreNodeDir, 'cache'),
            'APP_TEMP_DIR': path.join(coreNodeDir, 'temp'),
            'APP_LOG_DIR': path.join(coreNodeDir, 'logs')
        };

        const filePath = path.join(configDir, upperKey);
        const fallbackFilePath = fallbackConfigDir ? path.join(fallbackConfigDir, upperKey) : null;

        // Try primary config file first
        let configFilePath = filePath;
        let usesFallback = false;

        if (!fs.existsSync(filePath)) {
            // Try fallback config file
            if (fallbackFilePath && fs.existsSync(fallbackFilePath)) {
                configFilePath = fallbackFilePath;
                usesFallback = true;
            } else {
                // Return hardcoded default if available
                if (defaultConfigs[upperKey]) {
                    log.debug(`Config not found: ${upperKey}, using default: ${defaultConfigs[upperKey]}`);
                    return defaultConfigs[upperKey];
                }
                log.debug(`Config not found: ${upperKey}`);
                return '';
            }
        }

        // Check if it's a directory instead of a file
        let stats;
        try {
            stats = fs.statSync(configFilePath);
        } catch (statError) {
            if (statError.code === 'EACCES' || statError.code === 'EPERM') {
                // Try fallback if permission denied on primary
                if (!usesFallback && fallbackFilePath && fs.existsSync(fallbackFilePath)) {
                    configFilePath = fallbackFilePath;
                    usesFallback = true;
                    stats = fs.statSync(configFilePath);
                } else {
                    log.warn(`Permission denied accessing config file: ${configFilePath}`);
                    return defaultConfigs[upperKey] || '';
                }
            } else {
                throw statError;
            }
        }

        if (stats.isDirectory()) {
            log.debug(`Config ${upperKey} is a directory, returning empty string`);
            return '';
        }

        let content;
        try {
            content = fs.readFileSync(configFilePath, 'utf8');
        } catch (readError) {
            if (readError.code === 'EACCES' || readError.code === 'EPERM') {
                // Try fallback if permission denied on primary
                if (!usesFallback && fallbackFilePath && fs.existsSync(fallbackFilePath)) {
                    content = fs.readFileSync(fallbackFilePath, 'utf8');
                    usesFallback = true;
                } else {
                    log.warn(`Permission denied reading config file: ${configFilePath}`);
                    return defaultConfigs[upperKey] || '';
                }
            } else {
                throw readError;
            }
        }

        if (usesFallback) {
            log.debug(`Config ${upperKey} read from fallback location`);
        }

        const convertedValue = _convertValue(content);

        // Decrypt if necessary
        if (typeof convertedValue === 'string' && needsEncryption(key)) {
            return decryptValue(convertedValue);
        }

        return convertedValue;
    } catch (error) {
        log.error(`Error getting config for ${key}:`, error);
        return '';
    }
}

function getAllKeys() {
    try {
        const files = fs.readdirSync(configDir);
        log.debug(`Found ${files.length} config keys`);
        return files;
    } catch (error) {
        log.error('Error getting config keys:', error);
        return [];
    }
}

function getConfigAll() {
    const files = fs.readdirSync(configDir);
    const config = {};
    for (const file of files) {
        const key = file.toUpperCase();
        config[key] = getConfig(key);
    }
    return config;
}

function clearConfig(key) {
    try {
        const upperKey = key.toUpperCase();
        const filePath = path.join(configDir, upperKey);

        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '', 'utf8');
            log.debug(`Config cleared: ${upperKey}`);
        }
    } catch (error) {
        // Silently fail as per requirements
        log.error(`Error clearing config for ${key}:`, error);
    }
}

function clearAllConfig() {
    const files = fs.readdirSync(configDir);
    for (const file of files) {
        clearConfig(file);
    }
}

function importConfigFromJs(filePath, setConfigFlag = false, printInfo = true) {
    try {
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            log.error(`Config file not found: ${absolutePath}`);
            return false;
        }

        // Read file content for later replacement
        let content = fs.readFileSync(absolutePath, 'utf8');

        delete require.cache[absolutePath];
        const importedConfig = require(absolutePath);

        if (typeof importedConfig !== 'object' || importedConfig === null) {
            log.error(`Invalid config format in ${filePath}. Expected an object.`);
            return false;
        }

        // Process values that need encryption
        let hasChanges = false;
        for (const [key, value] of Object.entries(importedConfig)) {
            if (typeof value === 'string' && needsEncryption(key)) {
                if (!isEncrypted(value)) {
                    const encryptedValue = encryptValue(value);
                    content = content.replace(value, encryptedValue);
                    hasChanges = true;
                } else {
                    const decryptedValue = decryptValue(value);
                    importedConfig[key] = decryptedValue;
                }
            }
        }


        // Update file if there are encrypted values
        if (hasChanges) {
            fs.writeFileSync(absolutePath, content, 'utf8');
            log.success('Updated config file with encrypted values');
        }

        // Set all config values
        if (printInfo) {
            log.debug(`Importing config from ${filePath}`);
        }
        if (setConfigFlag) {
            const success = setConfig(importedConfig);
            if (success) {
                if (printInfo)log.debug(`Successfully imported config from ${filePath}`);
            } else {
                log.error(`Failed to import some config values from ${filePath}`);
            }
            return success;
        }
        return importedConfig;

    } catch (error) {
        log.error(`Error importing config from ${filePath}:`, error);
        return setConfigFlag ? false : {};
    }
}

function getConfigDir() {
    return configDir;
}

module.exports = {
    encryptValue,
    decryptValue,
    isEncrypted,
    needsEncryption,
    setConfig,
    getConfig,
    getAllKeys,
    getConfigAll,
    clearAllConfig,
    getConfigDir,
    clearConfig,
    importConfigFromJs
};
