const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class FindBin {
    constructor() {
        this.binCache = {};
    }

    findBin = (executable, additionalDirs = []) => {
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

    findBinOnWindows = (executable, additionalDirs) => {
        let executablePath = null;
        const findDirs = [
            ...additionalDirs,
            'C:\\Program Files\\',
            'C:\\Program Files (x86)\\',
            'C:\\Windows\\System32\\',
            'C:\\Windows\\'
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

    findBinOnUnix = (executable, additionalDirs) => {
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

    recursiveSearch = (dirs, executable, depth) => {
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

    isWindows = () => {
        return os.platform() === 'win32';
    }
}

module.exports = new FindBin();