const path = require('path');
const fs = require('fs');
const { execCmdResultText, execPowerShell } = require('../common/cmder.js');
const wingetManager = require('../winget/winget.js');
const fileFinder = require('../common/ffinder.js');

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

class WindowsSoftwareFinder {
    constructor() {
        this.searchPaths = [
            'C:\\Program Files',
            'C:\\Program Files (x86)',
            'D:\\Program Files',
            'D:\\Program Files (x86)',
            'D:\\applications',
            'D:\\lang_compiler'
        ];
    }

    async findSoftware(softwareName, forceDeepSearch = false, maxDepth = 2, useCache = true) {
        if (useCache && fileFinder.isFinderCacheValid(softwareName)) {
            return fileFinder.getFinderCache(softwareName);
        }
        const exeName = softwareName.toLowerCase().endsWith('.exe') ?
            softwareName : `${softwareName}.exe`;


        const wherePath = await execCmdResultText(`where ${exeName}`, true, null);
        if (wherePath.trim()) {
            const firstPath = wherePath.split('\n')[0].trim();
            if (fs.existsSync(firstPath)) {
                fileFinder.saveCacheByPath(firstPath, firstPath);
                return firstPath;
            }
        }

        const psCommand = `Get-Command ${exeName.replace('.exe', '')}`;
        const result = await execPowerShell(psCommand, false, null);
        if (result) {
            const resultSplit = result.split(/\-+\s+\-+/);
            for (const line of resultSplit) {
                const lineTrim = line.trim();
                lineTrim.split
                console.log(`line: ${lineTrim}`);
                if (lineTrim) {
                    const exePathText = lineTrim.trim();
                    const driverPositionReg = /[A-Z]\:/;
                    const driverPosition = exePathText.search(driverPositionReg);
                    if (driverPosition !== -1) {
                        const driver = driverPosition ? driverPosition[0] : '';
                        const exeName = exePathText.substring(0, driverPosition ).trim();
                        const exeFullPath = exePathText.substring(driverPosition ).trim();
                        if (exeFullPath && path.isAbsolute(exeFullPath) && fs.existsSync(exeFullPath)) {
                            fileFinder.saveCacheByPath(exeFullPath, exeFullPath);
                            return exeFullPath;
                        }

                    }
                }
            }
        }

        let searched = false;
        // Check if installed by winget
        try {
            const packageId = softwareName.toLowerCase().replace('.exe', '');
            const installed = await wingetManager.isPackageInstalled(packageId);
            if (installed) {
                log.debug(`${softwareName} is installed by winget, searching in program directories...`);
                searched = true;
                return await fileFinder.findByCommonInstallDir(exeName, { deepSearch: forceDeepSearch, useCache, maxDepth });
            } else {
                log.debug(`${softwareName} is not installed by winget`);
            }
        } catch (error) {
            log.debug('Winget check failed:', error.message);
        }

        if (forceDeepSearch && !searched) {
            return await fileFinder.findByCommonInstallDir(exeName, { deepSearch: true, useCache, maxDepth });
        }

        return null;
    }

}

const softwareFinder = new WindowsSoftwareFinder();
module.exports = softwareFinder;

// Test code
if (require.main === module) {
    async function test() {
        const finder = new WindowsSoftwareFinder();

        // Test findFirstFile
        log.info('\nTesting findFirstFile:');
        const pythonPath = await finder.findSoftware('python.exe');
        log.info('Python first occurrence:', pythonPath || 'Not found');

        // Test findAllFiles
        log.info('\nTesting findAllFiles:');
        const allPythonPaths = await finder.findSoftware('python.exe');
        log.info('All Python occurrences:', allPythonPaths);

        // Original tests...
        log.info('\nTesting original findSoftware:');
        const testSoftware = ['git', 'python', '7z', 'node.exe'];
        for (const software of testSoftware) {
            log.info(`\nSearching for ${software}...`);
            const path = await finder.findSoftware(software);
            log.info(`Result: ${path || 'Not found'}`);
        }
    }

    test().catch(error => {
        log.error('Test failed:', error);
        process.exit(1);
    });
} 