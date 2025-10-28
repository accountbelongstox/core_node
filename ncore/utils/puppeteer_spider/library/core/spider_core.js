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
const puppeteer = require('puppeteer');
const ConfigManager = require('../config/config_manager');
const BrowserDetector = require('../browser_detector');
const BrowserInstallerManager = require('../browser_installer_manager');

// Declare variables
let configManager = null;
let browserDetector = null;
let browserInstallerManager = null;

class SpiderCore {
    constructor(options) {
        this.options = options;
        this.browser = null;
        this.page = null;
        this.config = null;
        this.isInitialized = false;
        this.sessionId = `core_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async initialize() {
        try {
            logger.info(`Initializing SpiderCore: ${this.sessionId}`);
            
            // Initialize managers
            configManager = new ConfigManager(this.options.browser);
            browserDetector = new BrowserDetector();
            browserInstallerManager = new BrowserInstallerManager();
            
            // Initialize configuration
            await configManager.initialize();
            this.config = configManager.updateConfig(this.options);
            
            // Setup browser
            await this.setupBrowser();
            
            // Launch browser
            await this.launchBrowser();
            
            this.isInitialized = true;
            logger.info(`SpiderCore initialized: ${this.sessionId}`);
            
            return this;
        } catch (error) {
            logger.error(`Failed to initialize SpiderCore: ${error.message}`);
            throw error;
        }
    }

    async setupBrowser() {
        try {
            const browserType = this.options.browser || 'edge';
            
            // Check if browser is available
            const isAvailable = await browserDetector.isBrowserAvailable(browserType);
            
            if (isAvailable) {
                const browserInfo = browserDetector.getBrowserInfo(browserType);
                if (browserInfo && browserInfo.executablePath) {
                    this.config.executablePath = browserInfo.executablePath;
                    logger.info(`Using ${browserType} at: ${browserInfo.executablePath}`);
                    return;
                }
            }
            
            // Try to install browser
            logger.info(`${browserType} not found, attempting installation...`);
            const result = await browserInstallerManager.installBrowserWithFallback(browserType);
            
            if (result.success) {
                const browserPath = await browserInstallerManager.getBrowserPath(result.browserType);
                if (browserPath) {
                    this.config.executablePath = browserPath;
                    logger.info(`Using ${result.browserType} at: ${browserPath}`);
                }
            }
        } catch (error) {
            logger.warn('Browser setup failed:', error.message);
        }
    }

    async launchBrowser() {
        try {
            // Build browser arguments
            this.config.args = configManager.buildBrowserArgs();
            this.config.ignoreDefaultArgs = configManager.getIgnoreDefaultArgs();
            
            // Launch browser
            this.browser = await puppeteer.launch(this.config);
            this.page = await this.browser.newPage();
            await this.page.setViewport(this.config.viewport);
            
            logger.info(`Browser launched: ${this.options.browser}`);
        } catch (error) {
            logger.error('Failed to launch browser:', error.message);
            throw error;
        }
    }

    // Unified page operations
    async navigate(url, options = {}) {
        this.ensureInitialized();
        try {
            await this.page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: options.timeout || this.config.timeout,
                ...options
            });
            logger.info(`Navigated to: ${url}`);
            return this.page;
        } catch (error) {
            logger.error(`Failed to navigate to ${url}:`, error.message);
            throw error;
        }
    }

    async click(selector, options = {}) {
        this.ensureInitialized();
        try {
            await this.page.waitForSelector(selector, { timeout: options.timeout || 10000 });
            await this.page.click(selector, options);
            logger.info(`Clicked element: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Failed to click element ${selector}:`, error.message);
            throw error;
        }
    }

    async type(selector, text, options = {}) {
        this.ensureInitialized();
        try {
            await this.page.waitForSelector(selector, { timeout: options.timeout || 10000 });
            await this.page.type(selector, text, options);
            logger.info(`Typed text into: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Failed to type text into ${selector}:`, error.message);
            throw error;
        }
    }

    async waitFor(selector, options = {}) {
        this.ensureInitialized();
        try {
            const element = await this.page.waitForSelector(selector, {
                timeout: options.timeout || 30000,
                ...options
            });
            logger.info(`Element found: ${selector}`);
            return element;
        } catch (error) {
            logger.error(`Failed to wait for element ${selector}:`, error.message);
            throw error;
        }
    }

    async screenshot(options = {}) {
        this.ensureInitialized();
        try {
            const screenshot = await this.page.screenshot({
                fullPage: true,
                ...options
            });
            logger.info('Screenshot taken');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take screenshot:', error.message);
            throw error;
        }
    }

    async evaluate(fn, ...args) {
        this.ensureInitialized();
        try {
            const result = await this.page.evaluate(fn, ...args);
            logger.info('Script executed successfully');
            return result;
        } catch (error) {
            logger.error('Failed to execute script:', error.message);
            throw error;
        }
    }

    // Unified content extraction
    async extract(options = {}) {
        this.ensureInitialized();
        try {
            const extractor = options.extractor || this.getDefaultExtractor();
            const data = await this.page.evaluate(extractor);
            logger.info('Content extracted successfully');
            return data;
        } catch (error) {
            logger.error('Failed to extract content:', error.message);
            throw error;
        }
    }

    getDefaultExtractor() {
        return () => {
            return {
                title: document.title,
                url: window.location.href,
                text: document.body.textContent,
                links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                })),
                images: Array.from(document.querySelectorAll('img[src]')).map(img => ({
                    src: img.src,
                    alt: img.alt
                }))
            };
        };
    }

    // Unified download operations
    async download(target, options = {}) {
        this.ensureInitialized();
        try {
            if (typeof target === 'string') {
                // URL download
                return await this.downloadFromUrl(target, options);
            } else if (target.selector) {
                // Element download
                return await this.downloadFromElement(target.selector, options);
            } else {
                throw new Error('Invalid download target');
            }
        } catch (error) {
            logger.error('Download failed:', error.message);
            throw error;
        }
    }

    async downloadFromUrl(url, options = {}) {
        try {
            const response = await this.page.goto(url, { waitUntil: 'networkidle0' });
            logger.info(`Downloaded from URL: ${url}`);
            return { success: true, url, response };
        } catch (error) {
            logger.error(`Failed to download from URL ${url}:`, error.message);
            throw error;
        }
    }

    async downloadFromElement(selector, options = {}) {
        try {
            await this.page.waitForSelector(selector, { timeout: options.timeout || 10000 });
            const element = await this.page.$(selector);
            const src = await this.page.evaluate(el => el.src, element);
            logger.info(`Downloaded from element: ${selector}`);
            return { success: true, src, selector };
        } catch (error) {
            logger.error(`Failed to download from element ${selector}:`, error.message);
            throw error;
        }
    }

    // Utility methods
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('SpiderCore not initialized. Call initialize() first.');
        }
    }

    getPage() {
        this.ensureInitialized();
        return this.page;
    }

    getBrowser() {
        this.ensureInitialized();
        return this.browser;
    }

    getConfig() {
        return this.config;
    }

    getInfo() {
        return {
            sessionId: this.sessionId,
            isInitialized: this.isInitialized,
            browser: this.options.browser,
            config: this.config
        };
    }

    async close() {
        try {
            if (this.isInitialized) {
                logger.info(`Closing SpiderCore: ${this.sessionId}`);
                
                if (this.browser) {
                    await this.browser.close();
                    this.browser = null;
                    this.page = null;
                }
                
                this.isInitialized = false;
                logger.info(`SpiderCore closed: ${this.sessionId}`);
            }
        } catch (error) {
            logger.error('Failed to close SpiderCore:', error.message);
            throw error;
        }
    }
}

module.exports = SpiderCore;
