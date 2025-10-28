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
const IPlugin = require('../../interfaces/IPlugin');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

class EnhancedDownloadPlugin extends IPlugin {
    constructor() {
        super();
        this.name = 'EnhancedDownloadPlugin';
        this.version = '2.0.0';
        this.spider = null;
        this.downloadPath = null;
        this.fileMonitor = null;
        this.activeDownloads = new Map();
        this.downloadMetrics = {
            totalDownloads: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            buttonClicks: 0,
            fileDetections: 0
        };
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            this.downloadPath = path.join(os.homedir(), 'Downloads', 'spider_downloads');
            
            // Ensure download directory exists
            if (!fs.existsSync(this.downloadPath)) {
                fs.mkdirSync(this.downloadPath, { recursive: true });
            }

            // Initialize file monitor
            this.fileMonitor = new FileMonitor(this.downloadPath);
            
            this.isInitialized = true;
            logger.info(`EnhancedDownloadPlugin initialized: ${this.downloadPath}`);
        } catch (error) {
            logger.error('Failed to initialize EnhancedDownloadPlugin:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.activeDownloads.clear();
            this.isInitialized = false;
            logger.info('EnhancedDownloadPlugin cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup EnhancedDownloadPlugin:', error);
        }
    }

    async downloadFile(url, options = {}) {
        try {
            const filename = options.filename || this.generateFilename(url);
            const filepath = path.join(this.downloadPath, filename);
            
            logger.info(`Starting download: ${url} -> ${filepath}`);
            
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: options.timeout || 300000
            });
            
            const writer = fs.createWriteStream(filepath);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    this.downloadMetrics.totalDownloads++;
                    this.downloadMetrics.successfulDownloads++;
                    logger.info(`Download completed: ${filepath}`);
                    resolve({
                        success: true,
                        filepath: filepath,
                        filename: filename,
                        size: fs.statSync(filepath).size
                    });
                });
                
                writer.on('error', (error) => {
                    this.downloadMetrics.totalDownloads++;
                    this.downloadMetrics.failedDownloads++;
                    logger.error(`Download failed: ${error.message}`);
                    reject(error);
                });
            });
        } catch (error) {
            this.downloadMetrics.totalDownloads++;
            this.downloadMetrics.failedDownloads++;
            logger.error(`Failed to download ${url}:`, error);
            throw error;
        }
    }

    async clickDownloadAndWait(selector, filePattern, options = {}) {
        try {
            const page = await this.spider.getPage();
            if (!page) {
                throw new Error('No page available for download');
            }

            // Click the download link
            await page.click(selector);
            logger.info(`Clicked download link: ${selector}`);
            this.downloadMetrics.buttonClicks++;

            // Wait for file to appear
            const downloadedFile = await this.waitForFileByPattern(filePattern, options);
            this.downloadMetrics.fileDetections++;

            return {
                success: true,
                file: downloadedFile,
                message: 'Download completed successfully'
            };
        } catch (error) {
            logger.error('Download failed:', error);
            return {
                success: false,
                error: error.message,
                message: 'Download failed'
            };
        }
    }

    async findAndClickDownloadLink(keywords, filePattern, options = {}) {
        try {
            const page = await this.spider.getPage();
            if (!page) {
                throw new Error('No page available for download');
            }

            // Find download links containing the keywords
            const downloadLinks = await page.$$eval('a', (links, keywords) => {
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
                        id: link.id,
                        className: link.className
                    }));
            }, keywords);

            if (downloadLinks.length === 0) {
                throw new Error(`No download links found with keywords: ${keywords.join(', ')}`);
            }

            logger.info(`Found ${downloadLinks.length} potential download links`);

            // Try to click the first matching link
            const targetLink = downloadLinks[0];
            logger.info(`Clicking download link: ${targetLink.text}`);

            // Click the download link and wait for file
            return await this.clickDownloadAndWait(`a[href="${targetLink.href}"]`, filePattern, options);

        } catch (error) {
            logger.error('Failed to find or click download link:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to find or click download link'
            };
        }
    }

    async downloadVSCodeFiles() {
        try {
            const page = await this.spider.getPage();
            if (!page) {
                throw new Error('No page available for VSCode download');
            }

            // Navigate to VSCode download page
            await page.goto('https://code.visualstudio.com/', {
                waitUntil: 'networkidle2',
                timeout: 120000
            });

            // Wait for page to load
            await page.waitForTimeout(3000);

            // Find and click Linux DEB download button
            const debResult = await this.findAndClickDownloadLink(
                ['linux', 'deb', 'x64', 'download'],
                'code.*\\.deb',
                { timeout: 300000 }
            );

            if (debResult.success) {
                logger.info(`DEB download completed: ${debResult.file.path}`);
            }

            // Find and click Linux AppImage download button
            const appImageResult = await this.findAndClickDownloadLink(
                ['linux', 'appimage', 'x64'],
                'code.*\\.appimage',
                { timeout: 300000 }
            );

            if (appImageResult.success) {
                logger.info(`AppImage download completed: ${appImageResult.file.path}`);
            }

            return {
                success: true,
                debFile: debResult.success ? debResult.file : null,
                appImageFile: appImageResult.success ? appImageResult.file : null,
                message: 'VSCode downloads completed'
            };

        } catch (error) {
            logger.error('Failed to download VSCode files:', error);
            return {
                success: false,
                error: error.message,
                message: 'VSCode download failed'
            };
        }
    }

    async downloadCursorFiles() {
        try {
            const page = await this.spider.getPage();
            if (!page) {
                throw new Error('No page available for Cursor download');
            }

            // Navigate to Cursor download page
            await page.goto('https://cursor.com/download', {
                waitUntil: 'networkidle2',
                timeout: 120000
            });

            // Wait for page to load
            await page.waitForTimeout(3000);

            // Find and click Linux AppImage download button
            const appImageResult = await this.findAndClickDownloadLink(
                ['linux', 'appimage', 'x64'],
                'cursor.*\\.appimage',
                { timeout: 300000 }
            );

            if (appImageResult.success) {
                logger.info(`Cursor AppImage download completed: ${appImageResult.file.path}`);
            }

            return {
                success: true,
                appImageFile: appImageResult.success ? appImageResult.file : null,
                message: 'Cursor download completed'
            };

        } catch (error) {
            logger.error('Failed to download Cursor files:', error);
            return {
                success: false,
                error: error.message,
                message: 'Cursor download failed'
            };
        }
    }

    async waitForFileByPattern(pattern, options = {}) {
        const defaultOptions = {
            timeout: 300000, // 5 minutes
            pollInterval: 2000, // 2 seconds
            stableTime: 3000, // 3 seconds
            onProgress: (elapsed, total) => {
                if (elapsed % 30000 === 0) { // Log every 30 seconds
                    logger.info(`Waiting for download... ${Math.round(elapsed/1000)}s / ${Math.round(total/1000)}s`);
                }
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };
        return await this.fileMonitor.waitForFile(pattern, mergedOptions);
    }

    generateFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const ext = path.extname(pathname) || '.html';
            const basename = path.basename(pathname, ext) || 'download';
            const timestamp = Date.now();
            
            return `${basename}_${timestamp}${ext}`;
        } catch (error) {
            return `download_${Date.now()}`;
        }
    }

    getDownloadMetrics() {
        return {
            ...this.downloadMetrics,
            successRate: this.downloadMetrics.totalDownloads > 0 ? 
                (this.downloadMetrics.successfulDownloads / this.downloadMetrics.totalDownloads) * 100 : 0
        };
    }
}

class FileMonitor {
    constructor(downloadPath) {
        this.downloadPath = downloadPath;
        this.minFileSize = 1024; // 1KB minimum file size
    }

    async waitForFile(pattern, options) {
        const startTime = Date.now();
        const timeout = options.timeout || 300000;
        const pollInterval = options.pollInterval || 2000;
        const stableTime = options.stableTime || 3000;
        
        let lastFileSize = 0;
        let stableStartTime = null;
        
        while (Date.now() - startTime < timeout) {
            try {
                const files = this.findFilesByPattern(pattern);
                
                if (files.length > 0) {
                    const latestFile = files[0]; // Assuming files are sorted by date
                    const currentSize = latestFile.size;
                    
                    if (currentSize === lastFileSize) {
                        if (stableStartTime === null) {
                            stableStartTime = Date.now();
                        } else if (Date.now() - stableStartTime >= stableTime) {
                            logger.info(`File download completed: ${latestFile.path}`);
                            return latestFile;
                        }
                    } else {
                        stableStartTime = null;
                        lastFileSize = currentSize;
                    }
                }
                
                if (options.onProgress) {
                    options.onProgress(Date.now() - startTime, timeout);
                }
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
                logger.error('Error monitoring file:', error);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }
        
        throw new Error(`Timeout waiting for file pattern: ${pattern}`);
    }

    findFilesByPattern(pattern) {
        const matchedFiles = [];
        const now = Date.now();
        const regex = new RegExp(pattern);

        try {
            if (!fs.existsSync(this.downloadPath)) {
                return matchedFiles;
            }

            const files = fs.readdirSync(this.downloadPath);
            
            for (const fileName of files) {
                // Skip backup files (containing numbers in parentheses like (1), (2), etc.)
                if (fileName.match(/\(\d+\)/)) {
                    continue;
                }

                if (regex.test(fileName)) {
                    const filePath = path.join(this.downloadPath, fileName);
                    const stats = fs.statSync(filePath);
                    
                    // Check if file is large enough (not a partial download)
                    if (stats.size >= this.minFileSize) {
                        matchedFiles.push({
                            path: filePath,
                            name: fileName,
                            size: stats.size,
                            modified: stats.mtime,
                            directory: this.downloadPath
                        });
                    }
                }
            }
        } catch (error) {
            logger.error(`Cannot read directory ${this.downloadPath}:`, error);
        }

        // Sort by modification date (newest first)
        return matchedFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    }
}

module.exports = EnhancedDownloadPlugin;
