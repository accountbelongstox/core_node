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

            // For VSCode, use direct API approach instead of web scraping
            if (target === 'vscode') {
                return await this.downloadVSCodeDirect(config, options);
            }

            // Get or create page from spider
            let page = this.spider.getPage();
            if (!page) {
                page = await this.spider.newPage();
            }

            // Navigate to download page
            await page.goto(config.url, { 
                timeout: config.timeout,
                waitUntil: 'networkidle2'
            });

            // Wait for page to load
            await page.waitForTimeout(3000);

            // Try multiple selectors for VSCode download
            const downloadSelectors = [
                config.targetSelector,
                'a[href*=".deb"]',
                'a[href*=".rpm"]', 
                'a[href*=".exe"]',
                'a[href*=".dmg"]',
                'a[href*=".pkg"]',
                '.download-button',
                '[data-os="linux"]',
                '.btn-download',
                'a[href*="code.visualstudio.com"]',
                'a[href*="vscode"]',
                'button[data-testid*="download"]',
                'a[aria-label*="download"]',
                'a[title*="download"]'
            ];

            let downloadUrl = null;
            let foundSelector = null;

            // Try to find download link with multiple selectors
            for (const selector of downloadSelectors) {
                try {
                    const element = await page.waitForSelector(selector, { timeout: 5000 });
                    if (element) {
                        downloadUrl = await page.evaluate((sel) => {
                            const el = document.querySelector(sel);
                            return el ? el.href : null;
                        }, selector);
                        if (downloadUrl) {
                            foundSelector = selector;
                            break;
                        }
                    }
                } catch (error) {
                    logger.debug(`Selector ${selector} not found, trying next...`);
                    continue;
                }
            }

            if (!downloadUrl) {
                // If no direct link found, try to find any download-related element
                const allLinks = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    return links.map(link => ({
                        href: link.href,
                        text: link.textContent.trim()
                    }));
                });
                
                const downloadLinks = allLinks.filter(link => 
                    link.href && (
                        link.href.includes('.deb') || 
                        link.href.includes('.rpm') || 
                        link.href.includes('.exe') || 
                        link.href.includes('.dmg') ||
                        link.href.includes('vscode') ||
                        link.text.toLowerCase().includes('download')
                    )
                );

                if (downloadLinks.length > 0) {
                    downloadUrl = downloadLinks[0].href;
                    foundSelector = 'dynamic-link-search';
                    logger.info(`Found download link through dynamic search: ${downloadUrl}`);
                } else {
                    throw new Error(`No download link found with any selector. Page URL: ${page.url()}`);
                }
            }
            logger.info(`Found download URL: ${downloadUrl}`);

            // Start download
            const result = await this.startDownload(downloadUrl, config, options);
            
            return {
                success: true,
                target: target,
                url: downloadUrl,
                file: result.file,
                message: `Successfully downloaded ${config.name}`
            };

        } catch (error) {
            logger.error(`Failed to download ${target}:`, error);
            return {
                success: false,
                target: target,
                error: error.message
            };
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
