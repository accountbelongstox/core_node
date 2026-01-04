#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Platform detection - supports Windows and Linux
const IS_WINDOWS = os.platform() === 'win32';

/**
 * Safe file read with error handling
 * Supports both Windows and Linux paths
 * @param {string} filePath - Path to file
 * @param {string} encoding - Encoding (default: 'utf8')
 * @returns {string|null} File content or null if error
 */
function safeReadFile(filePath, encoding = 'utf8') {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, encoding);
        }
    } catch (error) {
        // Ignore read errors
    }
    return null;
}

/**
 * Safe directory read with error handling
 * Supports both Windows and Linux paths
 * @param {string} dirPath - Path to directory
 * @returns {string[]} Array of directory entries or empty array if error
 */
function safeReadDir(dirPath) {
    try {
        if (fs.existsSync(dirPath)) {
            return fs.readdirSync(dirPath);
        }
    } catch (error) {
        // Ignore read errors
    }
    return [];
}

/**
 * Safe file/directory existence check
 * Supports both Windows and Linux paths
 * @param {string} filePath - Path to check
 * @returns {boolean} True if exists
 */
function safeExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

/**
 * Safe stat with error handling
 * Supports both Windows and Linux paths
 * @param {string} filePath - Path to file/directory
 * @returns {fs.Stats|null} Stats object or null if error
 */
function safeStat(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return fs.statSync(filePath);
        }
    } catch (error) {
        // Ignore stat errors
    }
    return null;
}

/**
 * Check if path is a directory
 * Supports both Windows and Linux paths
 * @param {string} dirPath - Path to check
 * @returns {boolean} True if directory exists and is a directory
 */
function isDirectory(dirPath) {
    const stat = safeStat(dirPath);
    return stat !== null && stat.isDirectory();
}

/**
 * Check if path is a file
 * Supports both Windows and Linux paths
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists and is a file
 */
function isFile(filePath) {
    const stat = safeStat(filePath);
    return stat !== null && stat.isFile();
}

/**
 * Safe directory creation
 * Supports both Windows and Linux paths
 * @param {string} dirPath - Path to directory
 * @param {object} options - Options (recursive, mode)
 * @returns {boolean} True if created successfully
 */
function safeMkdir(dirPath, options = { recursive: true, mode: 0o755 }) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, options);
            return true;
        }
        return true; // Already exists
    } catch (error) {
        return false;
    }
}

/**
 * Parse key-value file (like /etc/os-release)
 * Supports both Windows and Linux file formats
 * @param {string} filePath - Path to file
 * @param {string} delimiter - Key-value delimiter (default: '=')
 * @returns {Object} Object with key-value pairs
 */
function parseKeyValueFile(filePath, delimiter = '=') {
    const content = safeReadFile(filePath);
    if (!content) {
        return {};
    }

    const result = {};
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const index = trimmed.indexOf(delimiter);
        if (index > 0) {
            const key = trimmed.substring(0, index).trim();
            let value = trimmed.substring(index + 1).trim();
            // Remove quotes
            value = value.replace(/^["']|["']$/g, '');
            result[key] = value;
        }
    }

    return result;
}

/**
 * Find most recently modified directory in a path
 * Supports both Windows and Linux paths
 * @param {string} dirPath - Directory to scan
 * @param {function} filter - Optional filter function (dirName) => boolean
 * @returns {string|null} Path to most recently modified directory or null
 */
function findLatestModifiedDir(dirPath, filter) {
    if (!isDirectory(dirPath)) {
        return null;
    }

    const entries = safeReadDir(dirPath);
    let latestPath = null;
    let latestTime = 0;

    for (const entry of entries) {
        if (filter && !filter(entry)) {
            continue;
        }

        const entryPath = path.join(dirPath, entry);
        const stat = safeStat(entryPath);

        if (stat && stat.isDirectory() && stat.mtimeMs > latestTime) {
            latestTime = stat.mtimeMs;
            latestPath = entryPath;
        }
    }

    return latestPath;
}

/**
 * Extract username from Windows user profile path
 * Windows-specific utility
 * @param {string} profilePath - User profile path (e.g., C:\Users\username)
 * @returns {string|null} Username or null
 */
function extractWindowsUsername(profilePath) {
    if (!IS_WINDOWS) {
        return null;
    }

    try {
        const parts = profilePath.split(path.sep);
        const usersIndex = parts.indexOf('Users');
        if (usersIndex >= 0 && usersIndex < parts.length - 1) {
            return parts[usersIndex + 1];
        }
    } catch (error) {
        // Ignore errors
    }

    return null;
}

/**
 * Get Windows user info
 * Windows-specific utility
 * @returns {Object|null} User info object with username and homedir
 */
function getWindowsUserInfo() {
    if (!IS_WINDOWS) {
        return null;
    }

    try {
        const userInfo = os.userInfo();
        const homedir = os.homedir();

        if (userInfo && userInfo.username) {
            return {
                username: userInfo.username,
                homedir: homedir || null
            };
        }

        // Fallback: extract from homedir
        if (homedir) {
            const username = extractWindowsUsername(homedir);
            if (username) {
                return {
                    username,
                    homedir
                };
            }
        }
    } catch (error) {
        // Ignore errors
    }

    return null;
}

module.exports = {
    // Platform
    IS_WINDOWS,
    
    // File operations (Windows & Linux)
    safeReadFile,
    safeReadDir,
    safeExists,
    safeStat,
    safeMkdir,
    
    // Type checks (Windows & Linux)
    isDirectory,
    isFile,
    
    // Utilities (Windows & Linux)
    parseKeyValueFile,
    findLatestModifiedDir,
    
    // Windows-specific utilities
    extractWindowsUsername,
    getWindowsUserInfo
};

