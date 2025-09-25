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
 * Puppeteer Interaction Class
 * Handles user interaction methods
 */
class PuppeteerInteraction {
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
     * Wait for element to appear using timer-based polling
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Element object
     */
    async waitForElement(selector, options = {}, instanceId = this.defaultInstanceId) {
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
     * Wait for element using timer-based polling
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Element object
     */
    async waitForElementWithTimer(selector, options = {}, instanceId = this.defaultInstanceId) {
        return this.waitForElement(selector, options, instanceId);
    }

    /**
     * Click element
     * @param {string} selector - CSS selector
     * @param {Object} options - Click options
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async clickElement(selector, options = {}, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            await page.click(selector, options);
            logger.info(`Element clicked: ${selector}`);

        } catch (error) {
            logger.error(`Failed to click element ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Type text into element
     * @param {string} selector - CSS selector
     * @param {string} text - Text to type
     * @param {Object} options - Type options
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async typeText(selector, text, options = {}, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            await page.type(selector, text, options);
            logger.info(`Text typed into element: ${selector}`);

        } catch (error) {
            logger.error(`Failed to type text into element ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Drag and drop element
     * @param {string} selector - CSS selector
     * @param {Array} trajectory - Trajectory coordinates [{ x, y }, { x, y }, ...]
     * @param {number} speed - Movement speed in pixels per second
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async dragAndDrop(selector, trajectory, speed = 100, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            const element = await page.$(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }

            const box = await element.boundingBox();
            if (!box) {
                throw new Error(`Could not get bounding box for element: ${selector}`);
            }

            // Start drag
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();

            // Follow trajectory
            for (const point of trajectory) {
                const delay = Math.sqrt(
                    Math.pow(point.x - (box.x + box.width / 2), 2) +
                    Math.pow(point.y - (box.y + box.height / 2), 2)
                ) / speed * 1000;
                
                await page.mouse.move(point.x, point.y);
                await page.waitForTimeout(delay);
            }

            // End drag
            await page.mouse.up();
            logger.info(`Element dragged and dropped: ${selector}`);

        } catch (error) {
            logger.error(`Failed to drag and drop element ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get page content
     * @param {Object} options - Content options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {string} Page content
     */
    async getContent(options = {}, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            const content = await page.content();
            logger.info('Page content retrieved');
            return content;

        } catch (error) {
            logger.error(`Failed to get page content: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get content and wait for element to exist
     * @param {string} selector - CSS selector to wait for
     * @param {Object} options - Content and wait options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Content and element
     */
    async getContentAndWait(selector, options = {}, instanceId = this.defaultInstanceId) {
        try {
            // Wait for element first
            const element = await this.waitForElement(selector, options, instanceId);
            
            // Get content
            const content = await this.getContent(options, instanceId);
            
            return { content, element };

        } catch (error) {
            logger.error(`Failed to get content and wait: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get element text
     * @param {string} selector - CSS selector
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {string} Element text
     */
    async getElementText(selector, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            const text = await page.$eval(selector, element => element.textContent);
            logger.info(`Element text retrieved: ${selector}`);
            return text;

        } catch (error) {
            logger.error(`Failed to get element text ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get element attribute
     * @param {string} selector - CSS selector
     * @param {string} attribute - Attribute name
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {string} Attribute value
     */
    async getElementAttribute(selector, attribute, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            const value = await page.$eval(selector, (element, attr) => element.getAttribute(attr), attribute);
            logger.info(`Element attribute retrieved: ${selector}.${attribute}`);
            return value;

        } catch (error) {
            logger.error(`Failed to get element attribute ${selector}.${attribute}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Scroll to element
     * @param {string} selector - CSS selector
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async scrollToElement(selector, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, selector);

            logger.info(`Scrolled to element: ${selector}`);

        } catch (error) {
            logger.error(`Failed to scroll to element ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Hover over element
     * @param {string} selector - CSS selector
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async hoverElement(selector, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            await page.hover(selector);
            logger.info(`Hovered over element: ${selector}`);

        } catch (error) {
            logger.error(`Failed to hover over element ${selector}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Focus element
     * @param {string} selector - CSS selector
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async focusElement(selector, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            await page.focus(selector);
            logger.info(`Focused element: ${selector}`);

        } catch (error) {
            logger.error(`Failed to focus element ${selector}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new PuppeteerInteraction(); 