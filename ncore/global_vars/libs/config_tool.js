const fs = require('fs');
const path = require('path');
const systemPaths = require('../../foundation/common/system_paths');
const secretManager = require('../../foundation/common/secret_manager');
const log = require('#@logger');

const LOCAL_DIR = systemPaths.getSystemCacheDir();
const GLOBAL_VAR_DIR = path.join(LOCAL_DIR, systemPaths.GLOBAL_VAR_DIR_NAME);
const LEGACY_GLOBAL_VAR_DIRS = systemPaths.getGlobalVarDirs().slice(1);

function mkdir(dirPath) {
    if (!dirPath) return null;
    try {
        return fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
        log.warn(`Cannot create directory ${dirPath}: ${error.code || error.message}`);
        return null;
    }
}

// Global configuration settings
const configDir = GLOBAL_VAR_DIR;
const encryptedPrefix = 'ENC:';
const secretReferencePrefix = 'SECRET:';
const secretMissingHint = 'run dd.sh (Linux) or dd.cmd (Windows) to decrypt the shared secret store';
const secretConfig = new Map();

const fallbackConfigDir = LEGACY_GLOBAL_VAR_DIRS.find((directory) => (
    fs.existsSync(directory) && fs.statSync(directory).isDirectory()
)) || null;

if (!fs.existsSync(configDir)) {
    try {
        fs.mkdirSync(configDir, { recursive: true });
        log.info(`Created config directory: ${configDir}`);
    } catch (error) {
        log.warn(`Cannot create config directory ${configDir}: ${error.code || error.message}`);
        if (fallbackConfigDir) {
            log.info(`Using fallback config directory: ${fallbackConfigDir}`);
        }
    }
}

function decryptValue(text) {
    if (!isEncrypted(text)) {
        return text;
    }
    log.error(`Legacy ${encryptedPrefix} value ignored; store the secret in the shared secret store and reference it as ${secretReferencePrefix}<NAME>`);
    return null;
}

function isSecretReference(value) {
    return typeof value === 'string' && value.startsWith(secretReferencePrefix);
}

function resolveSecretReference(key, value) {
    const name = value.substring(secretReferencePrefix.length).trim();
    const secret = secretManager.readRawSecret(name);

    if (!secret) {
        log.error(`Config ${key}: secret ${name} missing; ${secretMissingHint}`);
    }
    return secret;
}

function resolveConfigValue(key, value) {
    if (isSecretReference(value)) {
        return resolveSecretReference(key, value);
    }
    return decryptValue(value);
}

function isSecretEntry(key, value) {
    return needsEncryption(key) || isSecretReference(value) || isEncrypted(value);
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
    log.error(`Canonical global variable directory is not writable for ${key}: ${configDir}`);
    return false;
}

function _setSingleConfig(key, value) {
    try {
        const upperKey = key.toUpperCase();
        const filePath = path.join(configDir, systemPaths.getGlobalVarWriteName(upperKey));

        // Secrets stay in process memory; the shared global_var directory never stores them
        if (isSecretEntry(key, value)) {
            secretConfig.set(upperKey, resolveConfigValue(key, value));
            return true;
        }

        // Convert value to string format for storage
        const stringValue = _stringifyValue(value);

        // Check if file exists and content is different
        let shouldLog = false;
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            log.error(`Config key collides with a directory: ${upperKey}`);
            return false;
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            try {
                const existingContent = fs.readFileSync(filePath, 'utf8');
                shouldLog = existingContent !== stringValue;
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
        if (secretConfig.has(upperKey)) {
            return secretConfig.get(upperKey);
        }
        const candidateNames = systemPaths.getGlobalVarReadNames(upperKey);

        // Hardcoded default values for common configurations
        const coreNodeDir = systemPaths.getSystemCacheDir();
        const defaultConfigs = {
            'FILE_CACHE': path.join(coreNodeDir, 'cache', 'files'),
            'BEHAVIOR_CACHE': path.join(coreNodeDir, 'cache', 'behavior'),
            'APP_CACHE_DIR': path.join(coreNodeDir, 'cache'),
            'APP_TEMP_DIR': path.join(coreNodeDir, 'temp'),
            'APP_LOG_DIR': path.join(coreNodeDir, 'logs')
        };

        const primaryName = candidateNames.find((name) => {
            const candidate = path.join(configDir, name);
            return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
        });
        const fallbackName = fallbackConfigDir
            ? candidateNames.find((name) => {
                const candidate = path.join(fallbackConfigDir, name);
                return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
            })
            : null;
        const filePath = primaryName ? path.join(configDir, primaryName) : path.join(configDir, candidateNames[0]);
        const fallbackFilePath = fallbackName ? path.join(fallbackConfigDir, fallbackName) : null;

        // Try primary config file first
        let configFilePath = filePath;
        let usesFallback = false;

        if (!primaryName) {
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
        const files = fs.readdirSync(configDir, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => systemPaths.getGlobalVarLogicalName(entry.name))
            .filter(Boolean);
        log.debug(`Found ${files.length} config keys`);
        return [...new Set([...files, ...secretConfig.keys()])];
    } catch (error) {
        log.error('Error getting config keys:', error);
        return [];
    }
}

function getConfigAll() {
    const files = getAllKeys();
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
        const filePath = path.join(configDir, systemPaths.getGlobalVarWriteName(upperKey));

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            fs.writeFileSync(filePath, '', 'utf8');
            log.debug(`Config cleared: ${upperKey}`);
        }
    } catch (error) {
        // Silently fail as per requirements
        log.error(`Error clearing config for ${key}:`, error);
    }
}

function clearAllConfig() {
    const files = getAllKeys();
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

        delete require.cache[absolutePath];
        const importedConfig = require(absolutePath);

        if (typeof importedConfig !== 'object' || importedConfig === null) {
            log.error(`Invalid config format in ${filePath}. Expected an object.`);
            return false;
        }

        // Resolve SECRET:<NAME> references from the shared secret store; tracked files are never rewritten
        const secretKeys = new Set();
        const persistedConfig = {};
        for (const [key, value] of Object.entries(importedConfig)) {
            if (isSecretEntry(key, value)) {
                secretKeys.add(key);
                importedConfig[key] = resolveConfigValue(key, value);
            } else {
                persistedConfig[key] = value;
            }
        }

        // Set all config values
        if (printInfo) {
            log.debug(`Importing config from ${filePath}`);
        }
        if (setConfigFlag) {
            secretKeys.forEach((key) => secretConfig.set(key.toUpperCase(), importedConfig[key]));
            const success = setConfig(persistedConfig);
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
    decryptValue,
    isSecretReference,
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
