const crypto = require('crypto');
const logger = require('./log_utils');
const { getConfigValue } = require('./config_utils');

function cleanString(inputStr) {
    let cleanedString = inputStr.replace(/\s+/g, '');
    const invalidCharsRegex = /[\uFFFD\uFFF9-\uFFFF''"""']/g;
    cleanedString = cleanedString.replace(invalidCharsRegex, '');
    return cleanedString;
}

async function cleanProxyItem(inputStr,common_names) {
    let cleanedString = inputStr.replace(/\s+/g, '');
    const invalidCharsRegex = /[\uFFFD\uFFF9-\uFFFF''""]/g;
    cleanedString = cleanedString.replace(invalidCharsRegex, '');

    const clashNodeNameFilter =  getConfigValue("clashNodeNameFilter");
    if (clashNodeNameFilter) {
        const filterChars = clashNodeNameFilter.split('');
        const filterRegex = new RegExp(filterChars.map(char => escapeRegExp(char)).join('|'), 'g');
        cleanedString = cleanedString.replace(filterRegex, '');
    }
    if(common_names.includes(cleanedString)){
        cleanedString = `${cleanedString}_${common_names.length+1}`;
    }
    return `"${cleanedString}"`;
}

async function nCleanProxyItem(inputStr, proxySet) {
    let cleanedString = inputStr;
    const invalidCharsRegex = /[\uFFFD\uFFF9-\uFFFF''""]/g;
    cleanedString = cleanedString.replace(invalidCharsRegex, '');

    // const clashNodeNameFilter = await getConfigValue("clashNodeNameFilter");
    // if (clashNodeNameFilter) {
    //     const filterChars = clashNodeNameFilter.split('');
    //     const filterRegex = new RegExp(filterChars.map(char => escapeRegExp(char)).join('|'), 'g');
    //     cleanedString = cleanedString.replace(filterRegex, '');
    // }
    const proxySets = Object.values(proxySet);
    for (const proxy of proxySets) {
        if(proxy.purename === cleanedString){
            cleanedString = `${cleanedString}Renamed${proxySets.length + 1}`;
            break
        }
    }
    // if (/\s|\[|\]/.test(cleanedString)) {
    const purename = cleanedString;
    if (/\||\[|\]/.test(cleanedString)) {
        cleanedString = `"${cleanedString}"`;
    }
    return {updataName:cleanedString,purename:cleanedString};
}


function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFlagWithCountry(s) {
    function flagToCountryCode(flag) {
        return Array.from(flag).map(char => String.fromCharCode(char.codePointAt(0) - 127397)).join('');
    }

    return s.replace(/\p{Regional_Indicator}{2}/gu, match => flagToCountryCode(match));
}

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

function generateMd5(text) {
    return md5(text);
}

function camelToSnakeCase(string) {
    return string.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamelCase(string) {
    return string.replace(/([-_][a-z])/g, group =>
        group.toUpperCase()
            .replace('-', '')
            .replace('_', '')
    );
}

function truncate(string, length) {
    if (string.length <= length) {
        return string;
    }
    return string.slice(0, length - 3) + '...';
}

function isValidUrl(urlString) {
    try {
        new URL(urlString);
        return true;
    } catch (error) {
        return false;
    }
}

function generateUniqueId() {
    return crypto.randomUUID();
}

function extractDomainAsFilename(urlString) {
    if (!/^https?:\/\//i.test(urlString)) {
        console.error(`Invalid URL: ${urlString}`);
        return generateMd5(urlString);
    }
    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname;
    return hostname.replace(/\./g, '_');
}

function getCurrentTimestamp() {
    return new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
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

module.exports = {
    cleanString,
    cleanProxyItem,
    replaceFlagWithCountry,
    generateRandomString,
    md5,
    generateMd5,
    camelToSnakeCase,
    snakeToCamelCase,
    truncate,
    isValidUrl,
    generateUniqueId,
    extractDomainAsFilename,
    getCurrentTimestamp,
    toStr,
    jsonToString,
    convertToString,
    nCleanProxyItem
};
