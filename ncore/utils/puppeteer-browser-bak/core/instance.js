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

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('#@logger');
const config = require('./config.js');

class PuppeteerSpiderInstance {
    constructor(customConfig = {}, presetMode = null) {
        this.config = null;
        this.puppeteerBrowser = null;
        this.puppeteerPages = new Map();
        this.currentPuppeteerPage = null;
        this.isInitialized = false;
        this.customConfig = customConfig;
        this.presetMode = presetMode;
    }

    /**
     * Initialize Puppeteer spider instance
     */
    async initializePuppeteerSpiderInstance() {
        try {
            // Initialize configuration
            this.config = await config.initPuppeteerSpiderConfig(this.customConfig, this.presetMode);

            // Validate executable path
            if (!this.config.executablePath) {
                throw new Error('Chrome executable path not found. Please ensure Chrome is installed or will be installed automatically.');
            }

            // Enable stealth mode with all evasion techniques
            puppeteer.use(StealthPlugin());

            // Build launch options
            const launchOptions = {
                headless: this.config.headless,
                devtools: this.config.devtools,
                executablePath: this.config.executablePath,
                args: config.buildPuppeteerChromeArgs(this.config),
                ignoreDefaultArgs: config.buildPuppeteerChromeIgnoreArgs(this.config.mute),
                defaultViewport: {
                    width: this.config.width,
                    height: this.config.height,
                    deviceScaleFactor: this.config.deviceScaleFactor,
                    isMobile: this.config.mobile,
                    userAgent: this.config.userAgent
                }
            };
            
            // Launch browser with stealth protection
            this.puppeteerBrowser = await puppeteer.launch(launchOptions);
            
            // Create initial page
            await this.createPuppeteerPage();

            this.isInitialized = true;
            logger.info('Puppeteer spider instance initialized successfully with stealth protection');
            const executable = launchOptions.executablePath || 'bundled Chromium';
            logger.info(
                `Puppeteer launch details: headless=${launchOptions.headless}, ` +
                `viewport=${this.config.width}x${this.config.height} (scale ${this.config.deviceScaleFactor}), ` +
                `executable=${executable}`
            );
            if (this.config.proxy) {
                logger.info(`Puppeteer proxy: ${this.config.proxy}`);
            }
            logger.info(`Puppeteer user agent: ${this.config.userAgent}`);

        } catch (error) {
            logger.error(`Failed to initialize Puppeteer spider instance: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create new Puppeteer page
     * @returns {Object} Puppeteer page object
     */
    async createPuppeteerPage() {
        try {
            const page = await this.puppeteerBrowser.newPage();
            
            // Set user agent
            await page.setUserAgent(this.config.userAgent);
            
            // Set viewport
            await page.setViewport({
                width: this.config.width,
                height: this.config.height,
                deviceScaleFactor: this.config.deviceScaleFactor,
                isMobile: this.config.mobile
            });
            
            // Set request interception for performance
            if (!this.config.showImages || !this.config.showStyle) {
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    const resourceType = req.resourceType();
                    
                    // Block images if showImages is false
                    if (!this.config.showImages && resourceType === 'image') {
                        req.abort();
                        return;
                    }
                    
                    // Block stylesheets if showStyle is false
                    if (!this.config.showStyle && resourceType === 'stylesheet') {
                        req.abort();
                        return;
                    }
                    
                    // Block fonts if showStyle is false
                    if (!this.config.showStyle && resourceType === 'font') {
                        req.abort();
                        return;
                    }
                    
                    // Block other resource types if both are false
                    if (!this.config.showImages && !this.config.showStyle && 
                        ['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                        req.abort();
                        return;
                    }
                    
                    req.continue();
                });
            }
            
            // Handle page errors
            page.on('error', (error) => {
                logger.error(`Puppeteer page error: ${error.message}`);
            });
            
            page.on('pageerror', (error) => {
                logger.error(`Puppeteer page JavaScript error: ${error.message}`);
            });
            
            const pageId = Date.now();
            this.puppeteerPages.set(pageId, page);
            this.currentPuppeteerPage = page;
            
            return page;
        } catch (error) {
            logger.error(`Failed to create Puppeteer page: ${error.message}`);
            throw error;
        }
    }

    /**
     * Smart URL opening with Puppeteer tab management
     * @param {string} url - URL to open
     * @param {Object} options - Options for opening
     * @returns {Object} Puppeteer page object
     */
    async openUrlWithPuppeteer(url, options = {}) {
        try {
            const normalizedUrl = this.normalizeUrl(url);
            const targetPage = this.findPuppeteerPageByUrl(normalizedUrl);
            
            if (targetPage) {
                // Switch to existing page
                await targetPage.bringToFront();
                this.currentPuppeteerPage = targetPage;
                logger.info(`Switched to existing Puppeteer page for URL: ${normalizedUrl}`);
                return targetPage;
            } else {
                // Open new page or use current page
                let page = this.currentPuppeteerPage;
                
                if (options.newTab || !page) {
                    page = await this.createPuppeteerPage();
                }
                
                // Navigate to URL
                await page.goto(normalizedUrl, {
                    waitUntil: this.config.waitForComplete ? 'networkidle2' : 'domcontentloaded',
                    timeout: this.config.timeout
                });
                
                this.currentPuppeteerPage = page;
                logger.info(`Opened URL with Puppeteer: ${normalizedUrl}`);
                return page;
            }
        } catch (error) {
            logger.error(`Failed to open URL with Puppeteer ${url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Normalize URL for comparison
     * @param {string} url - URL to normalize
     * @returns {string} Normalized URL
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            let normalized = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
            
            // Remove trailing slash
            if (normalized.endsWith('/') && normalized.length > 1) {
                normalized = normalized.slice(0, -1);
            }
            
            return normalized;
        } catch (error) {
            return url;
        }
    }

    /**
     * Find Puppeteer page by URL
     * @param {string} url - URL to find
     * @returns {Object|null} Puppeteer page object or null
     */
    findPuppeteerPageByUrl(url) {
        for (const [pageId, page] of this.puppeteerPages) {
            try {
                const pageUrl = page.url();
                if (this.normalizeUrl(pageUrl) === url) {
                    return page;
                }
            } catch (error) {
                // Page might be closed
                continue;
            }
        }
        return null;
    }

    /**
     * Inject JavaScript code into Puppeteer page
     * @param {string} script - JavaScript code to inject
     * @param {Object} options - Injection options
     * @returns {any} Script execution result
     */
    async injectScriptIntoPuppeteerPage(script, options = {}) {
        try {
            const page = options.page || this.currentPuppeteerPage;
            if (!page) {
                throw new Error('No Puppeteer page available for script injection');
            }
            
            const result = await page.evaluate(script);
            logger.info('JavaScript injected successfully into Puppeteer page');
            return result;
        } catch (error) {
            logger.error(`Failed to inject JavaScript into Puppeteer page: ${error.message}`);
            throw error;
        }
    }

    /**
     * Inject JavaScript file into Puppeteer page
     * @param {string} filePath - Path to JavaScript file
     * @param {Object} options - Injection options
     * @returns {any} Script execution result
     */
    async injectScriptFileIntoPuppeteerPage(filePath, options = {}) {
        try {
            const fs = require('fs');
            const script = fs.readFileSync(filePath, 'utf8');
            return await this.injectScriptIntoPuppeteerPage(script, options);
        } catch (error) {
            logger.error(`Failed to inject script file into Puppeteer page ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Inject stealth.js into Puppeteer page
     * @param {Object} options - Injection options
     * @returns {any} Script execution result
     */
    async injectStealthJsIntoPuppeteerPage(options = {}) {
        try {
            if (this.config.stealthJsPath && fs.existsSync(this.config.stealthJsPath)) {
                return await this.injectScriptFileIntoPuppeteerPage(this.config.stealthJsPath, options);
            } else {
                logger.warn('Stealth.js file not found, skipping injection');
                return null;
            }
        } catch (error) {
            logger.error(`Failed to inject stealth.js into Puppeteer page: ${error.message}`);
            throw error;
        }
    }

    /**
     * Wait for element in Puppeteer page
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options
     * @returns {Object} Element object
     */
    async waitForElementInPuppeteerPage(selector, options = {}) {
        try {
            const page = options.page || this.currentPuppeteerPage;
            const element = await page.waitForSelector(selector, {
                timeout: options.timeout || this.config.timeout,
                visible: options.visible !== false
            });
            return element;
        } catch (error) {
            logger.error(`Failed to wait for element in Puppeteer page ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Click element in Puppeteer page
     * @param {string} selector - CSS selector
     * @param {Object} options - Click options
     */
    async clickElementInPuppeteerPage(selector, options = {}) {
        try {
            const page = options.page || this.currentPuppeteerPage;
            await page.click(selector, options);
            logger.info(`Clicked element in Puppeteer page: ${selector}`);
        } catch (error) {
            logger.error(`Failed to click element in Puppeteer page ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Type text in Puppeteer page
     * @param {string} selector - CSS selector
     * @param {string} text - Text to type
     * @param {Object} options - Type options
     */
    async typeTextInPuppeteerPage(selector, text, options = {}) {
        try {
            const page = options.page || this.currentPuppeteerPage;
            await page.type(selector, text, options);
            logger.info(`Typed text in Puppeteer page element: ${selector}`);
        } catch (error) {
            logger.error(`Failed to type text in Puppeteer page element ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Take screenshot with Puppeteer
     * @param {string} path - Screenshot path
     * @param {Object} options - Screenshot options
     */
    async takeScreenshotWithPuppeteer(path, options = {}) {
        try {
            const page = options.page || this.currentPuppeteerPage;
            await page.screenshot({
                path: path,
                fullPage: options.fullPage || false,
                quality: options.quality || 80
            });
            logger.info(`Puppeteer screenshot saved: ${path}`);
        } catch (error) {
            logger.error(`Failed to take Puppeteer screenshot: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get Puppeteer page content
     * @param {Object} options - Content options
     * @returns {string} Page content
     */
    async getPuppeteerPageContent(options = {}) {
        try {
            const page = options.page || this.currentPuppeteerPage;
            const content = await page.content();
            return content;
        } catch (error) {
            logger.error(`Failed to get Puppeteer page content: ${error.message}`);
            throw error;
        }
    }

    /**
     * Close Puppeteer spider instance
     */
    async closePuppeteerSpiderInstance() {
        try {
            if (this.puppeteerBrowser) {
                await this.puppeteerBrowser.close();
                this.puppeteerBrowser = null;
            }
            
            this.puppeteerPages.clear();
            this.currentPuppeteerPage = null;
            this.isInitialized = false;
            
            logger.info('Puppeteer spider instance closed');
        } catch (error) {
            logger.error(`Failed to close Puppeteer spider instance: ${error.message}`);
        }
    }
}

module.exports = PuppeteerSpiderInstance; 
