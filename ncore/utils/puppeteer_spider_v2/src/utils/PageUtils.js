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

class PageUtils {
    constructor() {
        this.defaultTimeout = 30000;
        this.defaultRetries = 3;
        this.defaultDelay = 1000;
    }

    async safeClick(page, selector, options = {}) {
        const retries = options.retries || this.defaultRetries;
        const timeout = options.timeout || this.defaultTimeout;
        const delay = options.delay || this.defaultDelay;

        for (let i = 0; i < retries; i++) {
            try {
                await page.waitForSelector(selector, { timeout });
                await page.click(selector);
                logger.debug(`Successfully clicked element: ${selector}`);
                return true;
            } catch (error) {
                logger.warn(`Click attempt ${i + 1} failed for selector ${selector}:`, error.message);
                if (i < retries - 1) {
                    await page.waitForTimeout(delay);
                }
            }
        }
        throw new Error(`Failed to click element ${selector} after ${retries} attempts`);
    }

    async safeType(page, selector, text, options = {}) {
        const retries = options.retries || this.defaultRetries;
        const timeout = options.timeout || this.defaultTimeout;
        const delay = options.delay || this.defaultDelay;
        const clearFirst = options.clearFirst !== false;

        for (let i = 0; i < retries; i++) {
            try {
                await page.waitForSelector(selector, { timeout });
                
                if (clearFirst) {
                    await page.click(selector, { clickCount: 3 });
                    await page.keyboard.down('Control');
                    await page.keyboard.press('KeyA');
                    await page.keyboard.up('Control');
                }
                
                await page.type(selector, text, { delay: options.typeDelay || 50 });
                logger.debug(`Successfully typed text into element: ${selector}`);
                return true;
            } catch (error) {
                logger.warn(`Type attempt ${i + 1} failed for selector ${selector}:`, error.message);
                if (i < retries - 1) {
                    await page.waitForTimeout(delay);
                }
            }
        }
        throw new Error(`Failed to type into element ${selector} after ${retries} attempts`);
    }

    async safeWaitForSelector(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            const element = await page.waitForSelector(selector, { timeout });
            logger.debug(`Element found: ${selector}`);
            return element;
        } catch (error) {
            logger.error(`Element not found: ${selector}`, error);
            throw error;
        }
    }

    async safeEvaluate(page, pageFunction, ...args) {
        try {
            const result = await page.evaluate(pageFunction, ...args);
            logger.debug('Page evaluation completed successfully');
            return result;
        } catch (error) {
            logger.error('Page evaluation failed:', error);
            throw error;
        }
    }

    async safeGoto(page, url, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const waitUntil = options.waitUntil || 'networkidle2';
        
        try {
            const response = await page.goto(url, { 
                timeout, 
                waitUntil 
            });
            logger.debug(`Successfully navigated to: ${url}`);
            return response;
        } catch (error) {
            logger.error(`Failed to navigate to ${url}:`, error);
            throw error;
        }
    }

    async waitForElementToBeVisible(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForSelector(selector, { 
                timeout, 
                visible: true 
            });
            logger.debug(`Element is visible: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element not visible: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeHidden(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForSelector(selector, { 
                timeout, 
                hidden: true 
            });
            logger.debug(`Element is hidden: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element not hidden: ${selector}`, error);
            throw error;
        }
    }

    async scrollToElement(page, selector, options = {}) {
        try {
            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, selector);
            
            await page.waitForTimeout(options.delay || 500);
            logger.debug(`Scrolled to element: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Failed to scroll to element ${selector}:`, error);
            throw error;
        }
    }

    async scrollToBottom(page, options = {}) {
        try {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            
            await page.waitForTimeout(options.delay || 500);
            logger.debug('Scrolled to bottom of page');
            return true;
        } catch (error) {
            logger.error('Failed to scroll to bottom:', error);
            throw error;
        }
    }

    async scrollToTop(page, options = {}) {
        try {
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            
            await page.waitForTimeout(options.delay || 500);
            logger.debug('Scrolled to top of page');
            return true;
        } catch (error) {
            logger.error('Failed to scroll to top:', error);
            throw error;
        }
    }

    async getElementText(page, selector) {
        try {
            const text = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? element.textContent.trim() : null;
            }, selector);
            
            logger.debug(`Got text from element ${selector}: ${text}`);
            return text;
        } catch (error) {
            logger.error(`Failed to get text from element ${selector}:`, error);
            throw error;
        }
    }

    async getElementAttribute(page, selector, attribute) {
        try {
            const value = await page.evaluate((sel, attr) => {
                const element = document.querySelector(sel);
                return element ? element.getAttribute(attr) : null;
            }, selector, attribute);
            
            logger.debug(`Got attribute ${attribute} from element ${selector}: ${value}`);
            return value;
        } catch (error) {
            logger.error(`Failed to get attribute ${attribute} from element ${selector}:`, error);
            throw error;
        }
    }

    async isElementVisible(page, selector) {
        try {
            const isVisible = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (!element) return false;
                
                const style = window.getComputedStyle(element);
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0';
            }, selector);
            
            logger.debug(`Element ${selector} visibility: ${isVisible}`);
            return isVisible;
        } catch (error) {
            logger.error(`Failed to check visibility of element ${selector}:`, error);
            return false;
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

    async takeScreenshot(page, options = {}) {
        try {
            const screenshot = await page.screenshot(options);
            logger.debug('Screenshot taken successfully');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
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
                readyState: document.readyState
            }));
            
            logger.debug('Page info retrieved successfully');
            return info;
        } catch (error) {
            logger.error('Failed to get page info:', error);
            throw error;
        }
    }

    async injectScript(page, script, options = {}) {
        try {
            const result = await page.evaluate(script);
            logger.debug('Script injected successfully');
            return result;
        } catch (error) {
            logger.error('Failed to inject script:', error);
            throw error;
        }
    }

    async addEventListener(page, eventType, callback) {
        try {
            await page.exposeFunction('pageEventCallback', callback);
            await page.evaluate((eventType) => {
                document.addEventListener(eventType, (event) => {
                    window.pageEventCallback(event);
                });
            }, eventType);
            
            logger.debug(`Event listener added for: ${eventType}`);
            return true;
        } catch (error) {
            logger.error(`Failed to add event listener for ${eventType}:`, error);
            throw error;
        }
    }

    async removeAllListeners(page) {
        try {
            await page.evaluate(() => {
                const events = ['click', 'submit', 'change', 'input'];
                events.forEach(eventType => {
                    const elements = document.querySelectorAll('*');
                    elements.forEach(element => {
                        element.removeEventListener(eventType, () => {});
                    });
                });
            });
            
            logger.debug('All event listeners removed');
            return true;
        } catch (error) {
            logger.error('Failed to remove event listeners:', error);
            throw error;
        }
    }
}

module.exports = PageUtils;
