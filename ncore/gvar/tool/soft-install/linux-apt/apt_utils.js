const fs = require('fs');
const path = require('path');
const os = require('os');

let cacheDir;
try {
    const { COMMON_CACHE_DIR } = require('#@/ncore/gvar/gdir.js');
    cacheDir = path.join(COMMON_CACHE_DIR, '.apt');
} catch (error) {
    const homeDir = os.homedir();   
    cacheDir = path.join(homeDir, '.cache', '.apt');
}

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = {
        info: (...args) => logger.info(...args),
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        success: (...args) => logger.success(...args),
        debug: (...args) => logger.debug ? logger.debug(...args) : console.log('[DEBUG]', ...args),
        command: (...args) => logger.command(...args)
    };
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args),
        command: (...args) => console.log('[COMMAND]', ...args)
    };
}

function handleCache(cachePath, key, maxAge, useCache = true) {
    // If cache is disabled, return not exists
    if (!useCache) {
        return { exists: false };
    }

    try {
        if (!fs.existsSync(cachePath)) {
            return { exists: false };
        }

        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const cachedItem = cache[key];

        if (!cachedItem) {
            return { exists: false };
        }

        const cacheAge = Date.now() - cachedItem.timestamp;
        if (cacheAge < maxAge) {
            return {
                exists: true,
                isValid: true,
                data: cachedItem.data
            };
        }

        return { exists: true, isValid: false };
    } catch (error) {
        return { exists: false, error };
    }
}

function updateCache(cachePath, key, data) {
    try {
        // Read existing cache or create new one
        let cache = {};
        if (fs.existsSync(cachePath)) {
            cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        }

        // Update cache with new data
        cache[key] = {
            timestamp: Date.now(),
            data
        };

        // Save updated cache
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

function parsePackageInfo(line) {
    // Parse package info from apt output
    const match = line.match(/^(\S+)\/\S+\s+(\S+)\s+(.+)$/);
    if (match) {
        return {
            name: match[1],
            version: match[2],
            description: match[3].trim()
        };
    }
    return null;
}

function isValidVersion(version) {
    if (!version || typeof version !== 'string') {
        return false;
    }

    // APT version format validation
    // Examples: 1.0.0, 2:1.0.0-1, 1.0.0-1ubuntu1
    const versionPattern = /^(\d+:)?[\d\.]+(-[\w\.]+)?$/;
    return versionPattern.test(version);
}

function normalizePackageName(name) {
    // Remove architecture suffix if present (e.g., :amd64)
    return name.split(':')[0].toLowerCase();
}

function ensureCache() {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
}

module.exports = {
    cacheDir,
    handleCache,
    updateCache,
    parsePackageInfo,
    isValidVersion,
    normalizePackageName,
    ensureCache,
    log
}; 