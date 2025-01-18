const fs = require('fs');
const path = require('path');
const os = require('os');
const systemInfo = require('../system_info.js');
let log= {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    success: (...args) => console.log('[SUCCESS]', ...args),
    debug: (...args) => console.log('[DEBUG]', ...args)
};

const { smartInstaller } = require('../../tool/soft-install/index.js');
const { pipeExecCmd } = require('../../tool/common/cmder.js');
const fileFinder = require('../../tool/common/ffinder.js');
const isWindows = os.platform() === 'win32';
const initializedInstall = {
    "7zip": {
        install:false,
        search:false,
    }
}

class Ensure7Zip {
    constructor() {
        this.windows7zUrl = 'https://www.7-zip.org/a/7z2408-x64.exe';
        this.linux7zUrl = 'https://www.7-zip.org/a/7z2408-linux-x64.tar.xz';
        this.defaultInstallDir = systemInfo.isWindows() ? 'D:\\lang_compiler\\7z' : '/usr/bin';
    }

    ensure7zip = async () => {
        const exeBy7zName = isWindows ? '7z.exe' : '7z';
        if (fileFinder.isFinderCacheValid(exeBy7zName)) {
            return fileFinder.readCacheByKey(exeBy7zName);
        }
        let exeBy7zPath = null
        log.warn(`No cached 7-Zip path found, proceeding to find or install 7-Zip...`);
        if (!initializedInstall["7zip"].install) {
            initializedInstall["7zip"].install = true
            await smartInstaller.smartInstall('7zip');
        }
        if (!initializedInstall["7zip"].search) {
            initializedInstall["7zip"].search = true
            exeBy7zPath = await fileFinder.findByCommonInstallDir(exeBy7zName);
        }
        if(exeBy7zPath){
            fileFinder.saveCacheByKey(exeBy7zName,exeBy7zPath);
        }
        return exeBy7zPath;
    }

    verify = (executablePath) => {
        try {
            let cmd = ``;
            if (systemInfo.isWindows()) {
                cmd = `"${executablePath}" | findstr /i "7-Zip"`;
            } else {
                cmd = `"${executablePath}" | grep -i "7-Zip"`;
            }
            console.log(`Executing command: ${cmd}`);
            const version = pipeExecCmd(cmd);
            return true;
        } catch (error) {
            console.error('7-Zip executable verification failed:', error);
            return false;
        }
    }

    /**
     * Install 7-Zip using batch script logic
     * @param {string} installDir - Installation directory
     * @returns {string} Path to 7z executable
     */
    installUsingSilentMode(installDir) {
        const tempDir = path.join(installDir, 'tmp');
        const exePath = path.join(installDir, '7z.exe');
        const installerPath = path.join(tempDir, '7z-installer.exe');
        const downloadUrl = 'https://www.7-zip.org/a/7z2301-x64.exe';

        // Create temp directory if not exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Skip if already installed
        if (fs.existsSync(exePath)) {
            log.info('7-Zip already installed, skipping installation.');
            return exePath;
        }

        // Clean up old installer if exists
        if (fs.existsSync(installerPath)) {
            log.info('Removing old 7-Zip installer...');
            fs.unlinkSync(installerPath);
        }

        try {
            // Download installer
            log.info('Downloading 7-Zip installer...');
            const command = `curl -L "${downloadUrl}" -o "${installerPath}"`;
            pipeExecCmd(command);

            if (!fs.existsSync(installerPath)) {
                throw new Error('Failed to download 7-Zip installer');
            }

            // Install silently
            log.info(`Installing 7-Zip to ${installDir}...`);
            pipeExecCmd(`"${installerPath}" /S /D=${installDir}`);

            // Verify installation
            if (fs.existsSync(exePath)) {
                log.success('7-Zip installed successfully');
                return exePath;
            } else {
                throw new Error('7-Zip installation failed - executable not found');
            }
        } catch (error) {
            log.error('7-Zip installation failed:', error.message);
            throw error;
        } finally {
            // Clean up installer
            if (fs.existsSync(installerPath)) {
                try {
                    fs.unlinkSync(installerPath);
                } catch (error) {
                    log.warning('Failed to clean up installer:', error.message);
                }
            }
        }
    }
}

module.exports = new Ensure7Zip();