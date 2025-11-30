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

const fs = require('fs');
const path = require('path');
const os = require('os');

// Constants
const homeDir = os.homedir();
const SCRIPT_NAME = 'core_node';
const LOCAL_DIR = os.platform() === 'win32'
    ? path.join(homeDir, `.${SCRIPT_NAME}`)
    : `/usr/${SCRIPT_NAME}`;
const COMMON_CACHE_DIR = path.join(LOCAL_DIR, '.cache');
const CACHE_VALID_TIME = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize cache directory
 */
function initCacheDir() {
    if (!fs.existsSync(COMMON_CACHE_DIR)) {
        fs.mkdirSync(COMMON_CACHE_DIR, { recursive: true });
    }
}

/**
 * Get cache file path
 * @param {string} cacheKey Cache key/name
 * @returns {string} Cache file path
 */
function getCacheFilePath(cacheKey) {
    return path.join(COMMON_CACHE_DIR, `.${cacheKey}_cache.json`);
}

/**
 * Check if cache is valid
 * @param {Object} cache Cache object
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(cache) {
    if (!cache || !cache.timestamp) return false;
    const age = Date.now() - cache.timestamp;
    return age < CACHE_VALID_TIME;
}

/**
 * Read cache data
 * @param {string} cacheKey Cache key/name
 * @returns {Object|null} Cache data or null if invalid/not found
 */
function readCache(cacheKey) {
    try {
        const cacheFile = getCacheFilePath(cacheKey);
        if (fs.existsSync(cacheFile)) {
            const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (isCacheValid(cache)) {
                return cache.data;
            }
        }
    } catch (e) {
        console.error(`Failed to read cache for ${cacheKey}:`, e.message);
    }
    return null;
}

/**
 * Write data to cache
 * @param {string} cacheKey Cache key/name
 * @param {Object} data Data to cache
 * @returns {boolean} True if write successful
 */
function writeCache(cacheKey, data) {
    try {
        initCacheDir();
        const cacheFile = getCacheFilePath(cacheKey);
        fs.writeFileSync(cacheFile, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }, null, 2));
        return true;
    } catch (e) {
        console.error(`Failed to write cache for ${cacheKey}:`, e.message);
        return false;
    }
}

/**
 * Delete cache file
 * @param {string} cacheKey Cache key/name
 * @returns {boolean} True if delete successful
 */
function deleteCache(cacheKey) {
    try {
        const cacheFile = getCacheFilePath(cacheKey);
        if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
        }
        return true;
    } catch (e) {
        console.error(`Failed to delete cache for ${cacheKey}:`, e.message);
        return false;
    }
}

/**
 * Clear all cache files
 * @returns {boolean} True if clear successful
 */
function clearAllCache() {
    try {
        if (fs.existsSync(COMMON_CACHE_DIR)) {
            const files = fs.readdirSync(COMMON_CACHE_DIR);
            for (const file of files) {
                if (file.endsWith('_cache.json')) {
                    fs.unlinkSync(path.join(COMMON_CACHE_DIR, file));
                }
            }
        }
        return true;
    } catch (e) {
        console.error('Failed to clear all cache:', e.message);
        return false;
    }
}

/**
 * Update existing cache data
 * @param {string} cacheKey Cache key/name
 * @param {Object} newData New data to merge with existing cache
 * @returns {boolean} True if update successful
 */
function updateCache(cacheKey, newData) {
    try {
        const existingData = readCache(cacheKey);
        if (existingData) {
            const updatedData = { ...existingData, ...newData };
            return writeCache(cacheKey, updatedData);
        }
        return writeCache(cacheKey, newData);
    } catch (e) {
        console.error(`Failed to update cache for ${cacheKey}:`, e.message);
        return false;
    }
}

module.exports = {
    COMMON_CACHE_DIR,
    CACHE_VALID_TIME,
    readCache,
    writeCache,
    deleteCache,
    clearAllCache,
    updateCache,
    isCacheValid,
    getCacheFilePath
}; 