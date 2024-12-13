import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import systemInfo from './system_info.js';
import findBin from './find_bin.js';
import logger from '#@utils_logger';

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

            if (existing7z) {
                console.log('Found existing 7-Zip installation at:', existing7z);
                return existing7z;
            }

            // Create destination directory if not exists
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            const downloadUrl = systemInfo.isWindows() ? this.windows7zUrl : this.linux7zUrl;
            const fileName = path.basename(downloadUrl);
            const filePath = path.join(destDir, fileName);

            console.log('Initiating 7-Zip download from:', downloadUrl);

            // Attempt download with curl, fallback to wget
            try {
                execSync(`curl -L "${downloadUrl}" -o "${filePath}"`);
            } catch (curlError) {
                // Fallback to wget if curl fails
                execSync(`wget "${downloadUrl}" -O "${filePath}"`);
            }

            // Process downloaded file based on platform
            if (systemInfo.isWindows()) {
                // On Windows, rename the exe file
                const targetPath = path.join(destDir, '7z.exe');
                fs.renameSync(filePath, targetPath);
                return targetPath;
            } else {
                // On Linux, extract tar.xz and cleanup
                execSync(`tar -xf "${filePath}" -C "${destDir}"`);
                fs.unlinkSync(filePath); // Remove archive after extraction
                return path.join(destDir, '7z');
            }
        } catch (error) {
            console.error('7-Zip installation process failed:', error);
            throw error;
        }
    }

    verify = (executablePath) => {
        try {
            const version = execSync(`"${executablePath}" | findstr /i "7-Zip"`, { stdio: 'ignore', encoding: 'utf8' });
            logger.info(`7-Zip version: ${version}`);
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
            execSync(command);

            if (!fs.existsSync(installerPath)) {
                throw new Error('Failed to download 7-Zip installer');
            }

            // Install silently
            logger.info(`Installing 7-Zip to ${installDir}...`);
            execSync(`"${installerPath}" /S /D=${installDir}`);

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

export default new Ensure7Zip(); 