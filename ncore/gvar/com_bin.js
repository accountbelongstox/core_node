import os from 'os';
import path from 'path';
// import sys from 'sys';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import Base from '#@base';
import { platform } from 'process';
// import { gdir } from 'pycore.globalvar.gdir';
import crypto from 'crypto';
import download_manager from './tool/download_manager.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);


class CommBin extends Base {
    constructor() {
        super()
        this.binCache = {};
        this.baseConfig = this.getBaseConfig()
    }

    getTarExecutable() {
        return this.findBin('tar', [
            'C:\\Windows\\System32'
        ]);
    }

    getCurlExecutable() {
        return this.findBin('curl', [
            'C:\\Windows\\System32'
        ]);
    }

    getGitExecutable() {
        return this.findBin('git', [
            'D:\\applications\\Git\\cmd',
            'C:\\Program Files\\Git\\cmd',
            'C:\\Program Files (x86)\\Git\\cmd'
        ]);
    }

    getDDwinExecutable() {
        return this.findBin('ddwin', []);
    }

    getPhpExecutable() {
        return this.findBin('php');
    }

    get7zExecutable() {
        const downloadDir = this.baseConfig.appPlatformBinDir;

        let executable = this.findBin('7z', [
            downloadDir,
            '/usr/bin',
            '/usr/local/bin',
            'C:\\Program Files\\7-Zip',
            'C:\\Program Files (x86)\\7-Zip'
        ]);
        if (!executable) {
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }

            let downloadUrl = this.localDownloadUrl(`/softlist/lang_compiler/7z.tar`);
            console.log(`downloadUrl-get7zExecutable`, downloadUrl)
            // if (os.platform() === 'win32') {
            //     downloadUrl = this.localDownloadUrl(`7z.tar`); // Example URL, replace with actual
            // } else if (os.platform() === 'linux') {
            //     downloadUrl = 'https://www.7-zip.org/a/7z2107-linux-x64.tar.xz'; // Example URL, replace with actual
            // } else {
            //     console.error('Unsupported platform for 7z download.');
            //     return '';
            // }

            try {
                download_manager.downloadAndExtractCurl(downloadUrl, downloadDir);
                // executable = path.join(downloadDir, os.platform() === 'win32' ? '7z.exe' : '7z');
                executable = path.join(downloadDir, os.platform() === 'win32' ? '7z.exe' : '7z');
            } catch (error) {
                console.error('Failed to download 7z:', error);
                return '';
            }
        }

        return executable;
    }

    localDownloadUrl(fp = '') {
        return `${this.baseConfig.localStaticHttpsApiUrl}/src/download.php?file=${fp}`;
    }

    findBin(executable, additionalDirs = []) {
        if (this.binCache[executable]) {
            return this.binCache[executable];
        }

        const defaultDepth = 10;
        let executablePath = null;

        if (this.isWindows()) {
            executablePath = this.findBinOnWindows(executable, additionalDirs);
        } else {
            executablePath = this.findBinOnUnix(executable, additionalDirs);
        }

        if (!executablePath) {
            const findDirs = [path.dirname(path.dirname(process.execPath))];
            executablePath = this.recursiveSearch(findDirs, executable, defaultDepth);
        }

        if (executablePath) {
            this.binCache[executable] = executablePath;
        }

        return executablePath;
    }

    findBinOnWindows(executable, additionalDirs) {
        let executablePath = null;
        const findDirs = [
            ...additionalDirs,
            'C:\\Program Files\\',
            'C:\\Program Files (x86)\\',
            'C:\\Windows\\System32\\',
            'C:\\Windows\\',
            this.baseConfig.DEV_LANG_DIR,
            this.baseConfig.APP_INSTALL_DIR,
            path.join(this.baseConfig.DEV_LANG_DIR, `environments`),
        ];

        if (!executable.endsWith('.exe')) {
            executable += '.exe';
        }

        for (const dir of findDirs) {
            const fullPath = path.join(dir, executable);
            if (fs.existsSync(fullPath)) {
                executablePath = fullPath;
                break;
            }
        }

        if (!executablePath) {
            try {
                const result = execSync(`where ${executable}`, { encoding: 'utf-8' });
                if (result) {
                    executablePath = result.split('\r\n')[0];
                }
            } catch {
                // Ignore errors
            }
        }

        return executablePath;
    }

    findBinOnUnix(executable, additionalDirs) {
        let executablePath = null;
        const findDirs = [
            '/usr/bin/',
            '/usr/local/bin/',
            '/opt/local/bin/',
            '/usr/lib/git-core/',
            '/bin/',
            ...additionalDirs
        ];

        for (const dir of findDirs) {
            const fullPath = path.join(dir, executable);
            if (fs.existsSync(fullPath)) {
                executablePath = fullPath;
                break;
            }
        }

        if (!executablePath) {
            try {
                const result = execSync(`which ${executable}`, { encoding: 'utf-8' });
                if (result) {
                    executablePath = result.trim();
                }
            } catch {
                // Ignore errors
            }
        }

        return executablePath;
    }

    recursiveSearch(dirs, executable, depth) {
        if (depth === 0) {
            return null;
        }

        for (const dir of dirs) {
            for (const root of fs.readdirSync(dir, { withFileTypes: true })) {
                if (root.isDirectory()) {
                    const subdir = path.join(dir, root.name);
                    const result = this.recursiveSearch([subdir], executable, depth - 1);
                    if (result) {
                        return result;
                    }
                } else if (root.isFile() && root.name === executable) {
                    return path.join(dir, root.name);
                }
            }
        }

        return null;
    }

    isWindows() {
        return platform === 'win32';
    }

    getSystemToken() {
        const systemPlatform = os.platform();
        const release = os.release();
        const version = os.version();
        const machine = os.machine();
        const node = os.hostname();
        const processor = os.arch();
        const filesystemInfo = fs.statSync('/').dev;
        const uniqueString = `${systemPlatform}-${release}-${version}-${machine}-${node}-${processor}-${filesystemInfo}`;
        return uniqueString;
    }

    getSystemId() {
        const uniqueString = this.getSystemToken();
        return crypto.createHash('sha256').update(uniqueString).digest('hex');
    }
}

export default new CommBin();
