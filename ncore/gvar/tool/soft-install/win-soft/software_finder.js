const path = require('path');
const fs = require('fs');
const { execCmdResultText, execPowerShell } = require('../../common/cmder.js');
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
                        const exeName = exePathText.substring(0, driverPosition).trim();
                        const exeFullPath = exePathText.substring(driverPosition).trim();
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