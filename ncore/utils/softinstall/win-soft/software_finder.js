const path = require('path');
const fs = require('fs');
const { execCmdResultText, execPowerShell, execCmdShell } = require('#@ncore/global_vars/tool/common/cmder.js');
const wingetManager = require('../winget/winget.js');
const fileFinder = require('../ffinder.js');

const log = require('#@logger');

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
