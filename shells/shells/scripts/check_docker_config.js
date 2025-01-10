const fs = require('fs');
const path = require('path');

const DOCKER_CONFIG = {
    'registry-mirrors': [
        'https://docker.mirrors.ustc.edu.cn',
        'https://hub-mirror.c.163.com',
        'https://mirror.baidubce.com'
    ],
    'log-driver': 'json-file',
    'log-opts': {
        'max-size': '100m',
        'max-file': '3'
    }
};

const DOCKER_CONFIG_PATH = '/etc/docker/daemon.json';

/**
 * Read Docker configuration file
 * @returns {object} Parsed configuration or empty object
 */
function readDockerConfig() {
    try {
        if (fs.existsSync(DOCKER_CONFIG_PATH)) {
            const content = fs.readFileSync(DOCKER_CONFIG_PATH, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('Error reading Docker config:', error.message);
    }
    return {};
}

/**
 * Deep compare two values
 * @param {any} val1 First value
 * @param {any} val2 Second value
 * @returns {boolean} Whether values are equal
 */
function deepEqual(val1, val2) {
    if (Array.isArray(val1) && Array.isArray(val2)) {
        return val1.length === val2.length && 
               val1.every(item => val2.includes(item)) &&
               val2.every(item => val1.includes(item));
    }
    
    if (typeof val1 === 'object' && val1 !== null && 
        typeof val2 === 'object' && val2 !== null) {
        const keys1 = Object.keys(val1);
        const keys2 = Object.keys(val2);
        return keys1.length === keys2.length &&
               keys1.every(key => deepEqual(val1[key], val2[key]));
    }
    
    return val1 === val2;
}

/**
 * Deep merge two objects
 * @param {object} target Target object
 * @param {object} source Source object
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (Array.isArray(source[key])) {
                result[key] = [...source[key]];
            } else {
                result[key] = result[key] && typeof result[key] === 'object' ?
                    deepMerge(result[key], source[key]) :
                    { ...source[key] };
            }
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

/**
 * Update Docker configuration
 * @returns {object} Update results
 */
function updateDockerConfig() {
    const results = {
        added: [],
        updated: [],
        unchanged: [],
        error: null
    };

    try {
        // Read current config
        let config = readDockerConfig();
        let configUpdated = false;

        // Check and update each required setting
        for (const key in DOCKER_CONFIG) {
            if (!(key in config)) {
                config[key] = DOCKER_CONFIG[key];
                configUpdated = true;
                results.added.push(key);
                console.log(`Adding new config: ${key} = ${JSON.stringify(DOCKER_CONFIG[key])}`);
            } else if (!deepEqual(config[key], DOCKER_CONFIG[key])) {
                const oldValue = JSON.stringify(config[key]);
                config[key] = deepMerge(config[key], DOCKER_CONFIG[key]);
                configUpdated = true;
                results.updated.push(key);
                console.log(`Updating config: ${key}\nOld value: ${oldValue}\nNew value: ${JSON.stringify(config[key])}`);
            } else {
                results.unchanged.push(key);
                console.log(`Config unchanged: ${key}`);
            }
        }

        // Write updated config if changes were made
        if (configUpdated) {
            const configDir = path.dirname(DOCKER_CONFIG_PATH);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(DOCKER_CONFIG_PATH, JSON.stringify(config, null, 4));
            console.log('Docker configuration updated successfully');
        } else {
            console.log('No updates needed for Docker configuration');
        }

    } catch (error) {
        console.error('Error updating Docker config:', error.message);
        results.error = error.message;
    }

    return results;
}

/**
 * Main function
 */
async function main() {
    console.log('Checking Docker Configuration');
    console.log('============================');
    
    // Show current configuration
    console.log('\nCurrent configuration:');
    const currentConfig = readDockerConfig();
    console.log(JSON.stringify(currentConfig, null, 2));

    // Update configuration
    console.log('\nChecking and updating configuration...');
    const results = updateDockerConfig();

    // Show results
    console.log('\nUpdate Results:');
    console.log('============================');
    if (results.added.length > 0) {
        console.log('Added configurations:', results.added);
    }
    if (results.updated.length > 0) {
        console.log('Updated configurations:', results.updated);
    }
    if (results.unchanged.length > 0) {
        console.log('Unchanged configurations:', results.unchanged);
    }
    if (results.error) {
        console.error('Error occurred:', results.error);
        process.exit(1);
    }

    // Show final configuration
    console.log('\nFinal configuration:');
    const finalConfig = readDockerConfig();
    console.log(JSON.stringify(finalConfig, null, 2));
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = {
    DOCKER_CONFIG,
    updateDockerConfig,
    readDockerConfig,
    main
}; 