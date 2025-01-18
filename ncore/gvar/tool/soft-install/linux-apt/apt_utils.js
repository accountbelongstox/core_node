const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const SCRIPT_NAME = `core_node`
const LOCAL_DIR = os.platform() === 'win32'
    ? path.join(homeDir, `.${SCRIPT_NAME}`)
    : `/usr/${SCRIPT_NAME}`;
const COMMON_CACHE_DIR = path.join(LOCAL_DIR, '.cache');
let cacheDir = path.join(COMMON_CACHE_DIR, '.apt');

const log = {
    colors: {
        reset: '\x1b[0m',
        // Regular colors
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        // Bright colors
        brightRed: '\x1b[91m',
        brightGreen: '\x1b[92m',
        brightYellow: '\x1b[93m',
        brightBlue: '\x1b[94m',
        brightMagenta: '\x1b[95m',
        brightCyan: '\x1b[96m',
        brightWhite: '\x1b[97m',
    },

    info: function (...args) {
        console.log(this.colors.cyan + '[INFO]' + this.colors.reset, ...args);
    },
    warn: function (...args) {
        console.warn(this.colors.yellow + '[WARN]' + this.colors.reset, ...args);
    },
    error: function (...args) {
        console.error(this.colors.red + '[ERROR]' + this.colors.reset, ...args);
    },
    success: function (...args) {
        console.log(this.colors.green + '[SUCCESS]' + this.colors.reset, ...args);
    },
    debug: function (...args) {
        console.log(this.colors.magenta + '[DEBUG]' + this.colors.reset, ...args);
    },
    command: function (...args) {
        console.log(this.colors.brightBlue + '[COMMAND]' + this.colors.reset, ...args);
    }
};

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
    ensureCache
}; 