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

const puppeteerSpiderManager = require('../core/main.js');
const logger = require('#@logger');

/**
 * Puppeteer Screenshot Class
 * Handles various screenshot capabilities
 */
class PuppeteerScreenshot {
    constructor() {
        this.defaultInstanceId = 0;
    }

    /**
     * Get Puppeteer instance by ID
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Puppeteer instance
     */
    getInstance(instanceId = this.defaultInstanceId) {
        return puppeteerSpiderManager.getPuppeteerSpiderInstance(instanceId);
    }

    /**
     * Take full page screenshot
     * @param {string} path - Screenshot file path
     * @param {Object} options - Screenshot options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Screenshot result
     */
    async takeScreenshot(path, options = {}, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available for screenshot');
            }

            const screenshotOptions = {
                path: path,
                fullPage: options.fullPage || false,
                quality: options.quality || 80,
                type: options.type || 'png',
                ...options
            };

            await page.screenshot(screenshotOptions);
            logger.info(`Screenshot saved: ${path}`);
            return { success: true, path };

        } catch (error) {
            logger.error(`Failed to take screenshot ${path}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Take screenshot of specific area
     * @param {string} path - Screenshot file path
     * @param {Object} area - Area coordinates { x, y, width, height }
     * @param {Object} options - Screenshot options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Screenshot result
     */
    async takeAreaScreenshot(path, area, options = {}, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available for screenshot');
            }

            const screenshotOptions = {
                path: path,
                clip: {
                    x: area.x || 0,
                    y: area.y || 0,
                    width: area.width || 800,
                    height: area.height || 600
                },
                quality: options.quality || 80,
                type: options.type || 'png',
                ...options
            };

            await page.screenshot(screenshotOptions);
            logger.info(`Area screenshot saved: ${path}`);
            return { success: true, path, area };

        } catch (error) {
            logger.error(`Failed to take area screenshot ${path}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Take screenshot of specific element
     * @param {string} path - Screenshot file path
     * @param {string} selector - CSS selector
     * @param {Object} options - Screenshot options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Screenshot result
     */
    async takeElementScreenshot(path, selector, options = {}, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available for screenshot');
            }

            const element = await page.$(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }

            const screenshotOptions = {
                path: path,
                quality: options.quality || 80,
                type: options.type || 'png',
                ...options
            };

            await element.screenshot(screenshotOptions);
            logger.info(`Element screenshot saved: ${path}`);
            return { success: true, path, selector };

        } catch (error) {
            logger.error(`Failed to take element screenshot ${path}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Take screenshot and wait for element to exist
     * @param {string} path - Screenshot file path
     * @param {string} selector - CSS selector to wait for
     * @param {Object} options - Screenshot options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Screenshot result
     */
    async takeScreenshotAndWait(path, selector, options = {}, instanceId = this.defaultInstanceId) {
        try {
            // Wait for element first
            await this.waitForElementWithTimer(selector, options, instanceId);
            
            // Take screenshot
            return await this.takeScreenshot(path, options, instanceId);

        } catch (error) {
            logger.error(`Failed to take screenshot and wait ${path}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Wait for element to appear using timer-based polling
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Element object
     */
    async waitForElementWithTimer(selector, options = {}, instanceId = this.defaultInstanceId) {
        const { timeout = 30000, interval = 100 } = options;

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = async () => {
                try {
                    const instance = this.getInstance(instanceId);
                    if (!instance) {
                        reject(new Error(`Puppeteer instance ${instanceId} not found`));
                        return;
                    }

                    const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
                    if (!page) {
                        reject(new Error('No page available'));
                        return;
                    }

                    const element = await page.$(selector);
                    if (element) {
                        resolve(element);
                        return;
                    }

                    if (Date.now() - startTime > timeout) {
                        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                        return;
                    }

                    setTimeout(checkElement, interval);
                } catch (error) {
                    reject(error);
                }
            };

            checkElement();
        });
    }

    /**
     * Take multiple screenshots with different options
     * @param {Array} screenshots - Array of screenshot configurations
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Array} Array of screenshot results
     */
    async takeMultipleScreenshots(screenshots, instanceId = this.defaultInstanceId) {
        try {
            const results = [];
            
            for (const screenshot of screenshots) {
                const { path, type, selector, area, options = {} } = screenshot;
                
                let result;
                switch (type) {
                    case 'element':
                        result = await this.takeElementScreenshot(path, selector, options, instanceId);
                        break;
                    case 'area':
                        result = await this.takeAreaScreenshot(path, area, options, instanceId);
                        break;
                    case 'full':
                    default:
                        result = await this.takeScreenshot(path, options, instanceId);
                        break;
                }
                
                results.push(result);
            }
            
            logger.info(`Multiple screenshots completed: ${results.length} files`);
            return results;

        } catch (error) {
            logger.error(`Failed to take multiple screenshots: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new PuppeteerScreenshot(); 