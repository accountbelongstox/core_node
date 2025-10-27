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

const path = require('path');
const fs = require('fs');
const logger = require('#@logger');
const gconfig = require('#@gconfig');
const { file, fdir } = require('#@ftools');
const { Spider } = require('#@puppeteer');

// Declare variables
let browser = null;
let page = null;
let spider = null;

class DownloadController {
    constructor() {
        this.browser = null;
        this.spider = null;
        this.isInitialized = false;
        this.downloadConfigs = gconfig.DOWNLOADCONFIGS;
        this.puppeteerConfig = gconfig.PUPPETEERCONFIG;
        this.fileMonitorConfig = gconfig.FILEMONITORCONFIG;
        this.downloadDirConfig = gconfig.DOWNLOADDIRCONFIG;
    }

    // Initialize the controller
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            logger.info('Initializing Download Controller...');

            // Initialize Spider with configuration
            this.spider = new Spider(this.puppeteerConfig);
            this.browser = await this.spider.getBrowser();

            this.isInitialized = true;
            logger.info('Download Controller initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Download Controller:', error.message);
            throw error;
        }
    }

    // Find existing downloaded files
    findExistingFile(target) {
        const config = this.downloadConfigs[target];
        if (!config) {
            return null;
        }

        const searchDirs = this.downloadDirConfig.searchDirs;
        
        for (const dir of searchDirs) {
            if (!fs.existsSync(dir)) {
                continue;
            }

            try {
                const files = fs.readdirSync(dir);
                for (const fileName of files) {
                    if (config.filePattern.test(fileName)) {
                        const filePath = path.join(dir, fileName);
                        const stats = fs.statSync(filePath);
                        
                        // Check if file is large enough (not a partial download)
                        if (stats.size > this.fileMonitorConfig.minFileSize) {
                            return {
                                path: filePath,
                                name: fileName,
                                size: stats.size,
                                modified: stats.mtime
                            };
                        }
                    }
                }
            } catch (error) {
                logger.warning(`Cannot read directory ${dir}: ${error.message}`);
            }
        }

        return null;
    }

    // Wait for file to appear in downloads directory
    async waitForDownload(target, timeout = 300000) {
        const config = this.downloadConfigs[target];
        const startTime = Date.now();
        
        logger.info(`Waiting for download to complete (timeout: ${timeout}ms)...`);
        
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                
                if (elapsed > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('Download timeout exceeded'));
                    return;
                }

                const file = this.findExistingFile(target);
                if (file) {
                    // Check if file is stable (not being written to)
                    setTimeout(() => {
                        const currentStats = fs.statSync(file.path);
                        if (currentStats.size === file.size) {
                            clearInterval(checkInterval);
                            resolve(file);
                        }
                    }, this.fileMonitorConfig.stableTime);
                }
            }, this.fileMonitorConfig.pollInterval);
        });
    }

    // Navigate to download page and trigger download
    async navigateAndDownload(target, options = {}) {
        const config = this.downloadConfigs[target];
        
        try {
            logger.info(`Navigating to ${config.url}...`);

            // Get the page from the browser
            const currentPage = await this.browser.encapsulatedPageFuncs.getCurrentPage();

            // Navigate to the download page
            await currentPage.goto(config.url, {
                timeout: config.timeout || this.puppeteerConfig.timeout,
                waitUntil: 'networkidle2'
            });

            logger.info('Page loaded successfully');

            // Wait for the page to be fully loaded
            await currentPage.waitForTimeout(3000);
            
            // Look for download links containing the keywords
            const downloadLinks = await currentPage.$$eval('a', (links, keywords) => {
                return links
                    .filter(link => {
                        const text = link.textContent.toLowerCase();
                        const href = link.href.toLowerCase();
                        return keywords.some(keyword => 
                            text.includes(keyword.toLowerCase()) || 
                            href.includes(keyword.toLowerCase())
                        );
                    })
                    .map(link => ({
                        href: link.href,
                        text: link.textContent.trim(),
                        selector: link.tagName.toLowerCase() + 
                                 (link.id ? '#' + link.id : '') +
                                 (link.className ? '.' + link.className.split(' ').join('.') : '')
                    }));
            }, config.keywords);

            if (downloadLinks.length === 0) {
                throw new Error(`No download links found with keywords: ${config.keywords.join(', ')}`);
            }

            logger.info(`Found ${downloadLinks.length} potential download links`);
            
            // Try to click the first matching link
            const targetLink = downloadLinks[0];
            logger.info(`Clicking download link: ${targetLink.text}`);

            // Click the download link
            await currentPage.click(`a[href="${targetLink.href}"]`);
            
            logger.info('Download initiated successfully');
            
            return true;
            
        } catch (error) {
            logger.error(`Failed to navigate and download: ${error.message}`);
            throw error;
        }
    }

    // Download a specific target
    async downloadTarget(target, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const config = this.downloadConfigs[target];
        if (!config) {
            throw new Error(`Unknown download target: ${target}`);
        }

        try {
            logger.info(`Starting download for ${config.name}...`);

            // Check if file already exists (unless force option is set)
            if (!options.force) {
                const existingFile = this.findExistingFile(target);
                if (existingFile) {
                    logger.info(`File already exists: ${existingFile.path}`);
                    return {
                        success: true,
                        filePath: existingFile.path,
                        fileName: existingFile.name,
                        alreadyExists: true
                    };
                }
            }

            // Navigate to download page and trigger download
            await this.navigateAndDownload(target, options);

            // Wait for download to complete if configured
            if (config.waitForDownload && !options['no-wait']) {
                const timeout = options.timeout || config.timeout || 300000;
                const downloadedFile = await this.waitForDownload(target, timeout);
                
                return {
                    success: true,
                    filePath: downloadedFile.path,
                    fileName: downloadedFile.name,
                    fileSize: downloadedFile.size,
                    alreadyExists: false
                };
            } else {
                logger.info('Download initiated, not waiting for completion');
                return {
                    success: true,
                    filePath: null,
                    fileName: null,
                    alreadyExists: false,
                    message: 'Download initiated, check downloads directory manually'
                };
            }

        } catch (error) {
            logger.error(`Download failed for ${target}: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get download status for all targets
    async getDownloadStatus() {
        const status = {};
        
        for (const [target, config] of Object.entries(this.downloadConfigs)) {
            const existingFile = this.findExistingFile(target);
            status[target] = {
                name: config.name,
                downloaded: !!existingFile,
                file: existingFile ? existingFile.name : null,
                path: existingFile ? existingFile.path : null,
                size: existingFile ? existingFile.size : null
            };
        }
        
        return status;
    }

    // Cleanup resources
    async cleanup() {
        try {
            if (this.browser && this.browser.puppeteerBrowser) {
                await this.browser.puppeteerBrowser.close();
                this.browser = null;
            }

            this.spider = null;
            this.isInitialized = false;
            logger.info('Download Controller cleanup completed');
        } catch (error) {
            logger.error('Error during cleanup:', error.message);
        }
    }
}

module.exports = DownloadController;
