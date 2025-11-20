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
 * HTTP Headers utility functions
 * Provides tools for generating and managing HTTP headers
 */
const os = require('os');
const { version } = require('process');
const path = require('path');
const fs = require('fs');



/**
 * Common User-Agent types
 */
const USER_AGENT_TYPES = {
    BROWSER: 'browser',
    BOT: 'bot',
    MOBILE: 'mobile',
    CUSTOM: 'custom',
    APP: 'app'
};

/**
 * Browser version ranges for generating realistic User-Agents
 */
const BROWSER_VERSIONS = {
    chrome: { min: 90, max: 121 },
    firefox: { min: 90, max: 115 },
    safari: { min: 14, max: 17 },
    edge: { min: 90, max: 121 }
};

/**
 * Operating system versions for User-Agent
 */
const OS_VERSIONS = {
    windows: ['10.0', '11.0'],
    macos: ['10_15', '11_0', '12_0', '13_0', '14_0'],
    android: ['11', '12', '13', '14'],
    ios: ['14_0', '15_0', '16_0', '17_0']
};

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Random integer
 * @private
 */
function _randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random item from an array
 * @param {Array} array - Array to pick from
 * @returns {*} - Random item from the array
 * @private
 */
function _randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a User-Agent string
 * @param {Object} options - Options for User-Agent generation
 * @param {string} [options.type='browser'] - Type of User-Agent (browser, bot, mobile, custom, app)
 * @param {string} [options.browser='chrome'] - Browser name (chrome, firefox, safari, edge)
 * @param {string} [options.os] - Operating system (windows, macos, linux, android, ios)
 * @param {string} [options.osVersion] - OS version (if not provided, a random one will be chosen)
 * @param {string} [options.appName] - Application name (for APP type)
 * @param {string} [options.appVersion] - Application version (for APP type)
 * @param {string} [options.custom] - Custom User-Agent string (for CUSTOM type)
 * @returns {string} - Generated User-Agent string
 */
function generateUserAgent(options = {}) {
    const {
        type = USER_AGENT_TYPES.BROWSER,
        browser = 'chrome',
        os: requestedOs,
        osVersion: requestedOsVersion,
        custom
    } = options;

    // For custom type, just return the provided string
    if (type === USER_AGENT_TYPES.CUSTOM && custom) {
        return custom;
    }

    // Default to the current system's OS if not specified
    let os = requestedOs;
    if (!os) {
        const platform = process.platform;
        if (platform === 'win32') os = 'windows';
        else if (platform === 'darwin') os = 'macos';
        else if (platform === 'linux') os = 'linux';
        else if (platform === 'android') os = 'android';
        else if (platform === 'ios') os = 'ios';
        else os = 'linux'; // Default fallback
    }

    // OS version
    let osVersion = requestedOsVersion;
    if (!osVersion && OS_VERSIONS[os]) {
        osVersion = _randomItem(OS_VERSIONS[os]);
    }

    // Browser or mobile types
    let browserVersion;
    let userAgent;

    switch (browser) {
        case 'chrome':
            browserVersion = _randomInt(BROWSER_VERSIONS.chrome.min, BROWSER_VERSIONS.chrome.max);
            if (type === USER_AGENT_TYPES.MOBILE && (os === 'android' || os === 'ios')) {
                if (os === 'android') {
                    userAgent = `Mozilla/5.0 (Linux; Android ${osVersion}; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Mobile Safari/537.36`;
                } else {
                    userAgent = `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVersion.replace('_', ' ')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${browserVersion}.0.0.0 Mobile/15E148 Safari/604.1`;
                }
            } else {
                if (os === 'windows') {
                    userAgent = `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;
                } else if (os === 'macos') {
                    userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;
                } else {
                    userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;
                }
            }
            break;

        case 'firefox':
            browserVersion = _randomInt(BROWSER_VERSIONS.firefox.min, BROWSER_VERSIONS.firefox.max);
            if (type === USER_AGENT_TYPES.MOBILE && (os === 'android' || os === 'ios')) {
                if (os === 'android') {
                    userAgent = `Mozilla/5.0 (Android ${osVersion}; Mobile; rv:${browserVersion}.0) Gecko/${browserVersion}.0 Firefox/${browserVersion}.0`;
                } else {
                    userAgent = `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVersion.replace('_', ' ')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/${browserVersion}.0 Mobile/15E148 Safari/605.1.15`;
                }
            } else {
                if (os === 'windows') {
                    userAgent = `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64; rv:${browserVersion}.0) Gecko/20100101 Firefox/${browserVersion}.0`;
                } else if (os === 'macos') {
                    userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/${browserVersion}.0`;
                } else {
                    userAgent = `Mozilla/5.0 (X11; Linux i686; rv:${browserVersion}.0) Gecko/20100101 Firefox/${browserVersion}.0`;
                }
            }
            break;

        case 'safari':
            browserVersion = _randomInt(BROWSER_VERSIONS.safari.min, BROWSER_VERSIONS.safari.max);
            if (os === 'macos') {
                userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVersion}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${browserVersion}.0 Safari/605.1.15`;
            } else if (os === 'ios') {
                userAgent = `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVersion.replace('_', ' ')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${browserVersion}.0 Mobile/15E148 Safari/604.1`;
            } else {
                // Safari is not available on Windows or Linux, fallback to Chrome
                browserVersion = _randomInt(BROWSER_VERSIONS.chrome.min, BROWSER_VERSIONS.chrome.max);
                userAgent = `Mozilla/5.0 (${os === 'windows' ? 'Windows NT ' + osVersion : 'X11; Linux x86_64'}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;
            }
            break;

        case 'edge':
            browserVersion = _randomInt(BROWSER_VERSIONS.edge.min, BROWSER_VERSIONS.edge.max);
            if (os === 'windows') {
                userAgent = `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36 Edg/${browserVersion}.0.0.0`;
            } else if (os === 'macos') {
                userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36 Edg/${browserVersion}.0.0.0`;
            } else if (os === 'android') {
                userAgent = `Mozilla/5.0 (Linux; Android ${osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Mobile Safari/537.36 EdgA/${browserVersion}.0.0.0`;
            } else if (os === 'ios') {
                userAgent = `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVersion.replace('_', ' ')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${browserVersion}.0 EdgiOS/${browserVersion}.0.0.0 Mobile/15E148 Safari/605.1.15`;
            } else {
                userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36 Edg/${browserVersion}.0.0.0`;
            }
            break;

        default:
            // Default to Chrome
            browserVersion = _randomInt(BROWSER_VERSIONS.chrome.min, BROWSER_VERSIONS.chrome.max);
            userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;
    }

    return userAgent;
}

/**
 * Generate standard HTTP headers for requests
 * @param {Object} options - Header options
 * @param {Object} [options.userAgent] - User-Agent options (passed to generateUserAgent)
 * @param {string} [options.referer] - Referer URL
 * @param {string} [options.accept] - Accept header
 * @param {string} [options.acceptLanguage] - Accept-Language header
 * @param {boolean} [options.jsonContent=false] - If true, adds Content-Type: application/json
 * @param {boolean} [options.formContent=false] - If true, adds Content-Type: application/x-www-form-urlencoded
 * @param {Object} [options.additional] - Additional headers to include
 * @returns {Object} - HTTP headers object
 */
function generateHeaders(options = {}) {
    const {
        userAgent,
        referer,
        accept = '*/*',
        acceptLanguage = 'en-US,en;q=0.9',
        jsonContent = false,
        formContent = false,
        additional = {}
    } = options;

    // Start with common headers
    const headers = {
        'User-Agent': userAgent ? generateUserAgent(userAgent) : generateUserAgent(),
        'Accept': accept,
        'Accept-Language': acceptLanguage,
        'Connection': 'keep-alive'
    };

    // Add Referer if provided
    if (referer) {
        headers['Referer'] = referer;
    }

    // Add Content-Type based on options
    if (jsonContent) {
        headers['Content-Type'] = 'application/json';
    } else if (formContent) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    // Add any additional headers
    return { ...headers, ...additional };
}

/**
 * Create browser-like headers for web scraping
 * @param {Object} options - Options for the headers
 * @returns {Object} - Browser-like HTTP headers
 */
function createBrowserHeaders(options = {}) {
    const defaultOptions = {
        userAgent: { type: 'browser', browser: 'chrome' },
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        acceptLanguage: 'en-US,en;q=0.9',
        acceptEncoding: 'gzip, deflate, br',
        ...options
    };

    const headers = generateHeaders(defaultOptions);
    
    // Add common browser headers
    headers['Sec-Ch-Ua'] = '"Not A;Brand";v="99", "Chromium";v="101"';
    headers['Sec-Ch-Ua-Mobile'] = '?0';
    headers['Sec-Ch-Ua-Platform'] = '"Windows"';
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
    headers['Upgrade-Insecure-Requests'] = '1';
    headers['Cache-Control'] = 'max-age=0';

    return headers;
}

/**
 * Create API request headers
 * @param {Object} options - Options for the headers
 * @param {string} [options.apiKey] - API key to include
 * @param {string} [options.authorization] - Authorization value (e.g., "Bearer token")
 * @param {string} [options.authMethod='Bearer'] - Authorization method if token is provided directly
 * @param {string} [options.token] - Auth token
 * @returns {Object} - API request headers
 */
function createApiHeaders(options = {}) {
    const {
        apiKey,
        authorization,
        authMethod = 'Bearer',
        token,
        ...otherOptions
    } = options;

    const defaultOptions = {
        userAgent: { type: 'app' },
        accept: 'application/json',
        jsonContent: true,
        ...otherOptions
    };

    const headers = generateHeaders(defaultOptions);

    // Add authorization if provided
    if (authorization) {
        headers['Authorization'] = authorization;
    } else if (token) {
        headers['Authorization'] = `${authMethod} ${token}`;
    }

    // Add API key if provided
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    return headers;
}

module.exports = {
    generateUserAgent,
    generateHeaders,
    createBrowserHeaders,
    createApiHeaders,
    USER_AGENT_TYPES
};
