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

const os = require('os');
const softwareFinder = require('./win-soft/software_finder.js');
const packageFinder = require('./linux-apt/package_finder.js');
const fileFinder = require('../common/ffinder.js');

/**
 * Find executable path across different platforms
 * @param {string} executableName - Name of the executable to find
 * @param {Object} [options] - Search options
 * @param {boolean} [options.useCache=true] - Whether to use cache for search
 * @param {number} [options.timeout=5000] - Timeout in milliseconds for deep search
 * @returns {Promise<string|null>} Path to the executable or null if not found
 */
async function findExecutable(executableName, options = {}) {
    const {
        useCache = true,
        timeout = 5000
    } = options;

    // Check cache first if enabled
    if (useCache && fileFinder.isFinderCacheValid(executableName)) {
        return fileFinder.getFinderCache(executableName);
    }

    // First try platform-specific search
    const isWindows = os.platform() === 'win32';
    let executablePath = null;

    if (isWindows) {
        // Use Windows-specific finder
        executablePath = await softwareFinder.findSoftware(executableName, false, 2, useCache);
    } else {
        // Use Linux package finder
        executablePath = await packageFinder.findBinary(executableName);
    }

    // Save to cache if found
    if (executablePath) {
        fileFinder.saveCacheByPath(executableName, executablePath);
        return executablePath;
    }

    // If not found, try deep search in common installation directories
    if (!executablePath) {
        try {
            executablePath = await Promise.race([
                fileFinder.findByCommonInstallDir(executableName),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Search timeout')), timeout)
                )
            ]);

            // Save to cache if found through deep search
            if (executablePath) {
                fileFinder.saveCacheByPath(executableName, executablePath);
            }
        } catch (error) {
            if (error.message === 'Search timeout') {
                console.warn(`Deep search for ${executableName} timed out after ${timeout}ms`);
            } else {
                console.error('Error during deep search:', error);
            }
            executablePath = null;
        }
    }

    return executablePath;
}

module.exports = {
    findExecutable
};
