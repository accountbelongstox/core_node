'use strict';

const logger = require('#@logger');
const globalVars = require('#@global_vars');
const SpiderEngine = require('./src/core/SpiderEngine');
const IframeUtils = require('./src/utils/iframe/IframeUtils');

let defaultEngine = null;

class Fetcher {
    constructor() {
        this.engine = null;
        this.session = null;
        this.currentPage = null;
        this.isInitialized = false;
    }

    async initialize(browserType = 'edge', options = {}) {
        try {
            logger.info('Initializing Fetcher with browser type:', browserType);

            if (!defaultEngine) {
                defaultEngine = new SpiderEngine();
                await defaultEngine.initialize();
            }
            this.engine = defaultEngine;

            this.session = await this.engine.createSession({
                preset: 'desktop',
                browser: browserType,
                headless: options.headless !== false,
                viewport: options.viewport || { width: 1920, height: 1080 }
            });

            this.currentPage = await this.session.newPage();
            this.isInitialized = true;

            logger.success('Fetcher initialized successfully');
            return this;
        } catch (error) {
            logger.error('Failed to initialize Fetcher:', error);
            throw error;
        }
    }

    async fetch(url, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Fetcher not initialized. Call initialize() first.');
        }

        try {
            logger.info('Fetching URL:', url);

            const timeout = options.timeout || globalVars.PUPPETEER_NAVIGATION_TIMEOUT_MS;
            const timeoutMinutes = Math.round(timeout / 60000);
            logger.info(`Navigation will timeout after ${timeoutMinutes} minute(s) (${timeout}ms)`);

            await this.currentPage.goto(url, {
                waitUntil: options.waitUntil || 'networkidle2',
                timeout: timeout
            });

            const content = await this.currentPage.content();
            const finalUrl = await this.currentPage.evaluate(() => window.location.href);

            logger.success('Page fetched successfully:', finalUrl);

            return {
                content: content,
                contentType: 'text/html',
                isText: true,
                isBinary: false,
                url: finalUrl,
                status: 200
            };
        } catch (error) {
            logger.error('Failed to fetch URL:', error);
            throw error;
        }
    }

    async takeScreenshot(options = {}) {
        if (!this.isInitialized) {
            throw new Error('Fetcher not initialized. Call initialize() first.');
        }

        try {
            logger.info('Taking screenshot');

            const screenshot = await this.currentPage.screenshot({
                path: options.path,
                fullPage: options.fullPage !== false,
                type: options.type || 'png'
            });

            logger.success('Screenshot taken successfully');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            throw error;
        }
    }

    async getPage() {
        if (!this.isInitialized) {
            throw new Error('Fetcher not initialized. Call initialize() first.');
        }
        return this.currentPage;
    }

    async getBrowser() {
        if (!this.session) {
            throw new Error('Session not initialized. Call initialize() first.');
        }
        return this.session.getBrowser();
    }

    async close() {
        try {
            if (this.currentPage) {
                await this.currentPage.close();
                this.currentPage = null;
            }
            if (this.session) {
                await this.session.close();
                this.session = null;
            }
            this.isInitialized = false;
            logger.info('Fetcher closed successfully');
        } catch (error) {
            logger.error('Failed to close Fetcher:', error);
            throw error;
        }
    }

    async fetchIframeContent(url, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Fetcher not initialized. Call initialize() first.');
        }

        try {
            logger.info('Fetching iframe content from URL:', url);

            const timeout = options.timeout || globalVars.PUPPETEER_NAVIGATION_TIMEOUT_MS;
            const timeoutMinutes = Math.round(timeout / 60000);
            logger.info(`Navigation will timeout after ${timeoutMinutes} minute(s) (${timeout}ms)`);

            await this.currentPage.goto(url, {
                waitUntil: options.waitUntil || 'networkidle2',
                timeout: timeout
            });

            const iframeUtils = new IframeUtils(this.currentPage);
            const results = await iframeUtils.getAllIframesWithContent({
                delay: options.delay || 1000,
                maxLinksPerIframe: options.maxLinksPerIframe || Infinity,
                onPageCallback: options.onPageCallback
            });

            logger.success(`Fetched content from ${results.length} iframes`);

            return {
                url: url,
                iframes: results,
                totalIframes: results.length,
                successfulIframes: results.filter(r => r.success !== false).length
            };
        } catch (error) {
            logger.error('Failed to fetch iframe content:', error);
            throw error;
        }
    }

    async fetchIframeContentRecursive(url, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Fetcher not initialized. Call initialize() first.');
        }

        try {
            logger.info('[RECURSIVE] Fetching iframe content from URL:', url);

            const timeout = options.timeout || globalVars.PUPPETEER_NAVIGATION_TIMEOUT_MS;
            const timeoutMinutes = Math.round(timeout / 60000);
            logger.info(`[RECURSIVE] Navigation will timeout after ${timeoutMinutes} minute(s) (${timeout}ms)`);

            await this.currentPage.goto(url, {
                waitUntil: options.waitUntil || 'networkidle2',
                timeout: timeout
            });

            const iframeUtils = new IframeUtils(this.currentPage);
            const results = await iframeUtils.recursiveCrawlAllIframes({
                maxDepth: options.maxDepth || 10,
                delay: options.delay || 1000,
                maxLinksPerPage: options.maxLinksPerPage || Infinity,
                sameOriginOnly: options.sameOriginOnly !== false,
                skipHashLinks: options.skipHashLinks !== false,
                onPageCallback: options.onPageCallback,
                onFailedCallback: options.onFailedCallback
            });

            logger.success(`[RECURSIVE] Recursively crawled ${results.length} iframes`);

            return {
                url: url,
                iframes: results,
                totalIframes: results.length,
                successfulIframes: results.filter(r => r.success !== false).length
            };
        } catch (error) {
            logger.error('[RECURSIVE] Failed to fetch iframe content:', error);
            throw error;
        }
    }

    async fetchSingleIframeContent(url, iframeIndex = 0, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Fetcher not initialized. Call initialize() first.');
        }

        try {
            logger.info(`Fetching iframe ${iframeIndex} content from URL:`, url);

            const timeout = options.timeout || globalVars.PUPPETEER_NAVIGATION_TIMEOUT_MS;
            const timeoutMinutes = Math.round(timeout / 60000);
            logger.info(`Navigation will timeout after ${timeoutMinutes} minute(s) (${timeout}ms)`);

            await this.currentPage.goto(url, {
                waitUntil: options.waitUntil || 'networkidle2',
                timeout: timeout
            });

            const iframeUtils = new IframeUtils(this.currentPage);
            const result = await iframeUtils.extractIframeContentByIndex(iframeIndex, {
                delay: options.delay || 1000,
                maxLinks: options.maxLinks || Infinity
            });

            logger.success(`Fetched content from iframe ${iframeIndex}`);

            return {
                url: url,
                iframeData: result
            };
        } catch (error) {
            logger.error(`Failed to fetch iframe ${iframeIndex} content:`, error);
            throw error;
        }
    }

    async collectResources(options = {}) {
        if (!this.isInitialized || !this.currentPage) {
            throw new Error('Fetcher not initialized or no active page');
        }

        if (typeof this.currentPage.collectResources === 'function') {
            return await this.currentPage.collectResources(options);
        } else {
            logger.warn('Current page does not support resource collection (EnhancedPage required)');
            return null;
        }
    }

    getResourceCollector() {
        if (!this.isInitialized || !this.currentPage) {
            return null;
        }

        if (typeof this.currentPage.getResourceCollector === 'function') {
            return this.currentPage.getResourceCollector();
        } else {
            return null;
        }
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            hasSession: this.session !== null,
            hasPage: this.currentPage !== null,
            supportsResourceCollection: this.currentPage && typeof this.currentPage.collectResources === 'function'
        };
    }
}

module.exports = Fetcher;
