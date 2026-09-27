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

const path = require('path');
const fs = require('fs');
const { COMMON_CACHE_DIR } = require('#@global_dir');
const SEARCH_TIMEOUT_MS = 20000;
const log = require('#@logger');

const process = require('process');
const gconfig = require('#@gconfig');
const cacheDir = path.join(COMMON_CACHE_DIR, '.ffinder');
const isWindows = process.platform === 'win32';

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

    saveCacheByKey(key, value) {
        key = this.pathToKey(key);
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

    readCacheByKey(key) {
        key = this.pathToKey(key);
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
    async findFirstFile(fileName, searchPaths, maxDepth = -1, deadline = Infinity) {
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
                const result = await this.searchFileInDirectory(basePath, fileName, maxDepth, true, deadline);
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
    async findAllFiles(fileName, searchPaths, maxDepth = -1, deadline = Infinity) {
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
                const found = await this.searchFileInDirectory(basePath, fileName, maxDepth, false, deadline);
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
    async searchFileInDirectory(basePath, fileName, maxDepth = -1, stopOnFirst = false, deadline = Infinity) {
        const results = [];
        const visitedPaths = new Set();

        // Asynchronous I/O keeps the event loop free; the deadline ends the walk instead of racing a timer
        async function search(currentPath, depth) {
            if (maxDepth !== -1 && depth > maxDepth) return;
            if (Date.now() > deadline) return stopOnFirst ? null : undefined;

            // Resolve real path to detect symbolic link loops
            let realPath;
            try {
                realPath = await fs.promises.realpath(currentPath);
            } catch (error) {
                log.debug(`Cannot resolve real path for ${currentPath}:`, error.message);
                return stopOnFirst ? null : undefined;
            }

            // Skip if we've already visited this real path (prevents loops)
            if (visitedPaths.has(realPath)) {
                log.debug(`Skipping already visited path: ${realPath}`);
                return stopOnFirst ? null : undefined;
            }
            visitedPaths.add(realPath);

            try {
                const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);

                    // Skip problematic X11 directories that commonly have symbolic link loops
                    if (entry.name === 'X11' && currentPath.includes('/usr/bin')) {
                        log.debug(`Skipping potentially problematic X11 directory: ${fullPath}`);
                        continue;
                    }

                    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
                        if (stopOnFirst) {
                            return fullPath;
                        }
                        results.push(fullPath);
                    } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
                        // Only follow directories, not symbolic links to prevent loops
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
        if (cachePath) {
            return this.validateCachedPath(cachePath);
        }
        return false;
    }

    /**
     * Find file in common installation directories
     * @param {string} fileName - File name to find
     * @param {Object} [options] - Search options
     * @param {string[]} [options.additionalPaths] - Additional paths to search
     * @param {boolean} [options.recursive=true] - Whether to search recursively
     * @returns {Promise<string|null>} Found file path or null
     */
    async findByCommonInstallDir(fileName, options = {}) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                log.warn(`Search timeout for ${fileName} after ${SEARCH_TIMEOUT_MS} ms`);
                resolve(null);
            }, SEARCH_TIMEOUT_MS);

            this.findByCommonInstallDirSync(fileName, options)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    log.error(`Error searching for ${fileName}:`, error);
                    resolve(null);
                });
        });
    }

    /**
     * Find all instances of file in common installation directories
     * @param {string} fileName - File name to find
     * @param {Object} [options] - Search options
     * @param {string[]} [options.additionalPaths] - Additional paths to search
     * @param {boolean} [options.recursive=true] - Whether to search recursively
     * @returns {Promise<string[]>} Array of found file paths
     */
    async findByCommonInstallDirAll(fileName, options = {}) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                log.warn(`Search timeout for ${fileName} after ${SEARCH_TIMEOUT_MS} ms`);
                resolve([]);
            }, SEARCH_TIMEOUT_MS);

            this.findByCommonInstallDirAllSync(fileName, options)
                .then(results => {
                    clearTimeout(timeout);
                    resolve(results);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    log.error(`Error searching for ${fileName}:`, error);
                    resolve([]);
                });
        });
    }

    async findByCommonInstallDirSync(fileName, options = {}) {
        const { deepSearch = false, maxDepth = 3, useCache = false } = options;

        // Normalize executable name
        let execName = fileName;
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
            gconfig.APP_INSTALL_DIR,
            gconfig.DEV_LANG_DIR
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

        try {
            const result = await this.findFirstFile(
                execName,
                uniquePaths,
                isWindows || deepSearch ? maxDepth : 1,
                Date.now() + SEARCH_TIMEOUT_MS
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
                const cache = this.loadCache();
                cache[cacheKey] = result;
                this.saveCache(cache);
                return result;
            }

            log.warn(`${execName} not found in the searched directories`);

        } catch (error) {
            log.error('Search failed:', error.message);
        }

        return null;
    }

    async findByCommonInstallDirAllSync(fileName, options = {}) {
        const isWindows = process.platform === 'win32';
        const { deepSearch = false, maxDepth = 3 } = options;

        // Normalize executable name
        let execName = fileName;
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
            gconfig.APP_INSTALL_DIR,
            gconfig.DEV_LANG_DIR
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

        try {
            const found = await this.findAllFiles(
                execName,
                uniquePaths,
                isWindows || deepSearch ? maxDepth : 1,
                Date.now() + SEARCH_TIMEOUT_MS
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
                const cache = this.loadCache();
                cache[cacheKey] = resultArray;
                this.saveCache(cache);
            } else {
                log.warn(`No instances of ${execName} found in the searched directories`);
            }

            return resultArray;
        } catch (error) {
            log.error('Search failed:', error.message);
            return [];
        }
    }
}

const fileFinder = new FileFinder();
module.exports = fileFinder; 
