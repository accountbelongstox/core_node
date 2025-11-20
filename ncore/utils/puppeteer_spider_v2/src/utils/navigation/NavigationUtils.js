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
const BaseUtils = require('../base/BaseUtils');

class NavigationUtils extends BaseUtils {
    constructor() {
        super();
    }

    async safeGoto(page, url, options = {}) {
        return this.safeExecute(page, async () => {
            const timeout = options.timeout || this.defaultTimeout;
            const waitUntil = options.waitUntil || 'networkidle2';
            
            const response = await page.goto(url, { 
                timeout, 
                waitUntil 
            });
            logger.debug(`Successfully navigated to: ${url}`);
            return response;
        }, options);
    }

    async waitForNavigation(page, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            const response = await page.waitForNavigation({ timeout });
            logger.debug('Navigation completed');
            return response;
        } catch (error) {
            logger.error('Navigation timeout:', error);
            throw error;
        }
    }

    async reload(page, options = {}) {
        return this.safeExecute(page, async () => {
            const response = await page.reload(options);
            logger.debug('Page reloaded');
            return response;
        }, options);
    }

    async goBack(page, options = {}) {
        return this.safeExecute(page, async () => {
            const response = await page.goBack(options);
            logger.debug('Navigated back');
            return response;
        }, options);
    }

    async goForward(page, options = {}) {
        return this.safeExecute(page, async () => {
            const response = await page.goForward(options);
            logger.debug('Navigated forward');
            return response;
        }, options);
    }

    async scrollToElement(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, selector);
            
            await this.wait(options.delay || 500);
            logger.debug(`Scrolled to element: ${selector}`);
            return true;
        }, options);
    }

    async scrollToPosition(page, x, y, options = {}) {
        return this.safeExecute(page, async () => {
            await page.evaluate((scrollX, scrollY) => {
                window.scrollTo(scrollX, scrollY);
            }, x, y);
            
            await this.wait(options.delay || 500);
            logger.debug(`Scrolled to position: ${x}, ${y}`);
            return true;
        }, options);
    }

    async scrollToBottom(page, options = {}) {
        return this.safeExecute(page, async () => {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            
            await this.wait(options.delay || 500);
            logger.debug('Scrolled to bottom of page');
            return true;
        }, options);
    }

    async scrollToTop(page, options = {}) {
        return this.safeExecute(page, async () => {
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            
            await this.wait(options.delay || 500);
            logger.debug('Scrolled to top of page');
            return true;
        }, options);
    }

    async scrollBy(page, deltaX, deltaY, options = {}) {
        return this.safeExecute(page, async () => {
            await page.evaluate((dx, dy) => {
                window.scrollBy(dx, dy);
            }, deltaX, deltaY);
            
            await this.wait(options.delay || 500);
            logger.debug(`Scrolled by: ${deltaX}, ${deltaY}`);
            return true;
        }, options);
    }

    async waitForUrl(page, urlPattern, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (pattern) => {
                    const url = window.location.href;
                    return new RegExp(pattern).test(url);
                },
                { timeout },
                urlPattern
            );
            logger.debug(`URL pattern matched: ${urlPattern}`);
            return true;
        } catch (error) {
            logger.error(`URL pattern not matched: ${urlPattern}`, error);
            throw error;
        }
    }

    async waitForText(page, text, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (searchText) => document.body.textContent.includes(searchText),
                { timeout },
                text
            );
            logger.debug(`Text found on page: ${text}`);
            return true;
        } catch (error) {
            logger.error(`Text not found on page: ${text}`, error);
            throw error;
        }
    }

    async getCurrentUrl(page) {
        try {
            const url = page.url();
            logger.debug(`Current URL: ${url}`);
            return url;
        } catch (error) {
            logger.error('Failed to get current URL:', error);
            throw error;
        }
    }

    async getPageTitle(page) {
        try {
            const title = await page.title();
            logger.debug(`Page title: ${title}`);
            return title;
        } catch (error) {
            logger.error('Failed to get page title:', error);
            throw error;
        }
    }

    async getPageInfo(page) {
        try {
            const info = await page.evaluate(() => ({
                url: window.location.href,
                title: document.title,
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                cookies: document.cookie,
                readyState: document.readyState,
                scrollPosition: {
                    x: window.scrollX,
                    y: window.scrollY
                },
                documentSize: {
                    width: document.documentElement.scrollWidth,
                    height: document.documentElement.scrollHeight
                }
            }));
            
            logger.debug('Page info retrieved successfully');
            return info;
        } catch (error) {
            logger.error('Failed to get page info:', error);
            throw error;
        }
    }
}

module.exports = NavigationUtils;
