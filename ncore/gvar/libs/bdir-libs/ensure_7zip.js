const fs = require('fs');
const path = require('path');
const os = require('os');
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

const { smartInstaller } = require('../../tool/soft-install/index.js');
const { pipeExecCmd, execCmdResultText } = require('../../tool/common/cmder.js');
const fileFinder = require('../../tool/common/ffinder.js');
const { findExecutable } = require('../../tool/soft-install/executable_finder.js');
const isWindows = os.platform() === 'win32';
const initializedInstall = {
    "7zip": {
        install: false,
        search: false,
    }
}

class Ensure7Zip {
    constructor() {
    }

    ensure7zip = async () => {
        const totalStartTime = Date.now();
        let stepStartTime;
        const exeBy7zName = isWindows ? '7z.exe' : '7z';

        // Check cache
        stepStartTime = Date.now();
        if (fileFinder.isFinderCacheValid(exeBy7zName)) {
            const exePath = fileFinder.readCacheByKey(exeBy7zName);
            log.info(`Cache check completed in ${Date.now() - stepStartTime}ms`);

            // Get version from cache
            stepStartTime = Date.now();
            const version = await this.getVersion(exePath);
            if (version) {
                log.info(`Found 7-Zip in cache: ${exePath}`);
                log.info(`Version: ${version}`);
                log.info(`Version check completed in ${Date.now() - stepStartTime}ms`);
            }
            log.info(`Total time taken: ${Date.now() - totalStartTime}ms`);
            return exePath;
        }
        log.info(`Cache check completed in ${Date.now() - stepStartTime}ms`);

        // Initial executable search
        stepStartTime = Date.now();
        let exeBy7zPath = await findExecutable(exeBy7zName);
        log.info(`Initial search completed in ${Date.now() - stepStartTime}ms`);

        if (!exeBy7zPath) {
            log.info('7z not found, attempting to install...');
            
            // Installation process
            if (!initializedInstall["7zip"].install) {
                stepStartTime = Date.now();
                await smartInstaller.smartInstall('7zip');
                await smartInstaller.smartInstall('compression');
                initializedInstall["7zip"].install = true;
                log.success('Installation completed successfully');
                log.info(`Installation completed in ${Date.now() - stepStartTime}ms`);
            }

            // Deep search after installation
            log.info('Searching for 7z executable (timeout: 20s)...');
            stepStartTime = Date.now();
            exeBy7zPath = await findExecutable(exeBy7zName, {
                timeout: 20000,
            });
            log.info(`Deep search completed in ${Date.now() - stepStartTime}ms`);

            if (exeBy7zPath) {
                stepStartTime = Date.now();
                fileFinder.saveCacheByKey(exeBy7zName, exeBy7zPath);
                log.info(`Cache save completed in ${Date.now() - stepStartTime}ms`);
            }
        }

        // Version check
        if (exeBy7zPath) {
            stepStartTime = Date.now();
            const version = await this.getVersion(exeBy7zPath);
            if (version) {
                log.info(`Found 7-Zip: ${exeBy7zPath}`);
                log.info(`Version: ${version}`);
            }
            log.info(`Version check completed in ${Date.now() - stepStartTime}ms`);
        }
        
        log.info(`Total time taken: ${Date.now() - totalStartTime}ms`);
        return exeBy7zPath;
    }

    getVersion = async (executablePath) => {
        try {
            let cmd = ``;
            if (isWindows) {
                cmd = `"${executablePath}" | findstr /i "7-Zip"`;
            } else {
                cmd = `"${executablePath}" | grep -i "7-Zip"`;
            }
            const version = await execCmdResultText(cmd);
            return version;
        } catch (error) {
            console.error('7-Zip executable verification failed:', error);
            return false;
        }
    }
}

module.exports = new Ensure7Zip();