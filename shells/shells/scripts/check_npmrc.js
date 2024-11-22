import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Get npm configuration paths
 * @returns {object} Configuration paths
 */
function getNpmConfigPaths() {
    const homeDir = os.homedir();
    return {
        userConfig: path.join(homeDir, '.npmrc'),
        projectConfig: path.join(process.cwd(), '.npmrc'),
        globalConfig: execSync('npm config get globalconfig', { encoding: 'utf8' }).trim()
    };
}

/**
 * Parse npmrc file content
 * @param {string} content - File content
 * @returns {object} Parsed configuration
 */
function parseNpmrcContent(content) {
    const config = {};
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            const value = valueParts.join('=').trim();
            if (key && value) {
                config[key.trim()] = value;
            }
        }
    }

    return config;
}

/**
 * Read npmrc file
 * @param {string} filePath - Path to npmrc file
 * @returns {object|null} Configuration object or null
 */
function readNpmrcFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return parseNpmrcContent(content);
        }
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
    }
    return null;
}

/**
 * Check registry configuration
 * @param {object} config - npmrc configuration
 * @returns {object} Registry status
 */
function checkRegistry(config) {
    const registryChecks = {
        hasRegistry: false,
        isPrivate: false,
        registryUrl: '',
        authToken: ''
    };

    if (config.registry) {
        registryChecks.hasRegistry = true;
        registryChecks.registryUrl = config.registry;
        registryChecks.isPrivate = !config.registry.includes('registry.npmjs.org');
    }

    // Check for auth tokens
    for (const key in config) {
        if (key.includes('_authToken') || key.includes('//registry.npmjs.org/:_authToken')) {
            registryChecks.authToken = config[key];
            break;
        }
    }

    return registryChecks;
}

/**
 * Check proxy configuration
 * @param {object} config - npmrc configuration
 * @returns {object} Proxy status
 */
function checkProxy(config) {
    return {
        hasProxy: !!(config.proxy || config['https-proxy']),
        proxy: config.proxy || '',
        httpsProxy: config['https-proxy'] || ''
    };
}

/**
 * Check cache configuration
 * @param {object} config - npmrc configuration
 * @returns {object} Cache status
 */
function checkCache(config) {
    return {
        cacheLocation: config.cache || execSync('npm config get cache', { encoding: 'utf8' }).trim(),
        cacheMax: config['cache-max'] || '0',
        cacheMin: config['cache-min'] || '0'
    };
}

/**
 * Format configuration check results
 * @param {string} configType - Type of configuration
 * @param {object} checks - Check results
 */
function printConfigChecks(configType, checks) {
    console.log(`\n${configType} Configuration:`);
    console.log('-'.repeat(50));
    
    for (const [key, value] of Object.entries(checks)) {
        if (typeof value === 'object') {
            console.log(`${key}:`);
            for (const [subKey, subValue] of Object.entries(value)) {
                console.log(`  ${subKey}: ${subValue}`);
            }
        } else {
            console.log(`${key}: ${value}`);
        }
    }
}

/**
 * Main function to check npm configuration
 */
async function main() {
    try {
        const configPaths = getNpmConfigPaths();
        const configs = {
            user: readNpmrcFile(configPaths.userConfig),
            project: readNpmrcFile(configPaths.projectConfig),
            global: readNpmrcFile(configPaths.globalConfig)
        };

        // Check each configuration file
        for (const [configType, config] of Object.entries(configs)) {
            if (config) {
                const checks = {
                    registry: checkRegistry(config),
                    proxy: checkProxy(config),
                    cache: checkCache(config)
                };
                printConfigChecks(configType, checks);
            } else {
                console.log(`\n${configType} Configuration: Not found or empty`);
            }
        }

        // Check npm version
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        console.log('\nNPM Version:', npmVersion);

        // Check node version
        const nodeVersion = process.version;
        console.log('Node Version:', nodeVersion);

    } catch (error) {
        console.error('Error checking npm configuration:', error.message);
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    getNpmConfigPaths,
    parseNpmrcContent,
    readNpmrcFile,
    checkRegistry,
    checkProxy,
    checkCache
}; 