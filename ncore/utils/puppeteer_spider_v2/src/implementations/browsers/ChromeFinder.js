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
            paths.push(
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
                'D:\\applications\\Google\\Chrome\\Application\\chrome.exe',
                'D:\\applications\\Chrome\\Application\\chrome.exe',
                'D:\\applications\\chrome.exe',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome Beta\\Application\\chrome.exe`,
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome Dev\\Application\\chrome.exe`,
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe`
            );
        } else if (this.platform === 'linux') {
            paths.push(
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/snap/bin/chromium',
                '/opt/google/chrome/chrome',
                '/usr/local/bin/chrome',
                '/usr/local/bin/chromium'
            );
        } else if (this.platform === 'darwin') {
            paths.push(
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
                '/usr/local/bin/chrome',
                '/usr/local/bin/chromium'
            );
        }
        
        return paths;
    }

    async find() {
        try {
            logger.info('Searching for Chrome browser...');
            
            for (const chromePath of this.chromePaths) {
                if (await this.isValidPath(chromePath)) {
                    logger.info(`Chrome found: ${chromePath}`);
                    return chromePath;
                }
            }
            
            // Try to find Chrome using system commands
            const systemPath = await this.findUsingSystemCommand();
            if (systemPath) {
                logger.info(`Chrome found via system command: ${systemPath}`);
                return systemPath;
            }
            
            logger.warn('Chrome browser not found');
            return null;
        } catch (error) {
            logger.error('Failed to find Chrome browser:', error);
            throw error;
        }
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

    async findUsingSystemCommand() {
        try {
            if (this.platform === 'win32') {
                // Try using where command
                const result = execSync('where chrome', { encoding: 'utf8', timeout: 5000 });
                const paths = result.trim().split('\n');
                for (const path of paths) {
                    if (path.trim() && await this.isValidPath(path.trim())) {
                        return path.trim();
                    }
                }
            } else {
                // Try using which command
                const commands = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
                for (const cmd of commands) {
                    try {
                        const result = execSync(`which ${cmd}`, { encoding: 'utf8', timeout: 5000 });
                        const path = result.trim();
                        if (path && await this.isValidPath(path)) {
                            return path;
                        }
                    } catch (error) {
                        // Command not found, continue
                    }
                }
            }
            return null;
        } catch (error) {
            logger.debug('System command search failed:', error.message);
            return null;
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
