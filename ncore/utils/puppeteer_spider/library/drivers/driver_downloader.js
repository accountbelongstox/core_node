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
const https = require('https');
const http = require('http');
const logger = require('#@logger');
const { execSync } = require('child_process');

// Declare variables
const DRIVER_TYPES = {
    CHROME: 'chrome',
    EDGE: 'edge'
};

const PLATFORMS = {
    WIN32: 'win32',
    LINUX: 'linux',
    DARWIN: 'darwin'
};

class DriverDownloader {
    constructor() {
        this.platform = process.platform;
        this.arch = process.arch;
        this.driversDir = path.join(__dirname, '../../drivers');
        this.chromeVersionMapper = null;
        this.edgeVersionMapper = null;
    }

    // Initialize version mappers
    async initializeVersionMappers() {
        try {
            this.chromeVersionMapper = require('../version_mappers/chrome.js');
            this.edgeVersionMapper = require('../version_mappers/edge.js');
        } catch (error) {
            logger.warn('Failed to load version mappers:', error.message);
        }
    }

    // Get Chrome driver download URL
    getChromeDriverUrl(version) {
        const platformMap = {
            'win32': 'win32',
            'linux': 'linux64',
            'darwin': 'mac64'
        };

        const platform = platformMap[this.platform] || 'linux64';
        return `https://chromedriver.storage.googleapis.com/${version}/chromedriver_${platform}.zip`;
    }

    // Get Edge driver download URL
    getEdgeDriverUrl(version) {
        const platformMap = {
            'win32': 'win64',
            'linux': 'linux64',
            'darwin': 'mac64'
        };

        const platform = platformMap[this.platform] || 'linux64';
        return `https://msedgedriver.azureedge.net/${version}/edgedriver_${platform}.zip`;
    }

    // Download file from URL
    async downloadFile(url, destination) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;
            
            const file = fs.createWriteStream(destination);
            
            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve(destination);
                });
                
                file.on('error', (error) => {
                    fs.unlink(destination, () => {});
                    reject(error);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    // Extract ZIP file
    async extractZip(zipPath, extractDir) {
        try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractDir, true);
            
            // Clean up zip file
            fs.unlinkSync(zipPath);
            
            return extractDir;
        } catch (error) {
            logger.error('Failed to extract ZIP file:', error.message);
            throw error;
        }
    }

    // Make file executable (Linux/macOS)
    makeExecutable(filePath) {
        if (this.platform !== 'win32') {
            try {
                fs.chmodSync(filePath, '755');
            } catch (error) {
                logger.warn('Failed to make file executable:', error.message);
            }
        }
    }

    // Download Chrome driver
    async downloadChromeDriver(puppeteerVersion = null) {
        try {
            await this.initializeVersionMappers();
            
            let chromeVersion;
            if (puppeteerVersion && this.chromeVersionMapper) {
                chromeVersion = this.chromeVersionMapper.getChromeVersion(puppeteerVersion);
            } else {
                // Try to get Chrome version from installed Chrome
                chromeVersion = await this.getInstalledChromeVersion();
            }
            
            if (!chromeVersion) {
                throw new Error('Could not determine Chrome version');
            }
            
            logger.info(`Downloading Chrome driver for version: ${chromeVersion}`);
            
            const driverUrl = this.getChromeDriverUrl(chromeVersion);
            const zipPath = path.join(this.driversDir, `chromedriver_${chromeVersion}.zip`);
            const extractDir = path.join(this.driversDir, 'chrome');
            
            // Create directories
            fs.mkdirSync(this.driversDir, { recursive: true });
            fs.mkdirSync(extractDir, { recursive: true });
            
            // Download driver
            await this.downloadFile(driverUrl, zipPath);
            
            // Extract driver
            await this.extractZip(zipPath, extractDir);
            
            // Find driver executable
            const driverExecutable = this.findDriverExecutable(extractDir, 'chromedriver');
            if (driverExecutable) {
                this.makeExecutable(driverExecutable);
                logger.info(`Chrome driver downloaded and extracted to: ${driverExecutable}`);
                return driverExecutable;
            } else {
                throw new Error('Chrome driver executable not found after extraction');
            }
            
        } catch (error) {
            logger.error('Failed to download Chrome driver:', error.message);
            throw error;
        }
    }

    // Download Edge driver
    async downloadEdgeDriver(puppeteerVersion = null) {
        try {
            await this.initializeVersionMappers();
            
            let edgeVersion;
            if (puppeteerVersion && this.edgeVersionMapper) {
                edgeVersion = this.edgeVersionMapper.getEdgeVersion(puppeteerVersion);
            } else {
                // Try to get Edge version from installed Edge
                edgeVersion = await this.getInstalledEdgeVersion();
            }
            
            if (!edgeVersion) {
                throw new Error('Could not determine Edge version');
            }
            
            logger.info(`Downloading Edge driver for version: ${edgeVersion}`);
            
            const driverUrl = this.getEdgeDriverUrl(edgeVersion);
            const zipPath = path.join(this.driversDir, `edgedriver_${edgeVersion}.zip`);
            const extractDir = path.join(this.driversDir, 'edge');
            
            // Create directories
            fs.mkdirSync(this.driversDir, { recursive: true });
            fs.mkdirSync(extractDir, { recursive: true });
            
            // Download driver
            await this.downloadFile(driverUrl, zipPath);
            
            // Extract driver
            await this.extractZip(zipPath, extractDir);
            
            // Find driver executable
            const driverExecutable = this.findDriverExecutable(extractDir, 'msedgedriver');
            if (driverExecutable) {
                this.makeExecutable(driverExecutable);
                logger.info(`Edge driver downloaded and extracted to: ${driverExecutable}`);
                return driverExecutable;
            } else {
                throw new Error('Edge driver executable not found after extraction');
            }
            
        } catch (error) {
            logger.error('Failed to download Edge driver:', error.message);
            throw error;
        }
    }

    // Find driver executable in directory
    findDriverExecutable(dir, driverName) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                const found = this.findDriverExecutable(filePath, driverName);
                if (found) return found;
            } else if (file.includes(driverName)) {
                return filePath;
            }
        }
        
        return null;
    }

    // Get installed Chrome version
    async getInstalledChromeVersion() {
        try {
            const ChromeFinder = require('../browsers/chrome/finder');
            const finder = new ChromeFinder();
            const chromeInfo = finder.getChromeInfo();
            
            if (chromeInfo && chromeInfo.version) {
                // Extract version number from version string
                const versionMatch = chromeInfo.version.match(/(\d+\.\d+\.\d+\.\d+)/);
                return versionMatch ? versionMatch[1] : null;
            }
            
            return null;
        } catch (error) {
            logger.debug('Failed to get installed Chrome version:', error.message);
            return null;
        }
    }

    // Get installed Edge version
    async getInstalledEdgeVersion() {
        try {
            const EdgeFinder = require('../browsers/edge/finder');
            const finder = new EdgeFinder();
            const edgeInfo = finder.getEdgeInfo();
            
            if (edgeInfo && edgeInfo.version) {
                // Extract version number from version string
                const versionMatch = edgeInfo.version.match(/(\d+\.\d+\.\d+\.\d+)/);
                return versionMatch ? versionMatch[1] : null;
            }
            
            return null;
        } catch (error) {
            logger.debug('Failed to get installed Edge version:', error.message);
            return null;
        }
    }

    // Check if driver is already downloaded
    isDriverDownloaded(driverType, version) {
        const driverDir = path.join(this.driversDir, driverType);
        
        if (!fs.existsSync(driverDir)) {
            return false;
        }
        
        const files = fs.readdirSync(driverDir);
        const driverName = driverType === 'chrome' ? 'chromedriver' : 'msedgedriver';
        
        return files.some(file => file.includes(driverName));
    }

    // Get driver path if exists
    getDriverPath(driverType) {
        const driverDir = path.join(this.driversDir, driverType);
        
        if (!fs.existsSync(driverDir)) {
            return null;
        }
        
        const driverExecutable = this.findDriverExecutable(driverDir, driverType === 'chrome' ? 'chromedriver' : 'msedgedriver');
        return driverExecutable;
    }

    // Clean up old drivers
    async cleanupOldDrivers(driverType, keepLatest = 3) {
        try {
            const driverDir = path.join(this.driversDir, driverType);
            
            if (!fs.existsSync(driverDir)) {
                return;
            }
            
            const files = fs.readdirSync(driverDir);
            const driverFiles = files.filter(file => 
                file.includes(driverType === 'chrome' ? 'chromedriver' : 'msedgedriver')
            );
            
            if (driverFiles.length > keepLatest) {
                // Sort by modification time (newest first)
                const sortedFiles = driverFiles
                    .map(file => ({
                        name: file,
                        path: path.join(driverDir, file),
                        mtime: fs.statSync(path.join(driverDir, file)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                
                // Remove oldest files
                const filesToRemove = sortedFiles.slice(keepLatest);
                for (const file of filesToRemove) {
                    fs.unlinkSync(file.path);
                    logger.info(`Removed old driver: ${file.name}`);
                }
            }
        } catch (error) {
            logger.warn('Failed to cleanup old drivers:', error.message);
        }
    }

    // Get driver info
    getDriverInfo() {
        return {
            platform: this.platform,
            arch: this.arch,
            driversDir: this.driversDir,
            chromeDriverPath: this.getDriverPath('chrome'),
            edgeDriverPath: this.getDriverPath('edge'),
            chromeDriverDownloaded: this.isDriverDownloaded('chrome'),
            edgeDriverDownloaded: this.isDriverDownloaded('edge')
        };
    }
}

// Export both class and module for compatibility
module.exports = DriverDownloader;
module.exports.DriverDownloader = DriverDownloader;
