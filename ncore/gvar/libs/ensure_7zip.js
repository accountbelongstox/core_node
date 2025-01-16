const fs = require('fs');
const path = require('path');
const os = require('os');
const systemInfo = require('./system_info.js');
const findBin = require('./find_bin.js');
const logger = require('#@utils_logger');
const { getSoftwarePath, smartInstaller } = require('../tool/soft-install/index.js');
const { pipeExecCmd } = require('#@utils_commander');
const fileFinder = require('../tool/soft-install/common/ffinder.js');
const isWindows = os.platform() === 'win32';

class Ensure7Zip {
    constructor() {
        this.windows7zUrl = 'https://www.7-zip.org/a/7z2408-x64.exe';
        this.linux7zUrl = 'https://www.7-zip.org/a/7z2408-linux-x64.tar.xz';
        this.defaultInstallDir = systemInfo.isWindows() ? 'D:\\lang_compiler\\7z' : '/usr/bin';
    }

    ensure7zip = async () => {
        const exeBy7zName = isWindows ? '7z.exe' : '7z';
        if (fileFinder.isFinderCacheValid(exeBy7zName)) {
            return fileFinder.getFinderCache(exeBy7zName);
        }
        await smartInstaller.install('7zip');
        const exeBy7zPath = fileFinder.getFinderCache(exeBy7zName);
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
            logger.info('7-Zip already installed, skipping installation.');
            return exePath;
        }

        // Clean up old installer if exists
        if (fs.existsSync(installerPath)) {
            logger.info('Removing old 7-Zip installer...');
            fs.unlinkSync(installerPath);
        }

        try {
            // Download installer
            logger.info('Downloading 7-Zip installer...');
            const command = `curl -L "${downloadUrl}" -o "${installerPath}"`;
            pipeExecCmd(command);

            if (!fs.existsSync(installerPath)) {
                throw new Error('Failed to download 7-Zip installer');
            }

            // Install silently
            logger.info(`Installing 7-Zip to ${installDir}...`);
            pipeExecCmd(`"${installerPath}" /S /D=${installDir}`);

            // Verify installation
            if (fs.existsSync(exePath)) {
                logger.success('7-Zip installed successfully');
                return exePath;
            } else {
                throw new Error('7-Zip installation failed - executable not found');
            }
        } catch (error) {
            logger.error('7-Zip installation failed:', error.message);
            throw error;
        } finally {
            // Clean up installer
            if (fs.existsSync(installerPath)) {
                try {
                    fs.unlinkSync(installerPath);
                } catch (error) {
                    logger.warning('Failed to clean up installer:', error.message);
                }
            }
        }
    }
}

module.exports = new Ensure7Zip();