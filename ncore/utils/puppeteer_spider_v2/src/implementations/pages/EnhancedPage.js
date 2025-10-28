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
const StandardPage = require('./StandardPage');
const path = require('path');
const fs = require('fs');
const os = require('os');

class EnhancedPage extends StandardPage {
    constructor(page, browser, options = {}) {
        super(page, options);
        this.browser = browser;
        this.activePage = null;
        this.pages = [];
        this.downloadPath = options.downloadPath || path.join(os.homedir(), 'Downloads');
        this.urlComparisonStrict = options.urlComparisonStrict || false;
        this.metrics = {
            ...this.metrics,
            blankPageReuses: 0,
            newPageCreations: 0,
            tabSwitches: 0,
            downloads: 0
        };
    }

    async initialize() {
        await super.initialize();
        await this.setupDownloadDirectory();
        await this.setupEventListeners();
        this.isInitialized = true;
    }

    async setupDownloadDirectory() {
        try {
            if (this.page && typeof this.page.target === 'function') {
                const client = await this.page.target().createCDPSession();
                
                await client.send('Page.setDownloadBehavior', {
                    behavior: 'allow',
                    downloadPath: this.downloadPath
                });
                
                logger.debug(`Download directory set to: ${this.downloadPath}`);
            }
        } catch (error) {
            logger.error('Error setting download directory:', error);
        }
    }

    async setupEventListeners() {
        if (this.browser && typeof this.browser.on === 'function') {
            this.browser.on('targetchanged', async (target) => {
                this.stopFindActivePage();
                const page = await target.page();
                if (page && target.type() === 'page') {
                    page.on('focus', async () => {
                        this.activePage = page;
                    });
                }
            });

            this.browser.on('targetdestroyed', async () => {
                await this.findActivePage();
            });

            this.browser.on('close', async () => {
                await this.findActivePage();
            });

            this.browser.on('targetcreated', async (target) => {
                this.stopFindActivePage();
                const page = await target.page();
                if (page && target.type() === 'page') {
                    this.activePage = page;
                }
            });
        } else {
            logger.debug('Browser object does not support event listeners, skipping setup');
        }
    }

    async findBlankPageIndex() {
        try {
            const pages = await this.browser.getPages();
            logger.debug(`Checking ${pages.length} pages for blank pages`);
            
            for (let i = 0; i < pages.length; i++) {
                const pageUrl = await pages[i].mainFrame().url();
                logger.debug(`Page ${i}: ${pageUrl}`);
                
                if (this.isBlankUrl(pageUrl)) {
                    logger.debug(`Found blank page at index ${i}: ${pageUrl}`);
                    return i;
                }
            }
            
            logger.debug('No blank pages found');
            return -1;
        } catch (error) {
            logger.error('Error finding blank page index:', error);
            return -1;
        }
    }

    isBlankUrl(url) {
        const blankUrls = [
            'about:blank',
            'chrome://newtab/',
            'edge://newtab/',
            'chrome://new-tab-page/',
            'edge://new-tab-page/',
            'about:newtab'
        ];
        return blankUrls.includes(url) || url === '';
    }

    async findNormalizedUrlIndex(url, urlStrict = false) {
        try {
            const pages = await this.browser.pages();
            for (let i = 0; i < pages.length; i++) {
                const curUrl = await pages[i].mainFrame().url();
                if (urlStrict) {
                    if (this.equalDomainFull(curUrl, url)) {
                        return i;
                    }
                } else {
                    if (this.equalDomain(curUrl, url)) {
                        return i;
                    }
                }
            }
            return -1;
        } catch (error) {
            logger.error('Error finding normalized URL index:', error);
            return -1;
        }
    }

    equalDomain(url1, url2) {
        try {
            const domain1 = new URL(url1).hostname;
            const domain2 = new URL(url2).hostname;
            return domain1 === domain2;
        } catch (error) {
            return false;
        }
    }

    equalDomainFull(url1, url2) {
        try {
            const urlObj1 = new URL(url1);
            const urlObj2 = new URL(url2);
            return urlObj1.hostname === urlObj2.hostname && 
                   urlObj1.pathname === urlObj2.pathname;
        } catch (error) {
            return false;
        }
    }

    async openUrl(url, options = {}) {
        const {
            waitForComplete = true,
            timeout = 120000,
            logging = true,
            showImages = true,
            showStyle = true,
            urlStrict = this.urlComparisonStrict
        } = options;

        try {
            // Check if URL already exists in tabs
            const existingPageIndex = await this.findNormalizedUrlIndex(url, urlStrict);
            if (existingPageIndex !== -1) {
                // Switch to existing tab
                await this.switchToPageByIndex(existingPageIndex);
                this.metrics.tabSwitches++;
                logger.debug(`Switched to existing tab for URL: ${url}`);
                return { success: true, action: 'switched', pageIndex: existingPageIndex };
            }

            // Check for blank page to reuse
            const blankPageIndex = await this.findBlankPageIndex();
            let targetPage;

            if (blankPageIndex !== -1) {
                // Reuse blank page
                const pages = await this.browser.getPages();
                targetPage = pages[blankPageIndex];
                this.metrics.blankPageReuses++;
                logger.info(`✅ Reusing blank page at index ${blankPageIndex} for URL: ${url}`);
            } else {
                // Create new page
                targetPage = await this.browser.newPage();
                await this.setupPageInterception(targetPage, showImages, showStyle);
                await this.setupDownloadDirectoryForPage(targetPage);
                this.metrics.newPageCreations++;
                logger.info(`❌ No blank page found, created new page for URL: ${url}`);
            }

            // Navigate to URL
            if (waitForComplete) {
                await targetPage.goto(url, { waitUntil: 'domcontentloaded', timeout });
            } else {
                await targetPage.goto(url, { timeout });
            }

            if (logging) {
                await this.setupNetworkLogging(targetPage);
            }

            this.activePage = targetPage;
            return { success: true, action: blankPageIndex !== -1 ? 'reused' : 'created', page: targetPage };

        } catch (error) {
            logger.error(`Failed to open URL ${url}:`, error);
            throw error;
        }
    }

    async setupPageInterception(page, showImages, showStyle) {
        const skipResourceType = [];
        if (!showImages) {
            skipResourceType.push('image');
        }
        if (!showStyle) {
            skipResourceType.push('stylesheet');
            skipResourceType.push('font');
        }

        const shouldInterceptRequest = (resourceType) => {
            return skipResourceType.includes(resourceType);
        };

        if (!showImages || !showStyle) {
            // Access the underlying Puppeteer page
            const puppeteerPage = page.page || page;
            await puppeteerPage.setRequestInterception(true);
        }

        // Access the underlying Puppeteer page
        const puppeteerPage = page.page || page;
        puppeteerPage.on('request', (request) => {
            if (shouldInterceptRequest(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    async setupNetworkLogging(page) {
        try {
            const client = await page.target().createCDPSession();
            await client.send('Network.enable');
            client.on('Network.responseReceived', async ({ response }) => {
                logger.debug(`Received ${response.url} ${response.status} ${response.statusText}`);
            });
        } catch (error) {
            logger.error('Error setting up network logging:', error);
        }
    }

    async setupDownloadDirectoryForPage(page) {
        try {
            if (page && typeof page.target === 'function') {
                const client = await page.target().createCDPSession();
                
                await client.send('Page.setDownloadBehavior', {
                    behavior: 'allow',
                    downloadPath: this.downloadPath
                });
            }
        } catch (error) {
            logger.error('Error setting download directory for page:', error);
        }
    }

    async switchToPageByIndex(index) {
        try {
            const pages = await this.browser.pages();
            if (index < 0 || index >= pages.length) {
                throw new Error(`Invalid page index: ${index}. Total pages: ${pages.length}`);
            }
            
            const page = pages[index];
            if (page) {
                await page.bringToFront();
                this.activePage = page;
                this.metrics.tabSwitches++;
                logger.debug(`Switched to page at index ${index}`);
                return true;
            } else {
                throw new Error(`No page found at index ${index}`);
            }
        } catch (error) {
            logger.error(`Failed to switch to page index ${index}:`, error);
            throw error;
        }
    }

    async switchToPageByUrl(url) {
        const index = await this.findNormalizedUrlIndex(url);
        if (index !== -1) {
            await this.switchToPageByIndex(index);
            return true;
        }
        return false;
    }

    async findActivePage(timeout = 30000) {
        if (this.findActivePageEvent) {
            return;
        }
        this.stopFindActivePageEvent = false;
        this.findActivePageEvent = true;
        let start = new Date().getTime();
        let index = 0;
        
        while (new Date().getTime() - start < timeout && !this.stopFindActivePageEvent) {
            const pages = await this.browser.getPages();
            let visiblePages = [];
            
            for (const p of pages) {
                try {
                    let visible = await p.evaluate(() => { 
                        return document.visibilityState === 'visible'; 
                    });
                    if (visible === true) {
                        visiblePages.push(p);
                    }
                } catch (error) {
                    // Page might be closed or not ready
                    continue;
                }
            }
            
            index++;
            if (visiblePages.length) {
                this.findActivePageEvent = false;
                this.activePage = visiblePages[0];
                return;
            }
        }
        this.findActivePageEvent = false;
    }

    stopFindActivePage() {
        this.findActivePageEvent = false;
        this.stopFindActivePageEvent = true;
    }

    async getCurrentPage() {
        if (this.activePage) {
            return this.activePage;
        }
        
        const pages = await this.browser.getPages();
        if (pages.length > 0) {
            this.activePage = pages[0];
            return this.activePage;
        }
        
        throw new Error('No pages available');
    }

    async getPages() {
        return await this.browser.getPages();
    }

    async getCurrentUrl(full = false) {
        const page = await this.getCurrentPage();
        let url = await page.mainFrame().url();
        if (!full) {
            const urlObject = new URL(url);
            url = urlObject.origin + urlObject.pathname;
        }
        return url;
    }

    async hasUrl(targetUrl) {
        const pages = await this.getPages();
        for (const page of pages) {
            const url = await page.mainFrame().url();
            if (this.equalDomain(url, targetUrl)) {
                return true;
            }
        }
        return false;
    }

    async clickDownloadAndWait(selector, filePattern, options = {}) {
        const currentPage = await this.getCurrentPage();
        
        try {
            // Click the download link
            await currentPage.click(selector);
            logger.info(`Clicked download link: ${selector}`);
            this.metrics.downloads++;

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

    async findAndClickDownloadLink(keywords, filePattern, options = {}) {
        const currentPage = await this.getCurrentPage();

        try {
            // Find download links containing the keywords
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
        return await this.fileMonitorWait(pattern, mergedOptions);
    }

    async fileMonitorWait(pattern, options) {
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
                    
                    matchedFiles.push({
                        path: filePath,
                        name: fileName,
                        size: stats.size,
                        modified: stats.mtime,
                        directory: this.downloadPath
                    });
                }
            }
        } catch (error) {
            logger.error(`Cannot read directory ${this.downloadPath}:`, error);
        }

        // Sort by modification date (newest first)
        return matchedFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    }

    async downloadVSCodeFiles() {
        try {
            const currentPage = await this.getCurrentPage();
            
            // Navigate to VSCode download page
            await this.openUrl('https://code.visualstudio.com/', {
                waitForComplete: true,
                timeout: 120000
            });

            // Wait for page to load
            await currentPage.waitForTimeout(3000);

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

    getInfo() {
        return {
            ...super.getInfo(),
            downloadPath: this.downloadPath,
            urlComparisonStrict: this.urlComparisonStrict,
            metrics: this.metrics
        };
    }
}

module.exports = EnhancedPage;
