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

const fs = require('fs');
const path = require('path');
const { install } = require('@puppeteer/browsers');
const logger = require('#@logger');
const gconfig = require('#@gconfig');
const commander = require('#@commander');
const chromeVersionManager = require('./chrome-version.js');

class PuppeteerChromeFinder {
    constructor() {
        this.defaultChromeDir = path.join(gconfig.APP_INSTALL_DIR, 'Google');
        this.baseDirsWindows = [
            'C:\\Program Files\\Google\\Chrome\\Application',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application',
            this.defaultChromeDir,
            path.join(gconfig.APP_INSTALL_DIR, 'Chrome'),
            gconfig.APP_INSTALL_DIR
        ];
    }

    /**
     * Find Chrome executable in system
     * @returns {Object} Chrome info object with path and version
     */
    async findPuppeteerCompatibleChrome() {
        // Check environment variable first
        if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
            const version = await this.getChromeVersion(process.env.CHROME_BIN);
            logger.info(`Chrome found from environment: ${process.env.CHROME_BIN} (version: ${version})`);
            return { path: process.env.CHROME_BIN, version: version };
        }

        // Check global paths
        const globalChromeInfo = await this.checkGlobalPuppeteerCompatibleChrome();
        if (globalChromeInfo) {
            return globalChromeInfo;
        }

        // Search in common directories
        const searchChromeInfo = await this.findPuppeteerCompatibleChromeExecutable(this.baseDirsWindows);
        if (searchChromeInfo) {
            return searchChromeInfo;
        }

        // Try to install compatible Chrome if not found
        logger.warn('Compatible Chrome not found. Attempting to install...');
        return await this.ensurePuppeteerCompatibleChrome();
    }

    /**
     * Check global Chrome paths for compatibility
     * @returns {Object|null} Chrome info object or null
     */
    async checkGlobalPuppeteerCompatibleChrome() {
        const isWindows = process.platform === 'win32';
        const linuxPaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
        ];

        const macPaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ];

        const pathsToCheck = isWindows ? this.baseDirsWindows : 
                           process.platform === 'darwin' ? macPaths : linuxPaths;

        for (const chromePath of pathsToCheck) {
            const chromeExec = isWindows ? path.join(chromePath, 'chrome.exe') : chromePath;
            if (fs.existsSync(chromeExec)) {
                const version = await this.getChromeVersion(chromeExec);
                if (chromeVersionManager.isChromeVersionCompatible(version)) {
                    logger.info(`Compatible Chrome found at: ${chromeExec} (version: ${version})`);
                    return { path: chromeExec, version: version };
                } else {
                    logger.warn(`Incompatible Chrome found at: ${chromeExec} (version: ${version})`);
                }
            }
        }
        return null;
    }

    /**
     * Find compatible Chrome executable in directories
     * @param {Array} dirs - Directories to search
     * @returns {Object|null} Chrome info object or null
     */
    async findPuppeteerCompatibleChromeExecutable(dirs) {
        const executableName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';
        let fallbackChrome = null;

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                continue;
            }

            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);

                    if (stat.isDirectory()) {
                        const subDirResult = await this.findPuppeteerCompatibleChromeExecutable([filePath]);
                        if (subDirResult) {
                            return subDirResult;
                        }
                    } else if (file === executableName) {
                        const version = await this.getChromeVersion(filePath);
                        if (chromeVersionManager.isChromeVersionCompatible(version)) {
                            logger.info(`Compatible Chrome found at: ${filePath} (version: ${version})`);
                            return { path: filePath, version: version };
                        } else {
                            if (!fallbackChrome) {
                                fallbackChrome = { path: filePath, version: version };
                            }
                            logger.warn(`Incompatible Chrome found at: ${filePath} (version: ${version})`);
                        }
                    }
                }
            } catch (error) {
                logger.warn(`Error reading directory ${dir}: ${error.message}`);
            }
        }

        if (fallbackChrome) {
            logger.warn(`Using fallback Chrome at: ${fallbackChrome.path} (version: ${fallbackChrome.version})`);
            return fallbackChrome;
        }

        return null;
    }

    /**
     * Get Chrome version from executable
     * @param {string} chromePath - Chrome executable path
     * @returns {string} Chrome version
     */
    async getChromeVersion(chromePath) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            let versionCommand;
            if (process.platform === 'win32') {
                versionCommand = `"${chromePath}" --version`;
            } else {
                versionCommand = `${chromePath} --version`;
            }
            
            const { stdout } = await execAsync(versionCommand);
            const versionMatch = stdout.match(/(\d+\.\d+\.\d+\.\d+)/);
            return versionMatch ? versionMatch[1] : 'unknown';
        } catch (error) {
            logger.warn(`Failed to get Chrome version from ${chromePath}: ${error.message}`);
            return 'unknown';
        }
    }

    /**
     * Ensure compatible Chrome is installed
     * @returns {Object} Chrome info object
     */
    async ensurePuppeteerCompatibleChrome() {
        try {
            const compatibleVersion = chromeVersionManager.getCompatibleChromeVersion();
            logger.info(`Installing Chrome version ${compatibleVersion} for Puppeteer compatibility`);
            logger.info(`Download directory: ${this.defaultChromeDir}`);

            let lastProgress = 0;
            const result = await install({
                browser: 'chrome',
                buildId: compatibleVersion,
                cacheDir: this.defaultChromeDir,
                downloadProgressCallback: (downloadedBytes, totalBytes) => {
                    const percent = Math.floor((downloadedBytes / totalBytes) * 100);
                    if (percent > lastProgress && percent % 10 === 0) {
                        const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
                        const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
                        logger.info(`Chrome download progress: ${percent}% (${downloadedMB}MB / ${totalMB}MB)`);
                        lastProgress = percent;
                    }
                }
            });

            logger.success('Chrome installation completed.');

            if (result && result.executablePath && fs.existsSync(result.executablePath)) {
                logger.info(`Installed Chrome at: ${result.executablePath}`);
                const version = await this.getChromeVersion(result.executablePath);
                return { path: result.executablePath, version: version };
            }

            logger.info('Searching for installed Chrome in cache directory...');
            const installedChromeInfo = await this.findPuppeteerCompatibleChromeExecutable([
                this.defaultChromeDir,
                ...this.baseDirsWindows
            ]);

            if (installedChromeInfo) {
                logger.info(`Installed compatible Chrome found at: ${installedChromeInfo.path} (version: ${installedChromeInfo.version})`);
                return installedChromeInfo;
            } else {
                logger.error('Chrome was installed, but executable not found.');
                return null;
            }
        } catch (error) {
            logger.error(`Failed to install Chrome: ${error.message}`);
            return null;
        }
    }

    /**
     * Kill Chrome processes by PID
     * @param {number} pid - Process ID to kill
     */
    async killPuppeteerChromeProcess(pid) {
        try {
            if (process.platform === 'win32') {
                await commander.exec(`taskkill /F /PID ${pid}`);
            } else {
                await commander.exec(`kill -9 ${pid}`);
            }
            logger.info(`Killed Chrome process: ${pid}`);
        } catch (error) {
            logger.error(`Failed to kill Chrome process ${pid}: ${error.message}`);
        }
    }

    /**
     * Kill all Chrome processes
     */
    async killAllPuppeteerChromeProcesses() {
        try {
            if (process.platform === 'win32') {
                await commander.exec('taskkill /F /IM chrome.exe');
            } else {
                await commander.exec('pkill -f chrome');
            }
            logger.info('Killed all Chrome processes');
        } catch (error) {
            logger.error(`Failed to kill Chrome processes: ${error.message}`);
        }
    }
}

module.exports = new PuppeteerChromeFinder(); 