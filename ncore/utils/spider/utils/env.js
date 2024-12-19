const fs = require('fs');
    const path = require('path');
    const process = require('process');
    
    const __filename = __filename;
    const __dirname = path.dirname(__filename);
    const grandparentDir = path.dirname(path.dirname(__dirname));
    const grandparentRootDir = path.dirname(path.dirname(grandparentDir));
    const DEFAULT_ROOT_DIR = grandparentRootDir;

    class EnvManager {
        static MAX_QUEUE_SIZE = 100;

        constructor(rootDir = null, envName = ".env", delimiter = "=") {
            rootDir = rootDir || DEFAULT_ROOT_DIR;
            this.fileQueue = [];
            this.envObjects = new Map(); // Store env objects by their paths
            this.delimiter = delimiter;
            this.addRootDir(rootDir, envName);
        }

        getAllEnvValues() {
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

        getMergedEnvValues() {
            const allResults = this.getAllEnvValues();
            const mergedValues = {};
            
            for (const result of allResults) {
                Object.assign(mergedValues, result.values);
            }
            
            return mergedValues;
        }

        getEnvValue(key, defaultValue = '') {
            const values = this.getMergedEnvValues();
            return values[key] !== undefined ? values[key] : defaultValue;
        }

        addRootDir(rootDir = null, envName = ".env") {
            rootDir = rootDir || DEFAULT_ROOT_DIR;
            const localEnvFile = path.join(rootDir, envName);
            console.log('EnvManager rootDir:', rootDir);

            let envPath = localEnvFile;
            if (!fs.existsSync(localEnvFile)) {
                const foundEnvPath = this.scanForEnvFile(rootDir);
                if (foundEnvPath) {
                    envPath = foundEnvPath;
                }
            }

            if (fs.existsSync(envPath)) {
                const entries = this.parseEnvFile(envPath);
                const envObject = {};
                entries.forEach(([key, value]) => {
                    envObject[key] = value;
                });
                this.envObjects.set(envPath, envObject);
            }
        }

        scanForEnvFile(searchPath) {
            const envPath = path.join(searchPath, '.env');
            if (fs.existsSync(envPath)) {
                console.log('Found existing .env file');
                return envPath;
            }

            const developFiles = ['.env-develop', '.env-example'];
            for (const devFile of developFiles) {
                const devPath = path.join(searchPath, devFile);
                if (fs.existsSync(devPath)) {
                    try {
                        fs.copyFileSync(devPath, envPath);
                        console.log(`Created .env from ${devFile}`);
                        return envPath;
                    } catch (error) {
                        console.log(`Failed to copy ${devFile}: ${error.message}`);
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
                        console.log(`Created .env from ${envFile}`);
                        return envPath;
                    } catch (error) {
                        console.log(`Failed to copy ${envFile}: ${error.message}`);
                    }
                }
            } catch (error) {
                console.log(`Error scanning directory: ${error.message}`);
            }

            console.log(`No suitable .env file found in ${searchPath}`);
            return null;
        }

        parseEnvFile(filePath) {
            if (!fs.existsSync(filePath)) return [];
            const content = fs.readFileSync(filePath, 'utf8');
            return content.split('\n')
                .map(line => line.split(this.delimiter).map(v => v.trim()))
                .filter(pair => pair.length === 2 && pair[0]);
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
            const values = this.getMergedEnvValues();
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
                console.log(`Updated env file: ${lastEnvPath}`);
                
            } catch (error) {
                console.error(`Failed to write to env file ${lastEnvPath}: ${error.message}`);
                throw error; // Re-throw to allow error handling by caller
            }
        }

        // Get multiple environment values at once
        getEnvValues(keys, defaultValue = '') {
            const result = {};
            for (const key of keys) {
                result[key] = this.getEnvValue(key, defaultValue);
            }
            return result;
        }

    }

    function normalizePath(path) {
        return path.replace(/\\/g, '/');
    }

    // Create default instance
    const defaultInstance = new EnvManager();

    const mateUrlNormal = normalizePath(__filename).replace('file://', '').replace(/^\/+/, '')
    const processUrlNormal = normalizePath(process.argv[1]).replace('file://', '')
    console.log(`mateUrlNormal:${mateUrlNormal}`)
    console.log(`processUrlNormal:${processUrlNormal}`)
    console.log(`mateUrlNormal == processUrlNormal:${mateUrlNormal == processUrlNormal}`)

    // Run tests if this file is executed directly
    if (mateUrlNormal == processUrlNormal) {
        console.log(`mergedEnvValues`);
        defaultInstance.addRootDir("./");
        const mergedEnvValues = defaultInstance.getMergedEnvValues();
        console.log(`mergedEnvValues`);
        console.log(mergedEnvValues);
    }

    module.exports = defaultInstance;