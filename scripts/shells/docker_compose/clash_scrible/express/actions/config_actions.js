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

const { getConfig, setConfigValue, deleteConfigValue } = require('../../utils/config_utils');
const { standardResponse } = require('../../utils/html_utils');

const MASKED_PASSWORD = '********';

function isPasswordKey(key) {
    const lowerKey = key.toLowerCase();
    return lowerKey.includes('pwd') || lowerKey.includes('password');
}

function escapeSpecialChars(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unescapeSpecialChars(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.replace(/\\(.)/g, '$1');
}

async function getConfigAction() {
    try {
        const config = await getConfig();
        const maskedConfig = { ...config };
        
        for (const key in maskedConfig) {
            if (isPasswordKey(key)) {
                maskedConfig[key] = maskedConfig[key] ? MASKED_PASSWORD : ``;
            }
        }
        
        return standardResponse(true, "Config retrieved successfully", maskedConfig);
    } catch (error) {
        return standardResponse(false, "Failed to retrieve config", null, 500);
    }
}

async function setConfigAction(key, value) {
    try {
        if (isPasswordKey(key) && (value === MASKED_PASSWORD || !value)) {
            return standardResponse(true, `Config value for ${key} not changed`);
        }

        if (typeof value === 'string' && value.includes(',')) {
            value = value.split(',').filter(item => item !== '').map(unescapeSpecialChars);
        } else {
            value = unescapeSpecialChars(value);
        }
        await setConfigValue(key, value);
        return standardResponse(true, `Config value for ${key} set successfully`);
    } catch (error) {
        return standardResponse(false, `Failed to set config value for ${key}`, null, 500);
    }
}

async function deleteConfigAction(key) {
    try {
        deleteConfigValue(key);
        return standardResponse(true, `Config value for ${key} deleted successfully`);
    } catch (error) {
        return standardResponse(false, `Failed to delete config value for ${key}`, null, 500);
    }
}

module.exports = {
    getConfigAction,
    setConfigAction,
    deleteConfigAction
};