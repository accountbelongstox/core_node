const path = require('path');
const fs = require('fs');
const os = require('os');
let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = logger;
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args)
    };
}
let cacheDir;
try {
    const { COMMON_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
    cacheDir = path.join(COMMON_CACHE_DIR, '.ffinder');
} catch (error) {
    const homeDir = os.homedir();
    cacheDir = path.join(homeDir, 'core_node/.cache/.ffinder');
}

const isWindows = os.platform() === 'win32';

class FileFinder {
    constructor() {
        this.cacheDir = cacheDir;
        this.cacheFile = path.join(this.cacheDir, 'ffinder_paths.json');
        this.ensureCache();
    }

    ensureCache() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        if (!fs.existsSync(this.cacheFile)) {
            fs.writeFileSync(this.cacheFile, '{}', 'utf8');
        }
    }

    loadCache() {
        try {
            return JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        } catch (error) {
            log.error('Error loading cache:', error);
            return {};
        }
    }

    saveCache(cache) {
        try {
            fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2), 'utf8');
        } catch (error) {
            log.error('Error saving cache:', error);
        }
    }

    pathToKey(keyPath) {
        let key = keyPath.trim();
        key = path.basename(key);
        key = key.replace(/\.exe$/, '');
        return key;
    }

    saveCacheByPath(path, value) {
        const key = this.pathToKey(path);
        const cache = this.loadCache();
        const cacheKey = `which:${key}`;
        cache[cacheKey] = value;
        this.saveCache(cache);
    }

    readCacheByPath(path) {   
        const key = this.pathToKey(path);
        const cache = this.loadCache();
        const cacheKey = `which:${key}`;
        return cache[cacheKey];
    }

    validateCachedPath(cachedPath) {
        try {
            return fs.existsSync(cachedPath);
        } catch {
            return false;
        }
    }

    /**
     * Find first occurrence of a file in specified directories
     * @param {string} fileName - Name of the file to find
     * @param {string|string[]} searchPaths - Single path or array of paths to search in
     * @param {number} [maxDepth=-1] - Maximum search depth (-1 for unlimited)
     * @returns {Promise<string|null>} - First found absolute path or null
     */
    async findFirstFile(fileName, searchPaths, maxDepth = -1) {
        const paths = Array.isArray(searchPaths) ? searchPaths : [searchPaths];
        const cache = this.loadCache();
        const cacheKey = `${fileName}:${paths.join('|')}`;

        // Check cache first
        if (cache[cacheKey] && this.validateCachedPath(cache[cacheKey])) {
            log.debug(`Found in cache: ${cache[cacheKey]}`);
            return cache[cacheKey];
        }

        for (const basePath of paths) {
            if (!fs.existsSync(basePath)) {
                continue;
            }

            try {
                const result = await this.searchFileInDirectory(basePath, fileName, maxDepth, true);
                if (result) {
                    cache[cacheKey] = result;
                    this.saveCache(cache);
                    return result;
                }
            } catch (error) {
                log.debug(`Error searching in ${basePath}:`, error.message);
            }
        }

        return null;
    }

    /**
     * Find all occurrences of a file in specified directories
     * @param {string} fileName - Name of the file to find
     * @param {string|string[]} searchPaths - Single path or array of paths to search in
     * @param {number} [maxDepth=-1] - Maximum search depth (-1 for unlimited)
     * @returns {Promise<string[]>} - Array of found absolute paths
     */
    async findAllFiles(fileName, searchPaths, maxDepth = -1) {
        const paths = Array.isArray(searchPaths) ? searchPaths : [searchPaths];
        const cache = this.loadCache();
        const cacheKey = `all:${fileName}:${paths.join('|')}`;

        if (cache[cacheKey]) {
            const validPaths = cache[cacheKey].filter(p => this.validateCachedPath(p));
            if (validPaths.length > 0) {
                if (validPaths.length !== cache[cacheKey].length) {
                    cache[cacheKey] = validPaths;
                    this.saveCache(cache);
                }
                return validPaths;
            }
        }

        const results = new Set();
        for (const basePath of paths) {
            if (!fs.existsSync(basePath)) {
                continue;
            }

            try {
                const found = await this.searchFileInDirectory(basePath, fileName, maxDepth, false);
                found.forEach(p => results.add(p));
            } catch (error) {
                log.debug(`Error searching in ${basePath}:`, error.message);
            }
        }

        const resultArray = Array.from(results);
        if (resultArray.length > 0) {
            cache[cacheKey] = resultArray;
            this.saveCache(cache);
        }

        return resultArray;
    }

    /**
     * Internal method for file searching
     * @private
     */
    async searchFileInDirectory(basePath, fileName, maxDepth = -1, stopOnFirst = false) {
        const results = [];

        async function search(currentPath, depth) {
            if (maxDepth !== -1 && depth > maxDepth) return;

            try {
                const entries = fs.readdirSync(currentPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);

                    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
                        if (stopOnFirst) {
                            return fullPath;
                        }
                        results.push(fullPath);
                    } else if (entry.isDirectory()) {
                        const result = await search(fullPath, depth + 1);
                        if (stopOnFirst && result) {
                            return result;
                        }
                    }
                }
            } catch (error) {
                log.debug(`Error accessing ${currentPath}:`, error.message);
            }
            return stopOnFirst ? null : undefined;
        }

        const result = await search(basePath, 0);
        return stopOnFirst ? result : results;
    }

    getFinderCache(executable) {
        return this.readCacheByPath(executable);
    }

    isFinderCacheValid(executable) {
        const cachePath = this.readCacheByPath(executable);
        if(cachePath) {
            return this.validateCachedPath(cachePath);
        }
        return false;
    }
    /**
     * Find executable in system PATH (cross-platform which/where)
     * @param {string} executable - Name of executable to find
     * @param {Object} options - Search options
     * @param {boolean} [options.deepSearch=false] - Enable deep search in Linux
     * @param {number} [options.maxDepth=3] - Maximum search depth for Windows/deep search
     * @returns {Promise<string|null>} - Executable path or null if not found
     */
    async findByCommonInstallDir(executable, options = {}) {
        const { deepSearch = false, maxDepth = 3, useCache = false } = options;

        // Normalize executable name
        let execName = executable;
        if (isWindows) {
            execName = execName.toLowerCase().endsWith('.exe') ? execName : `${execName}.exe`;
        } else {
            execName = execName.toLowerCase().replace(/\.exe$/, '');
        }

        // Check cache first
        const cache = this.loadCache();
        const cacheKey = `which:${execName}`;
        if (useCache && cache[cacheKey] && this.validateCachedPath(cache[cacheKey])) {
            log.debug(`Found in cache: ${cache[cacheKey]}`);
            return cache[cacheKey];
        }

        // If not found, try searching in common directories
        const searchPaths = isWindows ? [
            'C:\\Program Files',
            'C:\\Program Files (x86)',
            'D:\\Program Files',
            'D:\\Program Files (x86)',
            'D:\\applications',
            'D:\\lang_compiler'
        ] : [
            '/usr/bin',
            '/usr/local/bin',
            '/opt',
            '/usr/sbin',
            '/usr/local/sbin'
        ];

        // Add PATH directories to search paths
        const pathDirs = (process.env.PATH || '').split(path.delimiter);
        searchPaths.push(...pathDirs);

        // For Linux deep search, add more directories
        if (!isWindows && deepSearch) {
            searchPaths.push(
                '/usr/local',
                '/opt',
                '/usr/share',
                '/usr/lib',
                '/var/lib'
            );
        }

        // Remove duplicates and non-existent paths
        const uniquePaths = [...new Set(searchPaths)].filter(p => fs.existsSync(p));

        log.info(`Searching for ${execName} in ${uniquePaths.length} directories:`);
        uniquePaths.forEach(dir => log.info(`  - ${dir}`));

        let scannedDirs = { total: 0, level1: 0, level2: 0, level3: 0 };

        // Modify searchFileInDirectory to count directories
        const countDirs = (currentPath, depth) => {
            try {
                const entries = fs.readdirSync(currentPath, { withFileTypes: true });
                scannedDirs.total++;

                switch (depth) {
                    case 1: scannedDirs.level1++; break;
                    case 2: scannedDirs.level2++; break;
                    case 3: scannedDirs.level3++; break;
                }

                entries
                    .filter(entry => entry.isDirectory())
                    .forEach(entry => {
                        if (depth < maxDepth) {
                            countDirs(path.join(currentPath, entry.name), depth + 1);
                        }
                    });
            } catch (error) {
                // Ignore access errors
            }
        };

        // Count directories before searching
        uniquePaths.forEach(dir => countDirs(dir, 1));

        try {
            const result = await this.findFirstFile(
                execName,
                uniquePaths,
                isWindows || deepSearch ? maxDepth : 1
            );

            if (result) {
                // Verify the file is executable (on Linux)
                if (!isWindows) {
                    try {
                        fs.accessSync(result, fs.constants.X_OK);
                    } catch {
                        log.warn(`Found ${execName} at ${result} but it's not executable`);
                        return null;
                    }
                }

                log.success(`Found ${execName} at: ${result}`);
                cache[cacheKey] = result;
                this.saveCache(cache);
                return result;
            }

            // If not found, show detailed search statistics
            log.warn(`${execName} not found after searching:`);
            log.info(`  - Level 1 directories: ${scannedDirs.level1}`);
            log.info(`  - Level 2 directories: ${scannedDirs.level2}`);
            log.info(`  - Level 3 directories: ${scannedDirs.level3}`);
            log.info(`  - Total directories scanned: ${scannedDirs.total}`);

        } catch (error) {
            log.error('Search failed:', error.message);
            log.info('Directories scanned before error:');
            log.info(`  - Level 1 directories: ${scannedDirs.level1}`);
            log.info(`  - Level 2 directories: ${scannedDirs.level2}`);
            log.info(`  - Level 3 directories: ${scannedDirs.level3}`);
            log.info(`  - Total directories scanned: ${scannedDirs.total}`);
        }

        return null;
    }

    /**
     * Find all occurrences of an executable in system
     * @param {string} executable - Name of executable to find
     * @param {Object} options - Search options
     * @param {boolean} [options.deepSearch=false] - Enable deep search in Linux
     * @param {number} [options.maxDepth=3] - Maximum search depth for Windows/deep search
     * @returns {Promise<string[]>} - Array of executable paths
     */
    async findByCommonInstallDirAll(executable, options = {}) {
        const isWindows = process.platform === 'win32';
        const { deepSearch = false, maxDepth = 3 } = options;

        // Normalize executable name
        let execName = executable;
        if (isWindows) {
            execName = execName.toLowerCase().endsWith('.exe') ? execName : `${execName}.exe`;
        } else {
            execName = execName.toLowerCase().replace(/\.exe$/, '');
        }

        // Check cache first
        const cache = this.loadCache();
        const cacheKey = `whichAll:${execName}`;
        if (cache[cacheKey]) {
            const validPaths = cache[cacheKey].filter(p => this.validateCachedPath(p));
            if (validPaths.length > 0) {
                if (validPaths.length !== cache[cacheKey].length) {
                    cache[cacheKey] = validPaths;
                    this.saveCache(cache);
                }
                log.debug(`Found ${validPaths.length} instances in cache`);
                return validPaths;
            }
        }

        const results = new Set();

        // Search in common directories
        const searchPaths = isWindows ? [
            'C:\\Program Files',
            'C:\\Program Files (x86)',
            'D:\\Program Files',
            'D:\\Program Files (x86)',
            'D:\\applications',
            'D:\\lang_compiler'
        ] : [
            '/usr/bin',
            '/usr/local/bin',
            '/opt',
            '/usr/sbin',
            '/usr/local/sbin'
        ];

        // Add PATH directories
        const pathDirs = (process.env.PATH || '').split(path.delimiter);
        searchPaths.push(...pathDirs);

        // For Linux deep search
        if (!isWindows && deepSearch) {
            searchPaths.push(
                '/usr/local',
                '/opt',
                '/usr/share',
                '/usr/lib',
                '/var/lib'
            );
        }

        // Remove duplicates and non-existent paths
        const uniquePaths = [...new Set(searchPaths)].filter(p => fs.existsSync(p));

        log.info(`Searching for all instances of ${execName} in ${uniquePaths.length} directories:`);
        uniquePaths.forEach(dir => log.info(`  - ${dir}`));

        let scannedDirs = { total: 0, level1: 0, level2: 0, level3: 0 };

        // Count directories before searching
        const countDirs = (currentPath, depth) => {
            try {
                const entries = fs.readdirSync(currentPath, { withFileTypes: true });
                scannedDirs.total++;

                switch (depth) {
                    case 1: scannedDirs.level1++; break;
                    case 2: scannedDirs.level2++; break;
                    case 3: scannedDirs.level3++; break;
                }

                entries
                    .filter(entry => entry.isDirectory())
                    .forEach(entry => {
                        if (depth < maxDepth) {
                            countDirs(path.join(currentPath, entry.name), depth + 1);
                        }
                    });
            } catch (error) {
                // Ignore access errors
            }
        };

        // Count directories before searching
        uniquePaths.forEach(dir => countDirs(dir, 1));

        try {
            const found = await this.findAllFiles(
                execName,
                uniquePaths,
                isWindows || deepSearch ? maxDepth : 1
            );

            // Filter for executable files on Linux
            const validFiles = isWindows ?
                found :
                found.filter(f => {
                    try {
                        fs.accessSync(f, fs.constants.X_OK);
                        return true;
                    } catch {
                        log.warn(`Found ${execName} at ${f} but it's not executable`);
                        return false;
                    }
                });

            validFiles.forEach(p => results.add(p));
            const resultArray = Array.from(results);

            if (resultArray.length > 0) {
                log.success(`Found ${resultArray.length} instances of ${execName}:`);
                resultArray.forEach(p => log.info(`  - ${p}`));
                cache[cacheKey] = resultArray;
                this.saveCache(cache);
            } else {
                // If not found, show detailed search statistics
                log.warn(`No instances of ${execName} found after searching:`);
                log.info(`  - Level 1 directories: ${scannedDirs.level1}`);
                log.info(`  - Level 2 directories: ${scannedDirs.level2}`);
                log.info(`  - Level 3 directories: ${scannedDirs.level3}`);
                log.info(`  - Total directories scanned: ${scannedDirs.total}`);
            }

            return resultArray;
        } catch (error) {
            log.error('Search failed:', error.message);
            log.info('Directories scanned before error:');
            log.info(`  - Level 1 directories: ${scannedDirs.level1}`);
            log.info(`  - Level 2 directories: ${scannedDirs.level2}`);
            log.info(`  - Level 3 directories: ${scannedDirs.level3}`);
            log.info(`  - Total directories scanned: ${scannedDirs.total}`);
            return [];
        }
    }
}

const fileFinder = new FileFinder();
module.exports = fileFinder; 