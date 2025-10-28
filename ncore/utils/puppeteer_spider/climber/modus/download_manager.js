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
const gconfig = require('#@gconfig');

// Declare variables
let driver = null;
let downloadConfigs = null;

class DownloadManager {
    constructor(spiderDriver) {
        driver = spiderDriver;
        downloadConfigs = gconfig.downloadConfigs || gconfig.DOWNLOADCONFIGS;
    }

    // Download application by target name
    async downloadApplication(target, options = {}) {
        if (!target) {
            throw new Error('Download target is required');
        }
        
        if (!downloadConfigs || !downloadConfigs[target]) {
            throw new Error(`Unknown download target: ${target}`);
        }
        
        if (!driver) {
            throw new Error('Driver not initialized');
        }
        
        try {
            logger.info(`Starting download for: ${target}`);
            const config = downloadConfigs[target];
            
            // Get the page from the driver
            const currentPage = await driver.encapsulatedPageFuncs.getCurrentPage();
            
            // Navigate to the download page
            await currentPage.goto(config.url, {
                timeout: config.timeout || 120000,
                waitUntil: 'networkidle2'
            });
            
            logger.info('Page loaded successfully');
            
            // Wait for the page to be fully loaded
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Use driver's Download class to find and click download link
            const pattern = new RegExp(config.filePattern, 'i');
            const result = await driver.encapsulatedDownloadFuncs.findAndClickDownloadLink(
                config.keywords,
                pattern,
                {
                    timeout: config.timeout || 300000,
                    pollInterval: 2000,
                    stableTime: 3000
                },
                currentPage
            );
            
            if (result.success) {
                logger.info(`Download completed successfully: ${result.file}`);
                return {
                    success: true,
                    file: result.file,
                    message: 'Download completed successfully'
                };
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            logger.error('Download error:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Download failed'
            };
        }
    }

    // Download image from CSS selector
    async downloadImage(selector, options = {}) {
        if (!selector) {
            throw new Error('Image selector is required');
        }
        
        if (!driver) {
            throw new Error('Driver not initialized');
        }
        
        try {
            logger.info(`Starting image download from selector: ${selector}`);
            const result = await driver.encapsulatedDownloadFuncs.saveImageFromSelector(selector);
            
            if (result.success) {
                logger.info(`Image download completed successfully: ${result.message}`);
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('Image download error:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Image download failed'
            };
        }
    }

    // Download audio from CSS selector
    async downloadAudio(selector, options = {}) {
        if (!selector) {
            throw new Error('Audio selector is required');
        }
        
        if (!driver) {
            throw new Error('Driver not initialized');
        }
        
        try {
            logger.info(`Starting audio download from selector: ${selector}`);
            const result = await driver.encapsulatedDownloadFuncs.saveAudioFromSelector(selector);
            
            if (result.success) {
                logger.info(`Audio download completed successfully: ${result.message}`);
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('Audio download error:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Audio download failed'
            };
        }
    }

    // Download file from direct URL
    async downloadFromUrl(url, options = {}) {
        if (!url) {
            throw new Error('URL is required');
        }
        
        if (!driver) {
            throw new Error('Driver not initialized');
        }
        
        try {
            logger.info(`Starting URL download: ${url}`);
            const result = await driver.encapsulatedDownloadFuncs.fetch(url, options);
            
            if (result.success) {
                logger.info(`URL download completed successfully: ${result.message}`);
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('URL download error:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'URL download failed'
            };
        }
    }

    // Get download status for all targets
    async getDownloadStatus() {
        if (!driver) {
            throw new Error('Driver not initialized');
        }
        
        try {
            const status = {};
            
            for (const [target, config] of Object.entries(downloadConfigs)) {
                const pattern = new RegExp(config.filePattern, 'i');
                const files = driver.fileMonitor.findFilesByPattern(pattern, {
                    includePartial: false,
                    sortByDate: true
                });
                
                status[target] = {
                    downloaded: files.length > 0,
                    file: files.length > 0 ? files[0] : null,
                    config: config
                };
            }
            
            return status;
        } catch (error) {
            logger.error('Failed to get download status:', error.message);
            throw error;
        }
    }

    // List available download targets
    listTargets() {
        const targets = [];
        for (const [key, downloadConfig] of Object.entries(downloadConfigs)) {
            targets.push({
                key,
                name: downloadConfig.name,
                description: downloadConfig.description,
                url: downloadConfig.url
            });
        }
        return targets;
    }

    // Check if target is already downloaded
    async isDownloaded(target) {
        if (!downloadConfigs || !downloadConfigs[target]) {
            return false;
        }
        
        if (!driver) {
            return false;
        }
        
        try {
            const config = downloadConfigs[target];
            const pattern = new RegExp(config.filePattern, 'i');
            const files = driver.fileMonitor.findFilesByPattern(pattern, {
                includePartial: false,
                sortByDate: true
            });
            
            return files.length > 0;
        } catch (error) {
            logger.error(`Failed to check download status for ${target}:`, error.message);
            return false;
        }
    }

    // Get downloaded file path for target
    async getDownloadedFile(target) {
        if (!downloadConfigs || !downloadConfigs[target]) {
            return null;
        }
        
        if (!driver) {
            return null;
        }
        
        try {
            const config = downloadConfigs[target];
            const pattern = new RegExp(config.filePattern, 'i');
            const files = driver.fileMonitor.findFilesByPattern(pattern, {
                includePartial: false,
                sortByDate: true
            });
            
            return files.length > 0 ? files[0] : null;
        } catch (error) {
            logger.error(`Failed to get downloaded file for ${target}:`, error.message);
            return null;
        }
    }
}

module.exports = DownloadManager;
