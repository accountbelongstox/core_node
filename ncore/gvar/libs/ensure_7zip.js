import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import systemInfo from './system_info.js';
import findBin from './find_bin.js';

class Ensure7Zip {
    constructor() {
        this.windows7zUrl = 'https://www.7-zip.org/a/7z2408-x64.exe';
        this.linux7zUrl = 'https://www.7-zip.org/a/7z2408-linux-x64.tar.xz';
    }

    downloadAndInstall = (destDir) => {
        try {
            // Check if 7zip already exists in system
            const existing7z = findBin.findBin('7z', [
                destDir,
                '/usr/bin',
                '/usr/local/bin',
                'C:\\Program Files\\7-Zip',
                'C:\\Program Files (x86)\\7-Zip'
            ]);

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
            execSync(`"${executablePath}" i`, { stdio: 'ignore' });
            return true;
        } catch (error) {
            console.error('7-Zip executable verification failed:', error);
            return false;
        }
    }
}

export default new Ensure7Zip(); 