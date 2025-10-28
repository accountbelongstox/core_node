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
const IPage = require('../interfaces/IPage');

class StandardPage extends IPage {
    constructor(page, options = {}) {
        super();
        this.page = page;
        this.options = options;
        this.url = null;
        this.title = null;
        this.isInitialized = false;
        this.metrics = {
            requests: 0,
            responses: 0,
            errors: 0,
            clicks: 0,
            types: 0,
            navigations: 0
        };
    }

    async initialize() {
        try {
            // Set up event listeners
            this.setupEventListeners();
            
            // Set viewport if specified
            if (this.options.viewport) {
                await this.page.setViewport(this.options.viewport);
            }
            
            // Set user agent if specified
            if (this.options.userAgent) {
                await this.page.setUserAgent(this.options.userAgent);
            }
            
            this.isInitialized = true;
            logger.debug('StandardPage initialized');
        } catch (error) {
            logger.error('Failed to initialize StandardPage:', error);
            throw error;
        }
    }

    setupEventListeners() {
        this.page.on('request', (request) => {
            this.metrics.requests++;
            logger.debug(`Request: ${request.method()} ${request.url()}`);
        });

        this.page.on('response', (response) => {
            this.metrics.responses++;
            logger.debug(`Response: ${response.status()} ${response.url()}`);
        });

        this.page.on('error', (error) => {
            this.metrics.errors++;
            logger.error('Page error:', error);
        });

        this.page.on('pageerror', (error) => {
            this.metrics.errors++;
            logger.error('Page JavaScript error:', error);
        });
    }

    async goto(url, options = {}) {
        try {
            const gotoOptions = {
                waitUntil: options.waitUntil || 'networkidle2',
                timeout: options.timeout || this.options.timeout || 30000,
                ...options
            };

            const response = await this.page.goto(url, gotoOptions);
            this.url = url;
            this.metrics.navigations++;
            
            logger.debug(`Navigated to: ${url}`);
            return response;
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to navigate to ${url}:`, error);
            throw error;
        }
    }

    async click(selector, options = {}) {
        try {
            await this.page.waitForSelector(selector, { 
                timeout: options.timeout || 5000 
            });
            
            await this.page.click(selector, options);
            this.metrics.clicks++;
            
            logger.debug(`Clicked element: ${selector}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to click element ${selector}:`, error);
            throw error;
        }
    }

    async type(selector, text, options = {}) {
        try {
            await this.page.waitForSelector(selector, { 
                timeout: options.timeout || 5000 
            });
            
            await this.page.type(selector, text, options);
            this.metrics.types++;
            
            logger.debug(`Typed text into element: ${selector}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to type into element ${selector}:`, error);
            throw error;
        }
    }

    async screenshot(options = {}) {
        try {
            const screenshotOptions = {
                type: 'png',
                fullPage: false,
                ...options
            };

            const screenshot = await this.page.screenshot(screenshotOptions);
            logger.debug('Screenshot taken');
            
            return screenshot;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to take screenshot:', error);
            throw error;
        }
    }

    async evaluate(fn, ...args) {
        try {
            const result = await this.page.evaluate(fn, ...args);
            logger.debug('JavaScript evaluated');
            
            return result;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to evaluate JavaScript:', error);
            throw error;
        }
    }

    async waitForSelector(selector, options = {}) {
        try {
            await this.page.waitForSelector(selector, options);
            logger.debug(`Element appeared: ${selector}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Element did not appear: ${selector}`, error);
            throw error;
        }
    }

    async waitForFunction(fn, options = {}) {
        try {
            await this.page.waitForFunction(fn, options);
            logger.debug('Function condition met');
        } catch (error) {
            this.metrics.errors++;
            logger.error('Function condition not met:', error);
            throw error;
        }
    }

    async getContent() {
        try {
            const content = await this.page.content();
            logger.debug('Page content retrieved');
            
            return content;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get page content:', error);
            throw error;
        }
    }

    async getTitle() {
        try {
            this.title = await this.page.title();
            logger.debug(`Page title: ${this.title}`);
            
            return this.title;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get page title:', error);
            throw error;
        }
    }

    async getUrl() {
        try {
            this.url = this.page.url();
            logger.debug(`Page URL: ${this.url}`);
            
            return this.url;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get page URL:', error);
            throw error;
        }
    }

    async select(selector, value) {
        try {
            await this.page.waitForSelector(selector);
            await this.page.select(selector, value);
            
            logger.debug(`Selected value ${value} in element: ${selector}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to select value in element ${selector}:`, error);
            throw error;
        }
    }

    async hover(selector) {
        try {
            await this.page.waitForSelector(selector);
            await this.page.hover(selector);
            
            logger.debug(`Hovered over element: ${selector}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to hover over element ${selector}:`, error);
            throw error;
        }
    }

    async scrollTo(selector) {
        try {
            await this.page.waitForSelector(selector);
            await this.page.evaluate((sel) => {
                document.querySelector(sel).scrollIntoView();
            }, selector);
            
            logger.debug(`Scrolled to element: ${selector}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to scroll to element ${selector}:`, error);
            throw error;
        }
    }

    async setViewport(viewport) {
        try {
            await this.page.setViewport(viewport);
            logger.debug(`Viewport set to: ${JSON.stringify(viewport)}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to set viewport:', error);
            throw error;
        }
    }

    async setUserAgent(userAgent) {
        try {
            await this.page.setUserAgent(userAgent);
            logger.debug(`User agent set to: ${userAgent}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to set user agent:', error);
            throw error;
        }
    }

    async addCookie(cookie) {
        try {
            await this.page.setCookie(cookie);
            logger.debug(`Cookie added: ${cookie.name}`);
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to add cookie:', error);
            throw error;
        }
    }

    async getCookies() {
        try {
            const cookies = await this.page.cookies();
            logger.debug(`Retrieved ${cookies.length} cookies`);
            
            return cookies;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get cookies:', error);
            throw error;
        }
    }

    async clearCookies() {
        try {
            await this.page.deleteCookie();
            logger.debug('Cookies cleared');
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to clear cookies:', error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
                this.isInitialized = false;
                logger.debug('StandardPage closed');
            }
        } catch (error) {
            logger.error('Failed to close StandardPage:', error);
            throw error;
        }
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            url: this.url,
            title: this.title,
            metrics: this.metrics,
            options: this.options
        };
    }
}

module.exports = StandardPage;
