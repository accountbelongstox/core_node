const fs = require('fs');
const path = require('path');
const { config_dir, data_json_file } = require('../provider/global_var');
const logger = require('./log_utils');
let printConfig = false;

const configFile = path.join(config_dir, 'config.json');

function jsonToString(data) {
    try {
        return JSON.stringify(data);
    } catch (error) {
        console.error('Error converting to JSON string:', error);
        return String(data);
    }
}

function convertToString(data) {
    if (typeof data === 'string') {
        return data;
    }
    try {
        return String(data);
    } catch (error) {
        console.error('Error converting to string:', error);
        return '';
    }
}

function toStr(data) {
    if (data === null || data === undefined || data === 'Null' || data === 'null' || data === 0 || data === 0.0 || data === false) {
        return "";
    } else if (typeof data === 'string') {
        return data;
    } else if (data instanceof Buffer) {
        return data.toString('utf-8');
    } else {
        let stringData;
        try {
            stringData = JSON.stringify(data);
        } catch (error) {
            stringData = String(data);
        }
        return convertToString(stringData);
    }
}

function getDataJsonConfig() {
    try {
        const dataJsonContent = fs.readFileSync(data_json_file, 'utf8');
        return JSON.parse(dataJsonContent);
    } catch (error) {
        logger.logRed('Error reading data.json:', error);
        return {};
    }
}

function getConfig() {
    if (!printConfig) {
        logger.logGreen(`Config Initial:(getConfig) from ${configFile}`);
        printConfig = true;
    }
    try {
        const configContent = fs.readFileSync(configFile, 'utf8');
        return JSON.parse(configContent);
    } catch (error) {
        logger.logRed('Error reading config file:', error);
        return {};
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    } catch (error) {
        logger.logRed('Error saving config file:', error);
    }
}

function updateConfig(newConfig) {
    const currentConfig = getConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    saveConfig(updatedConfig);
}

function initializeConfig() {
    const dataJsonConfig = getDataJsonConfig();
    let currentConfig = getConfig();
    for (const [key, value] of Object.entries(dataJsonConfig)) {
        if (!(key in currentConfig)) {
            currentConfig[key] = value;
        }
    }
    const defaultConfig = {
        lastUpdateTime: null,
        recommendedAirports: [],
        routerUsername: '',
        routerPassword: '',
        routerUrl: '',
        remoteGitUrl: '',
        clashNodeNameFilter: '',
        clashNodeKeywordFilter: ''
    };
    for (const [key, value] of Object.entries(defaultConfig)) {
        if (!(key in currentConfig)) {
            currentConfig[key] = value;
        }
    }
    saveConfig(currentConfig);
}

function getConfigValue(key) {
    const config = getConfig();
    return toStr(config[key]);
}

function setConfigValue(key, value) {
    const config = getConfig();
    config[key] = value;
    saveConfig(config);
}

function deleteConfigValue(key) {
    try {
        const config = getConfig();
        if (key in config) {
            delete config[key];
            saveConfig(config);
            logger.logGreen(`Successfully deleted config value for key: ${key}`);
            return true;
        } else {
            logger.logYellow(`Key not found in config: ${key}`);
            return false;
        }
    } catch (error) {
        logger.logRed(`Error deleting config value for key ${key}:`, error);
    }
}

function getOrSetConfigValue(key, defaultValue) {
    let config = getConfig();
    const val = toStr(config[key]);
    logger.log(`getOrSetConfigValue: ${key} = ${val}`);
    if (!val) {
        config[key] = defaultValue;
        saveConfig(config);
    }
    return toStr(config[key]);
}

try {
    initializeConfig();
} catch (error) {
    logger.logRed('Failed to initialize config:', error);
}

module.exports = {
    getConfig,
    saveConfig,
    updateConfig,
    initializeConfig,
    getConfigValue,
    setConfigValue,
    deleteConfigValue,
    getOrSetConfigValue,
};
