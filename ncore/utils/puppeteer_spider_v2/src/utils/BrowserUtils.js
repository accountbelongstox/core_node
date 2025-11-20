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

class BrowserUtils {
    constructor() {
        this.defaultTimeout = 30000;
        this.defaultRetries = 3;
        this.defaultDelay = 1000;
    }

    async safeExecute(page, operation, options = {}) {
        const retries = options.retries || this.defaultRetries;
        const timeout = options.timeout || this.defaultTimeout;
        const delay = options.delay || this.defaultDelay;

        for (let i = 0; i < retries; i++) {
            try {
                const result = await Promise.race([
                    operation(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Operation timeout')), timeout)
                    )
                ]);
                return result;
            } catch (error) {
                logger.warn(`Operation attempt ${i + 1} failed:`, error.message);
                if (i < retries - 1) {
                    await this.wait(delay);
                }
            }
        }
        throw new Error(`Operation failed after ${retries} attempts`);
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForElement(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false;
        
        try {
            const element = await page.waitForSelector(selector, { 
                timeout, 
                visible 
            });
            logger.debug(`Element found: ${selector}`);
            return element;
        } catch (error) {
            logger.error(`Element not found: ${selector}`, error);
            throw error;
        }
    }

    async waitForElements(page, selectors, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false;
        const results = {};
        
        try {
            const promises = selectors.map(async (selector) => {
                try {
                    const element = await page.waitForSelector(selector, { 
                        timeout, 
                        visible 
                    });
                    return { selector, element, found: true };
                } catch (error) {
                    return { selector, element: null, found: false, error };
                }
            });
            
            const results = await Promise.all(promises);
            results.forEach(result => {
                results[result.selector] = result;
            });
            
            logger.debug(`Elements search completed for ${selectors.length} selectors`);
            return results;
        } catch (error) {
            logger.error('Failed to wait for elements:', error);
            throw error;
        }
    }

    async waitForAnyElement(page, selectors, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false;
        
        try {
            const promises = selectors.map(selector => 
                page.waitForSelector(selector, { timeout, visible })
                    .then(element => ({ selector, element }))
                    .catch(() => null)
            );
            
            const results = await Promise.allSettled(promises);
            const found = results.find(result => 
                result.status === 'fulfilled' && result.value !== null
            );
            
            if (found) {
                logger.debug(`Element found: ${found.value.selector}`);
                return found.value;
            }
            
            throw new Error(`None of the elements found: ${selectors.join(', ')}`);
        } catch (error) {
            logger.error('Failed to wait for any element:', error);
            throw error;
        }
    }

    async safeClick(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await this.waitForElement(page, selector, options);
            await page.click(selector);
            logger.debug(`Successfully clicked element: ${selector}`);
            return true;
        }, options);
    }

    async safeType(page, selector, text, options = {}) {
        return this.safeExecute(page, async () => {
            await this.waitForElement(page, selector, options);
            
            if (options.clearFirst !== false) {
                await page.click(selector, { clickCount: 3 });
                await page.keyboard.down('Control');
                await page.keyboard.press('KeyA');
                await page.keyboard.up('Control');
            }
            
            await page.type(selector, text, { delay: options.typeDelay || 50 });
            logger.debug(`Successfully typed text into element: ${selector}`);
            return true;
        }, options);
    }

    async safeSelect(page, selector, value, options = {}) {
        return this.safeExecute(page, async () => {
            await this.waitForElement(page, selector, options);
            await page.select(selector, value);
            logger.debug(`Successfully selected value ${value} in element: ${selector}`);
            return true;
        }, options);
    }

    async safeHover(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await this.waitForElement(page, selector, options);
            await page.hover(selector);
            logger.debug(`Successfully hovered over element: ${selector}`);
            return true;
        }, options);
    }

    async safeFocus(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await this.waitForElement(page, selector, options);
            await page.focus(selector);
            logger.debug(`Successfully focused element: ${selector}`);
            return true;
        }, options);
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

    async getElementProperty(page, selector, property) {
        try {
            const value = await page.evaluate((sel, prop) => {
                const element = document.querySelector(sel);
                return element ? element[prop] : null;
            }, selector, property);
            
            logger.debug(`Got property ${property} from element ${selector}: ${value}`);
            return value;
        } catch (error) {
            logger.error(`Failed to get property ${property} from element ${selector}:`, error);
            throw error;
        }
    }

    async isElementVisible(page, selector) {
        try {
            const isVisible = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (!element) return false;
                
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
            }, selector);
            
            logger.debug(`Element ${selector} visibility: ${isVisible}`);
            return isVisible;
        } catch (error) {
            logger.error(`Failed to check visibility of element ${selector}:`, error);
            return false;
        }
    }

    async isElementEnabled(page, selector) {
        try {
            const isEnabled = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? !element.disabled : false;
            }, selector);
            
            logger.debug(`Element ${selector} enabled: ${isEnabled}`);
            return isEnabled;
        } catch (error) {
            logger.error(`Failed to check if element ${selector} is enabled:`, error);
            return false;
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
            
            await this.wait(options.delay || 500);
            logger.debug(`Scrolled to element: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Failed to scroll to element ${selector}:`, error);
            throw error;
        }
    }

    async scrollToPosition(page, x, y, options = {}) {
        try {
            await page.evaluate((scrollX, scrollY) => {
                window.scrollTo(scrollX, scrollY);
            }, x, y);
            
            await this.wait(options.delay || 500);
            logger.debug(`Scrolled to position: ${x}, ${y}`);
            return true;
        } catch (error) {
            logger.error(`Failed to scroll to position ${x}, ${y}:`, error);
            throw error;
        }
    }

    async scrollToBottom(page, options = {}) {
        try {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            
            await this.wait(options.delay || 500);
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
            
            await this.wait(options.delay || 500);
            logger.debug('Scrolled to top of page');
            return true;
        } catch (error) {
            logger.error('Failed to scroll to top:', error);
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

    async handleDialog(page, accept = true, promptText = '') {
        try {
            page.on('dialog', async dialog => {
                if (accept) {
                    if (dialog.type() === 'prompt' && promptText) {
                        await dialog.accept(promptText);
                    } else {
                        await dialog.accept();
                    }
                } else {
                    await dialog.dismiss();
                }
            });
            
            logger.debug(`Dialog handler set: accept=${accept}`);
            return true;
        } catch (error) {
            logger.error('Failed to handle dialog:', error);
            throw error;
        }
    }

    async blockResources(page, resourceTypes = ['image', 'stylesheet', 'font']) {
        try {
            await page.setRequestInterception(true);
            
            page.on('request', request => {
                if (resourceTypes.includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
            
            logger.debug(`Blocked resources: ${resourceTypes.join(', ')}`);
            return true;
        } catch (error) {
            logger.error('Failed to block resources:', error);
            throw error;
        }
    }

    async setUserAgent(page, userAgent) {
        try {
            await page.setUserAgent(userAgent);
            logger.debug(`User agent set: ${userAgent}`);
            return true;
        } catch (error) {
            logger.error('Failed to set user agent:', error);
            throw error;
        }
    }

    async setViewport(page, viewport) {
        try {
            await page.setViewport(viewport);
            logger.debug(`Viewport set: ${JSON.stringify(viewport)}`);
            return true;
        } catch (error) {
            logger.error('Failed to set viewport:', error);
            throw error;
        }
    }

    async clearCookies(page) {
        try {
            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            logger.debug('Cookies cleared');
            return true;
        } catch (error) {
            logger.error('Failed to clear cookies:', error);
            throw error;
        }
    }

    async clearCache(page) {
        try {
            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCache');
            logger.debug('Cache cleared');
            return true;
        } catch (error) {
            logger.error('Failed to clear cache:', error);
            throw error;
        }
    }

    async getCookies(page) {
        try {
            const cookies = await page.cookies();
            logger.debug(`Retrieved ${cookies.length} cookies`);
            return cookies;
        } catch (error) {
            logger.error('Failed to get cookies:', error);
            throw error;
        }
    }

    async setCookies(page, cookies) {
        try {
            await page.setCookie(...cookies);
            logger.debug(`Set ${cookies.length} cookies`);
            return true;
        } catch (error) {
            logger.error('Failed to set cookies:', error);
            throw error;
        }
    }
}

module.exports = BrowserUtils;
