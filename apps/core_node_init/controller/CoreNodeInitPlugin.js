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
const path = require('path');
const os = require('os');
const IPlugin = require('../../../ncore/utils/puppeteer_spider_v2/src/interfaces/IPlugin');

class CoreNodeInitPlugin extends IPlugin {
    constructor() {
        super();
        this.name = 'CoreNodeInitPlugin';
        this.version = '2.0.0';
        this.spider = null;
        this.downloadConfigs = null;
        this.downloadDirConfig = null;
        this.fileMonitorConfig = null;
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            
            // Load configuration
            const config = require('../config');
            this.downloadConfigs = config.downloadConfigs;
            this.downloadDirConfig = config.downloadDirConfig;
            this.fileMonitorConfig = config.fileMonitorConfig;
            
            logger.info('CoreNodeInitPlugin initialized');
            return true;
        } catch (error) {
            logger.error('Failed to initialize CoreNodeInitPlugin:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.spider = null;
            logger.info('CoreNodeInitPlugin cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup CoreNodeInitPlugin:', error);
        }
    }

    async downloadApplication(target, options = {}) {
        try {
            if (!this.downloadConfigs[target]) {
                throw new Error(`Unknown download target: ${target}`);
            }

            const config = this.downloadConfigs[target];
            logger.info(`Starting download for ${config.name}...`);

            // Use enhanced download plugin for VSCode and Cursor
            if (target === 'vscode') {
                return await this.downloadVSCodeEnhanced(config, options);
            } else if (target === 'cursor') {
                return await this.downloadCursorEnhanced(config, options);
            }

            // For other targets, use the enhanced page functionality
            return await this.downloadWithEnhancedPage(target, config, options);

        } catch (error) {
            logger.error(`Failed to download ${target}:`, error);
            return {
                success: false,
                target: target,
                error: error.message
            };
        }
    }

    async downloadVSCodeEnhanced(config, options = {}) {
        try {
            logger.info('Using enhanced VSCode download with button clicking...');

            // Get or create page from spider
            let page = this.spider.getPage();
            if (!page) {
                page = await this.spider.newPage();
            }

            // Navigate to VSCode download page
            await page.goto('https://code.visualstudio.com/', {
                waitUntil: 'networkidle2',
                timeout: 120000
            });

            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Try multiple approaches to find VSCode download buttons
            const puppeteerPage = page.page || page;
            
            // Approach 1: Look for download buttons with specific text patterns
            const downloadButtons = await puppeteerPage.$$eval('a, button', (elements) => {
                return elements
                    .filter(el => {
                        const text = el.textContent.toLowerCase();
                        const href = el.href ? el.href.toLowerCase() : '';
                        return (
                            text.includes('download') && 
                            (text.includes('linux') || text.includes('ubuntu') || text.includes('deb'))
                        );
                    })
                    .map(el => ({
                        text: el.textContent.trim(),
                        href: el.href || '',
                        tagName: el.tagName.toLowerCase(),
                        id: el.id,
                        className: el.className
                    }));
            });

            // Also look for any download-related elements
            const allDownloadElements = await puppeteerPage.$$eval('a, button', (elements) => {
                return elements
                    .filter(el => {
                        const text = el.textContent.toLowerCase();
                        const href = el.href ? el.href.toLowerCase() : '';
                        return text.includes('download') || href.includes('download');
                    })
                    .map(el => ({
                        text: el.textContent.trim(),
                        href: el.href || '',
                        tagName: el.tagName.toLowerCase(),
                        id: el.id,
                        className: el.className
                    }));
            });

            logger.info(`Found ${downloadButtons.length} Linux-specific download buttons`);
            logger.info(`Found ${allDownloadElements.length} total download elements`);
            
            // Log all download elements for debugging
            allDownloadElements.forEach((el, index) => {
                logger.info(`Download element ${index + 1}: "${el.text}" - ${el.href}`);
            });

            if (downloadButtons.length > 0) {
                logger.info(`Found ${downloadButtons.length} VSCode download buttons`);
                const targetButton = downloadButtons[0];
                logger.info(`Clicking VSCode download button: ${targetButton.text}`);

                // Try different selector approaches
                let clicked = false;
                
                // Try by href first
                if (targetButton.href && !clicked) {
                    try {
                        await puppeteerPage.click(`a[href="${targetButton.href}"]`);
                        clicked = true;
                        logger.info(`Clicked VSCode button by href: ${targetButton.href}`);
                    } catch (e) {
                        logger.debug(`Failed to click by href: ${e.message}`);
                    }
                }
                
                // Try by text content
                if (!clicked) {
                    try {
                        await puppeteerPage.click(`a:has-text("${targetButton.text}")`);
                        clicked = true;
                        logger.info(`Clicked VSCode button by text: ${targetButton.text}`);
                    } catch (e) {
                        logger.debug(`Failed to click by text: ${e.message}`);
                    }
                }
                
                // Try by CSS selector
                if (!clicked) {
                    try {
                        const selector = `${targetButton.tagName}${targetButton.id ? '#' + targetButton.id : ''}${targetButton.className ? '.' + targetButton.className.split(' ').join('.') : ''}`;
                        await puppeteerPage.click(selector);
                        clicked = true;
                        logger.info(`Clicked VSCode button by CSS selector: ${selector}`);
                    } catch (e) {
                        logger.debug(`Failed to click by CSS selector: ${e.message}`);
                    }
                }
                
                if (clicked) {
                    // Wait for download
                    const fileResult = await this.waitForFileByPattern('code.*\\.(deb|rpm|appimage)', { timeout: 300000 });
                    
                    if (fileResult.success) {
                        logger.info(`VSCode download completed: ${fileResult.file.path}`);
                        return { success: true, message: 'VSCode download completed', file: fileResult.file };
                    }
                }
            }

            // Approach 2: Use the original keyword-based search
            const debResult = await this.findAndClickDownloadLink(
                page,
                ['linux', 'deb', 'x64', 'download', 'ubuntu'],
                'code.*\\.(deb|rpm|appimage)',
                { timeout: 300000 }
            );

            if (debResult.success) {
                logger.info(`DEB download completed: ${debResult.file.path}`);
                return { success: true, message: 'VSCode DEB download completed', file: debResult.file };
            }

            // Approach 3: Try AppImage download as fallback
            const appImageResult = await this.findAndClickDownloadLink(
                page,
                ['linux', 'appimage', 'x64'],
                'code.*\\.(appimage|deb|rpm)',
                { timeout: 300000 }
            );

            if (appImageResult.success) {
                logger.info(`AppImage download completed: ${appImageResult.file.path}`);
                return { success: true, message: 'VSCode AppImage download completed', file: appImageResult.file };
            }

            return {
                success: true,
                target: 'vscode',
                debFile: debResult.success ? debResult.file : null,
                appImageFile: appImageResult.success ? appImageResult.file : null,
                message: 'VSCode downloads completed successfully'
            };

        } catch (error) {
            logger.error('Failed to download VSCode with enhanced method:', error);
            throw error;
        }
    }

    async downloadCursorEnhanced(config, options = {}) {
        try {
            logger.info('Using enhanced Cursor download with button clicking...');
            
            // Get or create page from spider
            let page = this.spider.getPage();
            if (!page) {
                page = await this.spider.newPage();
            }

            // Navigate to Cursor download page
            await page.goto('https://cursor.com/download', {
                waitUntil: 'networkidle2',
                timeout: 120000
            });

            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Find and click Linux AppImage download button - prioritize Linux over Mac
            const appImageResult = await this.findAndClickDownloadLink(
                page,
                ['linux', 'appimage', 'x64', 'ubuntu', 'debian'],
                'cursor.*\\.(appimage|deb|rpm)',
                { timeout: 300000, prioritizeLinux: true }
            );

            if (appImageResult.success) {
                logger.info(`Cursor AppImage download completed: ${appImageResult.file.path}`);
            }

            return {
                success: true,
                target: 'cursor',
                appImageFile: appImageResult.success ? appImageResult.file : null,
                message: 'Cursor download completed successfully'
            };

        } catch (error) {
            logger.error('Failed to download Cursor with enhanced method:', error);
            throw error;
        }
    }

    async downloadWithEnhancedPage(target, config, options = {}) {
        try {
            // Get or create page from spider
            let page = this.spider.getPage();
            if (!page) {
                page = await this.spider.newPage();
            }

            // Use enhanced page functionality
            const EnhancedPage = require('../../../ncore/utils/puppeteer_spider_v2/src/implementations/pages/EnhancedPage');
            const enhancedPage = new EnhancedPage(page, this.spider.getBrowser(), {
                downloadPath: this.downloadDirConfig.searchDirs[0],
                urlComparisonStrict: false
            });

            await enhancedPage.initialize();

            // Navigate to download page using enhanced URL opening
            const openResult = await enhancedPage.openUrl(config.url, {
                waitForComplete: true,
                timeout: config.timeout,
                showImages: false,
                showStyle: true
            });

            logger.info(`Page opened with action: ${openResult.action}`);

            // Wait for page to load
            await page.waitForTimeout(3000);

            // Try to find and click download link using keywords
            const downloadResult = await enhancedPage.findAndClickDownloadLink(
                config.keywords,
                config.filePattern,
                { timeout: config.timeout }
            );

            if (downloadResult.success) {
                logger.info(`Download completed: ${downloadResult.file.path}`);
            }
            
            return {
                success: true,
                target: target,
                file: downloadResult.success ? downloadResult.file : null,
                message: `Successfully downloaded ${config.name}`
            };

        } catch (error) {
            logger.error(`Failed to download ${target} with enhanced page:`, error);
            throw error;
        }
    }

    async downloadImage(selector, options = {}) {
        try {
            // Get or create page from spider
            let page = this.spider.getPage();
            if (!page) {
                page = await this.spider.newPage();
            }

            const imageElement = await page.$(selector);
            if (!imageElement) {
                throw new Error(`Image element not found with selector: ${selector}`);
            }

            const imageUrl = await page.evaluate(el => el.src || el.href, imageElement);
            if (!imageUrl) {
                throw new Error('No image URL found');
            }

            const result = await this.startDownload(imageUrl, {
                downloadDir: this.downloadDirConfig.searchDirs[0],
                timeout: 60000,
                waitForDownload: true
            }, options);

            return {
                success: true,
                selector: selector,
                url: imageUrl,
                file: result.file,
                message: 'Image downloaded successfully'
            };

        } catch (error) {
            logger.error(`Failed to download image with selector ${selector}:`, error);
            return {
                success: false,
                selector: selector,
                error: error.message
            };
        }
    }

    async downloadAudio(selector, options = {}) {
        try {
            // Get or create page from spider
            let page = this.spider.getPage();
            if (!page) {
                page = await this.spider.newPage();
            }

            const audioElement = await page.$(selector);
            if (!audioElement) {
                throw new Error(`Audio element not found with selector: ${selector}`);
            }

            const audioUrl = await page.evaluate(el => el.src || el.href, audioElement);
            if (!audioUrl) {
                throw new Error('No audio URL found');
            }

            const result = await this.startDownload(audioUrl, {
                downloadDir: this.downloadDirConfig.searchDirs[0],
                timeout: 300000,
                waitForDownload: true
            }, options);

            return {
                success: true,
                selector: selector,
                url: audioUrl,
                file: result.file,
                message: 'Audio downloaded successfully'
            };

        } catch (error) {
            logger.error(`Failed to download audio with selector ${selector}:`, error);
            return {
                success: false,
                selector: selector,
                error: error.message
            };
        }
    }

    async downloadFromUrl(url, options = {}) {
        try {
            const result = await this.startDownload(url, {
                downloadDir: this.downloadDirConfig.searchDirs[0],
                timeout: 300000,
                waitForDownload: true
            }, options);

            return {
                success: true,
                url: url,
                file: result.file,
                message: 'File downloaded successfully'
            };

        } catch (error) {
            logger.error(`Failed to download from URL ${url}:`, error);
            return {
                success: false,
                url: url,
                error: error.message
            };
        }
    }

    async startDownload(url, config, options = {}) {
        try {
            const { HTTPDownload } = require('#@downloader');
            const path = require('path');
            const fs = require('fs');

            const downloadDir = options.downloadDir || config.downloadDir || this.downloadDirConfig.searchDirs[0];
            const fileName = path.basename(new URL(url).pathname) || 'download';
            const filePath = path.join(downloadDir, fileName);

            // Ensure download directory exists
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }

            logger.info(`Starting download: ${url} -> ${filePath}`);

            // Use foundation downloader
            const downloadedPath = await HTTPDownload(url, filePath);
            
            if (downloadedPath) {
                logger.info(`Download completed: ${downloadedPath}`);
                return { file: downloadedPath };
            } else {
                throw new Error('Download failed - no file was downloaded');
            }

        } catch (error) {
            logger.error('Download failed:', error);
            throw error;
        }
    }

    listTargets() {
        const targets = [];
        for (const [key, config] of Object.entries(this.downloadConfigs)) {
            targets.push({
                key: key,
                name: config.name,
                description: config.description
            });
        }
        return targets;
    }

    async getDownloadStatus() {
        try {
            const fs = require('fs');
            const path = require('path');
            const status = {};

            for (const [target, config] of Object.entries(this.downloadConfigs)) {
                const downloadDir = config.downloadDir;
                const filePattern = new RegExp(config.filePattern);
                
                try {
                    const files = fs.readdirSync(downloadDir);
                    const matchingFile = files.find(file => filePattern.test(file));
                    
                    if (matchingFile) {
                        const filePath = path.join(downloadDir, matchingFile);
                        const stats = fs.statSync(filePath);
                        
                        status[target] = {
                            downloaded: true,
                            file: matchingFile,
                            size: stats.size,
                            modified: stats.mtime
                        };
                    } else {
                        status[target] = {
                            downloaded: false
                        };
                    }
                } catch (error) {
                    status[target] = {
                        downloaded: false,
                        error: error.message
                    };
                }
            }

            return status;
        } catch (error) {
            logger.error('Failed to get download status:', error);
            throw error;
        }
    }

    async findAndClickDownloadLink(page, keywords, filePattern, options = {}) {
        try {
            // Access the underlying Puppeteer page
            const puppeteerPage = page.page || page;
            
            // Find download links containing the keywords
            const downloadLinks = await puppeteerPage.$$eval('a', (links, keywords, prioritizeLinux) => {
                const filteredLinks = links
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
                        className: link.className,
                        textLower: link.textContent.toLowerCase()
                    }));

                // If prioritizeLinux is true, sort Linux links first
                if (prioritizeLinux) {
                    return filteredLinks.sort((a, b) => {
                        const aIsLinux = a.textLower.includes('linux') || a.textLower.includes('ubuntu') || a.textLower.includes('debian');
                        const bIsLinux = b.textLower.includes('linux') || b.textLower.includes('ubuntu') || b.textLower.includes('debian');
                        
                        if (aIsLinux && !bIsLinux) return -1;
                        if (!aIsLinux && bIsLinux) return 1;
                        return 0;
                    });
                }
                
                return filteredLinks;
            }, keywords, options.prioritizeLinux || false);

            if (downloadLinks.length === 0) {
                throw new Error(`No download links found with keywords: ${keywords.join(', ')}`);
            }

            logger.info(`Found ${downloadLinks.length} potential download links`);

            // Try to click the first matching link
            const targetLink = downloadLinks[0];
            logger.info(`Clicking download link: ${targetLink.text}`);

            // Click the download link and wait for file
            return await this.clickDownloadAndWait(puppeteerPage, `a[href="${targetLink.href}"]`, filePattern, options);

        } catch (error) {
            logger.error('Failed to find or click download link:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to find or click download link'
            };
        }
    }

    async clickDownloadAndWait(page, selector, filePattern, options = {}) {
        try {
            // Access the underlying Puppeteer page
            const puppeteerPage = page.page || page;
            
            // Clear old files if requested
            if (options.clearOldFiles !== false) {
                await this.clearOldFiles(filePattern);
            }
            
            // Click the download link
            await puppeteerPage.click(selector);
            logger.info(`Clicked download link: ${selector}`);

            // Wait for file to appear
            const downloadedFile = await this.waitForFileByPattern(filePattern, options);

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

    async clearOldFiles(pattern) {
        try {
            const fs = require('fs');
            const path = require('path');
            const downloadDir = '/home/ubuntu/Downloads';
            const files = await fs.promises.readdir(downloadDir);
            const regex = new RegExp(pattern, 'i');
            
            const matchingFiles = files.filter(file => regex.test(file));
            
            if (matchingFiles.length > 0) {
                logger.info(`Clearing ${matchingFiles.length} old files matching pattern: ${pattern}`);
                
                for (const file of matchingFiles) {
                    const filePath = path.join(downloadDir, file);
                    try {
                        await fs.promises.unlink(filePath);
                        logger.info(`Deleted old file: ${file}`);
                    } catch (error) {
                        logger.warn(`Failed to delete old file ${file}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            logger.error('Error clearing old files:', error);
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
        
        // Get initial file list to detect new files
        const initialFiles = await this.getMatchingFiles(pattern);
        logger.info(`Initial matching files: ${initialFiles.length}`);
        
        return await this.fileMonitorWait(pattern, mergedOptions, initialFiles);
    }

    async getMatchingFiles(pattern) {
        try {
            const fs = require('fs');
            const path = require('path');
            const regex = new RegExp(pattern, 'i');
            const allFiles = [];

            const searchDirs = this.downloadDirConfig.searchDirs || [];

            for (const downloadDir of searchDirs) {
                try {
                    if (!fs.existsSync(downloadDir)) {
                        continue;
                    }

                    const files = await fs.promises.readdir(downloadDir);
                    const matchedFiles = files
                        .filter(file => regex.test(file))
                        .map(file => {
                            const filePath = path.join(downloadDir, file);
                            const stats = fs.statSync(filePath);
                            return {
                                name: file,
                                path: filePath,
                                size: stats.size,
                                mtime: stats.mtime
                            };
                        });

                    allFiles.push(...matchedFiles);
                } catch (error) {
                    logger.warn(`Cannot read directory ${downloadDir}:`, error.message);
                }
            }

            return allFiles.sort((a, b) => b.mtime - a.mtime);
        } catch (error) {
            logger.error('Error reading download directories:', error);
            return [];
        }
    }

    async fileMonitorWait(pattern, options, initialFiles = []) {
        const fs = require('fs');
        const path = require('path');
        const startTime = Date.now();
        const timeout = options.timeout || 300000;
        const pollInterval = options.pollInterval || 2000;
        const stableTime = options.stableTime || 3000;
        
        let lastFileSize = 0;
        let stableStartTime = null;
        let initialFileNames = initialFiles.map(f => f.name);
        
        logger.info(`Monitoring for new files matching pattern: ${pattern}`);
        logger.info(`Initial files to ignore: ${initialFileNames.join(', ')}`);
        
        while (Date.now() - startTime < timeout) {
            try {
                const currentFiles = await this.getMatchingFiles(pattern);
                
                // Find new files (not in initial list)
                const newFiles = currentFiles.filter(file => !initialFileNames.includes(file.name));
                
                if (newFiles.length > 0) {
                    const latestFile = newFiles[0]; // Newest file
                    const currentSize = latestFile.size;
                    
                    logger.debug(`Found new file: ${latestFile.name}, size: ${currentSize}`);
                    
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
        const fs = require('fs');
        const path = require('path');
        const matchedFiles = [];
        const now = Date.now();
        const regex = new RegExp(pattern);

        try {
            const downloadDir = this.downloadDirConfig.searchDirs[0];
            if (!fs.existsSync(downloadDir)) {
                return matchedFiles;
            }

            const files = fs.readdirSync(downloadDir);
            
            for (const fileName of files) {
                // Skip backup files (containing numbers in parentheses like (1), (2), etc.)
                if (fileName.match(/\(\d+\)/)) {
                    continue;
                }

                if (regex.test(fileName)) {
                    const filePath = path.join(downloadDir, fileName);
                    const stats = fs.statSync(filePath);
                    
                    matchedFiles.push({
                        path: filePath,
                        name: fileName,
                        size: stats.size,
                        modified: stats.mtime,
                        directory: downloadDir
                    });
                }
            }
        } catch (error) {
            logger.error(`Cannot read directory ${this.downloadDirConfig.searchDirs[0]}:`, error);
        }

        // Sort by modification date (newest first)
        return matchedFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    }

    async downloadVSCodeDirect(config, options = {}) {
        try {
            logger.info('Using direct VSCode API download...');
            
            // VSCode direct download URLs for different platforms
            const platform = process.platform;
            let downloadUrl = null;
            
            switch (platform) {
                case 'linux':
                    const os = require('os');
                    const arch = os.arch();
                    downloadUrl = arch === 'arm64' ? 
                        'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-arm64' :
                        'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64';
                    break;
                case 'win32':
                    downloadUrl = 'https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user';
                    break;
                case 'darwin':
                    downloadUrl = 'https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal';
                    break;
                default:
                    downloadUrl = 'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64';
            }
            
            logger.info(`Direct download URL: ${downloadUrl}`);
            
            // Use reusable download logic
            const result = await this.startDownload(downloadUrl, {
                downloadDir: path.join(os.homedir(), 'Downloads', 'core_node_init'),
                timeout: 300000,
                waitForDownload: true
            }, options);
            
            return {
                success: true,
                target: 'vscode',
                url: downloadUrl,
                file: result.file,
                message: `Successfully downloaded VSCode to ${result.file}`
            };
            
        } catch (error) {
            logger.error('Failed to download VSCode directly:', error);
            throw error;
        }
    }
}

module.exports = CoreNodeInitPlugin;
