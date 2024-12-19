const fs = require('fs');
    const path = require('path');
    const systemInfo = require('./system_info.js');
    const findBin = require('./find_bin.js');
    const logger = require('#@utils_logger');
    const { pipeExecCmd } = require('#@utils_commander');

    class Ensure7Zip {
        constructor() {
            this.windows7zUrl = 'https://www.7-zip.org/a/7z2408-x64.exe';
            this.linux7zUrl = 'https://www.7-zip.org/a/7z2408-linux-x64.tar.xz';
            this.defaultInstallDir = systemInfo.isWindows() ? 'D:\\lang_compiler\\7z' : '/usr/bin';
        }

        downloadAndInstall = (destDir) => {
            try {
                const additionalDirs = systemInfo.isWindows() ?  [
                    'D:\\lang_compiler\\7z',
                    destDir,
                    'C:\\Program Files\\7-Zip',
                    'C:\\Program Files (x86)\\7-Zip'
                ] :  [
                    destDir,
                    '/usr/bin',
                    '/usr/local/bin',
                ];;
                // Check if 7zip already exists in system
                const existing7z = findBin.findBin('7z', additionalDirs);
                const existing7zz = findBin.findBin('7zz', additionalDirs);

                if (existing7z || existing7zz) {
                    console.log('Found existing 7-Zip installation at:', existing7z || existing7zz);
                    return existing7z || existing7zz;
                }

                // Create destination directory if not exists
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                const downloadUrl = systemInfo.isWindows() ? this.windows7zUrl : this.linux7zUrl;
                const fileName = path.basename(downloadUrl);
                const filePath = path.join(destDir, fileName);

                console.log(`Initiating 7-Zip download from ${downloadUrl} to ${filePath}`);

                // Attempt download with curl, fallback to wget
                try {
                    pipeExecCmd(`curl -L "${downloadUrl}" -o "${filePath}"`);
                } catch (curlError) {
                    pipeExecCmd(`wget "${downloadUrl}" -O "${filePath}"`);
                }

                // Process downloaded file based on platform
                if (systemInfo.isWindows()) {
                    // On Windows, rename the exe file
                    const targetPath = path.join(destDir, '7z.exe');
                    fs.renameSync(filePath, targetPath);
                    return targetPath;
                } else {
                    const cmd = `tar -xJf "${filePath}" -C "${destDir}"`;
                    console.log(`Executing command: ${cmd}`);
                    pipeExecCmd(cmd);
                    fs.unlinkSync(filePath); // Remove archive after extraction
                    return path.join(destDir, '7zz');
                }
            } catch (error) {
                console.error('7-Zip installation process failed:', error);
                throw error;
            }
        }

        verify = (executablePath) => {
            try {
                let cmd = ``;
                if(systemInfo.isWindows()){
                    cmd = `"${executablePath}" | findstr /i "7-Zip"`;
                }else{
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