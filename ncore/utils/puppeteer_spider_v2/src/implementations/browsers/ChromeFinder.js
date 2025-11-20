// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ChromeFinder {
    constructor() {
        this.platform = process.platform;
        this.chromePaths = this.getChromePaths();
    }

    getChromePaths() {
        const paths = [];
        
        if (this.platform === 'win32') {
            // Common paths first
            paths.push(
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
            );
            
            // Custom applications directory
            paths.push(
                'D:\\applications\\Google\\Chrome\\Application\\chrome.exe',
                'D:\\applications\\Chrome\\Application\\chrome.exe',
                'D:\\applications\\chrome.exe'
            );
            
            // Additional paths
            paths.push(
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome Beta\\Application\\chrome.exe`,
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome Dev\\Application\\chrome.exe`,
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe`
            );
        } else if (this.platform === 'linux') {
            // Common paths first
            paths.push(
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium'
            );
            
            // Additional paths
            paths.push(
                '/usr/bin/google-chrome-beta',
                '/usr/bin/google-chrome-dev',
                '/snap/bin/chromium',
                '/opt/google/chrome/chrome',
                '/opt/google/chrome-beta/chrome',
                '/opt/google/chrome-dev/chrome',
                '/usr/local/bin/google-chrome',
                '/usr/local/bin/chromium'
            );
        } else if (this.platform === 'darwin') {
            paths.push(
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
                '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev',
                '/Applications/Chromium.app/Contents/MacOS/Chromium'
            );
        }
        
        return paths;
    }

    async find() {
        try {
            logger.info('Searching for Google Chrome executable...');
            
            // Step 1: Try which command (Linux/macOS)
            if (this.platform === 'linux' || this.platform === 'darwin') {
                const whichPath = this.findChromeWithWhich();
                if (whichPath) {
                    return whichPath;
                }
            }
            
            // Step 2: Check common paths
            for (const chromePath of this.chromePaths) {
                if (fs.existsSync(chromePath)) {
                    logger.info(`Found Chrome executable: ${chromePath}`);
                    return chromePath;
                }
            }
            
            // Step 3: Scan common directories
            const scannedPath = this.scanCommonDirectories();
            if (scannedPath) {
                return scannedPath;
            }
            
            // Step 4: Wide range search
            const wideSearchPath = this.wideRangeSearch();
            if (wideSearchPath) {
                return wideSearchPath;
            }
            
            logger.warn('Google Chrome executable not found');
            return null;
        } catch (error) {
            logger.error('Failed to find Chrome browser:', error);
            throw error;
        }
    }

    findChromeWithWhich() {
        try {
            const commands = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium', 'chrome'];
            for (const cmd of commands) {
                try {
                    const result = execSync(`which ${cmd}`, { encoding: 'utf8', timeout: 5000 });
                    const path = result.trim();
                    if (path && fs.existsSync(path)) {
                        logger.info(`Found Chrome via which command: ${path}`);
                        return path;
                    }
                } catch (error) {
                    // Continue to next command
                }
            }
        } catch (error) {
            logger.debug('which command failed:', error.message);
        }
        return null;
    }

    scanCommonDirectories() {
        const commonDirs = [];
        
        if (this.platform === 'win32') {
            commonDirs.push(
                'C:\\Program Files\\Google',
                'C:\\Program Files (x86)\\Google',
                'D:\\applications',
                'D:\\applications\\Google',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google`
            );
        } else if (this.platform === 'linux') {
            commonDirs.push(
                '/usr/bin',
                '/usr/local/bin',
                '/opt',
                '/snap/bin',
                '/home/' + process.env.USER + '/.local/bin'
            );
        } else if (this.platform === 'darwin') {
            commonDirs.push(
                '/Applications',
                '/usr/local/bin',
                '/opt/homebrew/bin'
            );
        }
        
        for (const dir of commonDirs) {
            if (fs.existsSync(dir)) {
                const foundPath = this.scanDirectoryForChrome(dir);
                if (foundPath) {
                    return foundPath;
                }
            }
        }
        
        return null;
    }

    scanDirectoryForChrome(dir) {
        try {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const file of files) {
                if (file.isDirectory()) {
                    // Recursively search subdirectories (limited depth)
                    const subDir = path.join(dir, file.name);
                    if (this.shouldSearchSubdirectory(file.name)) {
                        const foundPath = this.scanDirectoryForChrome(subDir);
                        if (foundPath) {
                            return foundPath;
                        }
                    }
                } else if (file.isFile()) {
                    // Check if file is Chrome executable
                    if (this.isChromeExecutable(file.name)) {
                        const filePath = path.join(dir, file.name);
                        if (this.isValidPath(filePath)) {
                            logger.info(`Found Chrome via directory scan: ${filePath}`);
                            return filePath;
                        }
                    }
                }
            }
        } catch (error) {
            logger.debug(`Failed to scan directory ${dir}:`, error.message);
        }
        return null;
    }

    shouldSearchSubdirectory(dirName) {
        const chromeKeywords = ['chrome', 'google', 'chromium'];
        return chromeKeywords.some(keyword => 
            dirName.toLowerCase().includes(keyword)
        );
    }

    isChromeExecutable(fileName) {
        const chromeNames = ['chrome.exe', 'chrome', 'google-chrome', 'chromium'];
        return chromeNames.some(name => 
            fileName.toLowerCase().includes(name.toLowerCase())
        );
    }

    wideRangeSearch() {
        try {
            logger.info('Performing wide range search for Chrome...');
            
            if (this.platform === 'win32') {
                return this.wideRangeSearchWindows();
            } else if (this.platform === 'linux') {
                return this.wideRangeSearchLinux();
            } else if (this.platform === 'darwin') {
                return this.wideRangeSearchMacOS();
            }
        } catch (error) {
            logger.debug('Wide range search failed:', error.message);
        }
        return null;
    }

    wideRangeSearchWindows() {
        try {
            // Use where command
            const result = execSync('where chrome', { encoding: 'utf8', timeout: 10000 });
            const paths = result.trim().split('\n');
            for (const path of paths) {
                if (path.trim() && this.isValidPath(path.trim())) {
                    return path.trim();
                }
            }
        } catch (error) {
            logger.debug('Windows wide search failed:', error.message);
        }
        return null;
    }

    wideRangeSearchLinux() {
        try {
            // Use find command
            const commands = [
                'find /usr -name "*chrome*" -type f 2>/dev/null',
                'find /opt -name "*chrome*" -type f 2>/dev/null',
                'find /snap -name "*chrome*" -type f 2>/dev/null'
            ];
            
            for (const cmd of commands) {
                try {
                    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
                    const paths = result.trim().split('\n');
                    for (const path of paths) {
                        if (path.trim() && this.isValidPath(path.trim())) {
                            return path.trim();
                        }
                    }
                } catch (error) {
                    // Continue to next command
                }
            }
        } catch (error) {
            logger.debug('Linux wide search failed:', error.message);
        }
        return null;
    }

    wideRangeSearchMacOS() {
        try {
            // Use find command
            const commands = [
                'find /Applications -name "*Chrome*" -type f 2>/dev/null',
                'find /usr/local -name "*chrome*" -type f 2>/dev/null',
                'find /opt/homebrew -name "*chrome*" -type f 2>/dev/null'
            ];
            
            for (const cmd of commands) {
                try {
                    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
                    const paths = result.trim().split('\n');
                    for (const path of paths) {
                        if (path.trim() && this.isValidPath(path.trim())) {
                            return path.trim();
                        }
                    }
                } catch (error) {
                    // Continue to next command
                }
            }
        } catch (error) {
            logger.debug('macOS wide search failed:', error.message);
        }
        return null;
    }

    async isValidPath(chromePath) {
        try {
            if (fs.existsSync(chromePath)) {
                const stats = fs.statSync(chromePath);
                if (stats.isFile() && this.isExecutable(chromePath)) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    isExecutable(filePath) {
        try {
            if (this.platform === 'win32') {
                return filePath.toLowerCase().endsWith('.exe');
            } else {
                const stats = fs.statSync(filePath);
                return !!(stats.mode & parseInt('111', 8));
            }
        } catch (error) {
            return false;
        }
    }

    async getVersion(chromePath) {
        try {
            if (!chromePath) {
                chromePath = await this.find();
            }
            
            if (!chromePath) {
                return null;
            }
            
            const version = execSync(`"${chromePath}" --version`, { 
                encoding: 'utf8', 
                timeout: 10000 
            });
            
            return version.trim();
        } catch (error) {
            logger.error('Failed to get Chrome version:', error);
            return null;
        }
    }

    getInfo() {
        return {
            platform: this.platform,
            searchPaths: this.chromePaths.length,
            paths: this.chromePaths
        };
    }
}

module.exports = ChromeFinder;
