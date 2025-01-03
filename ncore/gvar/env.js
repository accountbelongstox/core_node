const fs = require('fs');
const path = require('path');
const process = require('process');

const grandparentDir = path.dirname(path.dirname(__dirname));
const grandparentRootDir = grandparentDir;
const DEFAULT_ROOT_DIR = grandparentRootDir
const DEBUG_PRINT = false;

const infoByDebug = (msg) => {
    if (DEBUG_PRINT) {
        console.log(msg);
    }
}

const errorByDebug = (msg) => {
    if (DEBUG_PRINT) {
        console.error(msg);
    }
}   

class EnvManager {
    static MAX_QUEUE_SIZE = 100;
    #envObjects = [];
    #currentIndex = 0;

    constructor(rootDir = null, envName = ".env", delimiter = "=") {
        rootDir = rootDir || DEFAULT_ROOT_DIR
        this.fileQueue = [];
        this.envObjects = new Map(); // Store env objects by their paths
        this.delimiter = delimiter;
        this.addRootDir(rootDir, envName);
    }

    getAllRowEnvValues() {
        const results = [];
        
        for (const [envPath, _] of this.envObjects) {
            if (fs.existsSync(envPath)) {
                const fileResult = {
                    path: envPath,
                    values: {}
                };
                
                const content = fs.readFileSync(envPath, 'utf8');
                const lines = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                    
                for (const line of lines) {
                    const parts = line.split(this.delimiter);
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        if (!key) continue;
                        const value = parts.slice(1).join(this.delimiter).trim();
                        fileResult.values[key] = value;
                    }
                }
                
                results.push(fileResult);
            }
        }
        
        return results;
    }

    getAllEnvValues() {
        const allResults = this.getAllRowEnvValues();
        const mergedValues = {};
        
        for (const result of allResults) {
            Object.assign(mergedValues, result.values);
        }
        
        return mergedValues;
    }

    getEnvValue(key, defaultValue = '') {
        const values = this.getAllEnvValues();
        return values[key] !== undefined ? values[key] : defaultValue;
    }

    getEnv(key, defaultValue = '') {
        return this.getEnvValue(key, defaultValue);
    }

    addRootDir(rootDir = null, envName = ".env") {
        infoByDebug("addRootDir " + rootDir);
        rootDir = rootDir || DEFAULT_ROOT_DIR;
        const localEnvFile = path.join(rootDir, envName);
        infoByDebug(`EnvManager rootDir:${rootDir}`);

        let envPath = localEnvFile;
        if (!fs.existsSync(localEnvFile)) {
            const foundEnvPath = this.scanForEnvFile(rootDir);
            if (foundEnvPath) {
                envPath = foundEnvPath;
            }
        }

        if (fs.existsSync(envPath)) {
            const envObject = this.parseEnvToObject(envPath);
            this.envObjects.set(envPath, envObject);
        }

        this.#envObjects.push({
            index: this.#currentIndex++,
            envPath,
            env: this.parseEnvToObject(envPath)
        });
    }

    scanForEnvFile(searchPath) {
        const envPath = path.join(searchPath, '.env');
        if (fs.existsSync(envPath)) {
            infoByDebug('Found existing .env file');
            return envPath;
        }

        const developFiles = ['.env-develop', '.env-example'];
        for (const devFile of developFiles) {
            const devPath = path.join(searchPath, devFile);
            if (fs.existsSync(devPath)) {
                try {
                    fs.copyFileSync(devPath, envPath);
                    infoByDebug(`Created .env from ${devFile}`);
                    return envPath;
                } catch (error) {
                    errorByDebug(`Failed to copy ${devFile}: ${error.message}`);
                }
            }
        }

        try {
            const files = fs.readdirSync(searchPath);
            const envFile = files.find(file => file.startsWith('.env'));
            
            if (envFile) {
                const sourcePath = path.join(searchPath, envFile);
                try {
                    fs.copyFileSync(sourcePath, envPath);
                    infoByDebug(`Created .env from ${envFile}`);
                    return envPath;
                } catch (error) {
                    errorByDebug(`Failed to copy ${envFile}: ${error.message}`);
                }
            }
        } catch (error) {
            errorByDebug(`Error scanning directory: ${error.message}`);
        }

        errorByDebug(`No suitable .env file found in ${searchPath}`);
        return null;
    }

    addFile(filename) {
        this.fileQueue.push(filename);
        if (this.fileQueue.length > EnvManager.MAX_QUEUE_SIZE) {
            return this.fileQueue.shift();
        }
        return null;
    }

    // Check if an environment variable exists
    has(key) {
        const values = this.getAllEnvValues();
        return values.hasOwnProperty(key);
    }

    // Add a value if it doesn't exist, return the current value
    hasAndAdd(key, value) {
        if (!this.has(key)) {
            this.add(key, value);
            return value;
        }
        return this.getEnvValue(key);
    }

    // Add or update an environment variable
    add(key, value) {
        // Get the last env file path from the Map, or create a new one if none exists
        let lastEnvPath = Array.from(this.envObjects.keys()).pop();
        
        if (!lastEnvPath) {
            // If no env file exists, create one in the root directory
            const rootDir = Array.from(this.envObjects.keys())[0]?.dirname || DEFAULT_ROOT_DIR;
            lastEnvPath = path.join(rootDir, '.env');
            this.envObjects.set(lastEnvPath, {});
        }

        // Get or create the env object for the last file
        const envObject = this.envObjects.get(lastEnvPath) || {};
        envObject[key] = value;
        this.envObjects.set(lastEnvPath, envObject);

        // Update the physical file
        try {
            // Ensure the directory exists
            const dirPath = path.dirname(lastEnvPath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            // Read existing content if file exists
            let existingContent = {};
            if (fs.existsSync(lastEnvPath)) {
                const content = fs.readFileSync(lastEnvPath, 'utf8');
                content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .forEach(line => {
                        const parts = line.split(this.delimiter);
                        if (parts.length >= 2) {
                            const k = parts[0].trim();
                            if (!k) return;
                            const v = parts.slice(1).join(this.delimiter).trim();
                            existingContent[k] = v;
                        }
                    });
            }

            // Merge new value with existing content
            const mergedContent = { ...existingContent, ...envObject };
            
            // Convert to string and write to file
            const content = Object.entries(mergedContent)
                .map(([k, v]) => `${k}${this.delimiter}${v}`)
                .join('\n');
                
            fs.writeFileSync(lastEnvPath, content, 'utf8');
            infoByDebug(`Updated env file: ${lastEnvPath}`);
            
        } catch (error) {
            errorByDebug(`Failed to write to env file ${lastEnvPath}: ${error.message}`);
            throw error; // Re-throw to allow error handling by caller
        }
    }

    // Get multiple environment values at once
    getEnvValues() {
        const allEnvs = this.getAllEnvValues();
        return allEnvs;
    }


    printAllEnvs() {
        const allEnvs = this.getAllEnvValues();
        
        infoByDebug('\nEnvironment Files and Variables:');
        infoByDebug('===============================');

        infoByDebug(allEnvs);
    }

    async setEnvValue(key, value) {
        if (this.#envObjects.length === 0) {
            return;
        }

        // Get the last env file object
        const lastEnvObj = this.#envObjects[this.#envObjects.length - 1];
        
        // Remove # from key if it exists
        const normalizedKey = key.startsWith('#') ? key.substring(1) : key;
        
        // Update value in memory
        lastEnvObj.env[normalizedKey] = value;

        // Build file content, preserving existing comments
        const envContent = Object.entries(lastEnvObj.env)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        // Write to file
        try {
            await fs.promises.writeFile(lastEnvObj.envPath, envContent, 'utf8');
            return true;
        } catch (error) {
            errorByDebug(`Failed to write to env file: ${error.message}`);
            return false;
        }
    }

    parseEnvToObject(envPath) {
        if (!fs.existsSync(envPath)) {
            return {};
        }

        try {
            const content = fs.readFileSync(envPath, 'utf8');
            const envObject = {};

            content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('##')) // Keep lines with single #
                .forEach(line => {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                        const trimmedKey = key.trim();
                        const value = valueParts.join('=').trim();
                        if (trimmedKey) {
                            envObject[trimmedKey] = value;
                        }
                    }
                });

            return envObject;
        } catch (error) {
            errorByDebug(`Error parsing env file ${envPath}: ${error.message}`);
            return {};
        }
    }

}

function normalizePath(path) {
    return path.replace(/\\/g, '/');
}

// Create default instance
const defaultInstance = new EnvManager();

const mateUrlNormal = normalizePath(__filename).replace('file://', '').replace(/^\/+/, '')
const processUrlNormal = normalizePath(process.argv[1]).replace('file://', '')

// Run tests if this file is executed directly
if (mateUrlNormal == processUrlNormal) {
    console.log(`mergedEnvValues`);
    defaultInstance.addRootDir("./");
    const mergedEnvValues = defaultInstance.getEnvValues();
    console.log(`mergedEnvValues`);
    console.log(mergedEnvValues);
}

module.exports = defaultInstance;
exports.EnvManager = EnvManager;