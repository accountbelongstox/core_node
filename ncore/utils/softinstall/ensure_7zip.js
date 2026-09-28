const fs = require('fs');
const path = require('path');
const os = require('os');
const log = require('#@logger');

const { smartInstaller } = require('./index.js');
const { pipeExecCmd, execCmdResultText } = require('#@ncore/global_vars/tool/common/cmder.js');
const fileFinder = require('./ffinder.js');
const { findExecutable } = require('./executable_finder.js');
const gConfig = require('#@gconfig');
const langdir = gConfig.DEV_LANG_DIR;
const the7zDefaultDir = path.join(langdir, '7z/7z.exe');
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
        let exeBy7zPath = null;
        try {
            const is7zDefaultDirExists = fs.existsSync(the7zDefaultDir);
            if (is7zDefaultDirExists) {
                exeBy7zPath = the7zDefaultDir;
            }
        } catch (error) {
            log.error(error);
        }
        
        exeBy7zPath = exeBy7zPath || await findExecutable(exeBy7zName);
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