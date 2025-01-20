const path = require('path');
const fs = require('fs');
const { execCmdResultText, execPowerShell, execCmdShell } = require('../../common/cmder.js');
const wingetManager = require('../winget/winget.js');
const fileFinder = require('../../common/ffinder.js');

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

    info: function(...args) {
        console.log(this.colors.cyan + '[INFO]' + this.colors.reset, ...args);
    },
    warn: function(...args) {
        console.warn(this.colors.yellow + '[WARN]' + this.colors.reset, ...args);
    },
    error: function(...args) {
        console.error(this.colors.red + '[ERROR]' + this.colors.reset, ...args);
    },
    success: function(...args) {
        console.log(this.colors.green + '[SUCCESS]' + this.colors.reset, ...args);
    },
    debug: function(...args) {
        console.log(this.colors.magenta + '[DEBUG]' + this.colors.reset, ...args);
    },
    command: function(...args) {
        console.log(this.colors.brightBlue + '[COMMAND]' + this.colors.reset, ...args);
    }
};

/**
 * Find software executable path in Windows system
 * @param {string} softwareName - Name of the software to find
 * @param {boolean} [forceDeepSearch=false] - Whether to force a deep search
 * @param {number} [maxDepth=2] - Maximum depth for deep search
 * @param {boolean} [useCache=true] - Whether to use cache
 * @returns {Promise<string|null>} Path to the software executable or null if not found
 */
async function findSoftware(softwareName, forceDeepSearch = false, maxDepth = 2, useCache = true) {
    if (useCache && fileFinder.isFinderCacheValid(softwareName)) {
        return fileFinder.getFinderCache(softwareName);
    }
    const exeName = softwareName.toLowerCase().endsWith('.exe') ?
        softwareName : `${softwareName}.exe`;

    // Try using 'where' command first with cmd shell
    const wherePath = await execCmdShell(`where ${exeName}`, true, null);
    if (wherePath.trim()) {
        const firstPath = wherePath.split('\n')[0].trim();
        if (fs.existsSync(firstPath)) {
            fileFinder.saveCacheByPath(firstPath, firstPath);
            return firstPath;
        }
    }

    // Try using PowerShell Get-Command
    const psCommand = `Get-Command ${exeName.replace('.exe', '')}`;
    const result = await execPowerShell(psCommand, false, null);
    if (result) {
        const resultSplit = result.split(/\-+\s+\-+/);
        for (const line of resultSplit) {
            const lineTrim = line.trim();
            if (lineTrim) {
                const exePathText = lineTrim.trim();
                const driverPositionReg = /[A-Z]\:/;
                const driverPosition = exePathText.search(driverPositionReg);
                if (driverPosition !== -1) {
                    const exeFullPath = exePathText.substring(driverPosition).trim();
                    if (exeFullPath && path.isAbsolute(exeFullPath) && fs.existsSync(exeFullPath)) {
                        fileFinder.saveCacheByPath(exeFullPath, exeFullPath);
                        return exeFullPath;
                    }
                }
            }
        }
    }
    return null;
}

module.exports = {
    findSoftware
};
