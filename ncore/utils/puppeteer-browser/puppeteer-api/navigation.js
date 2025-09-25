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
 * Puppeteer Navigation Class
 * Handles URL navigation and tab management
 */
class PuppeteerNavigation {
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
     * Open URL (switch to existing tab if URL exists)
     * @param {string} url - URL to open
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Page object
     */
    async openUrl(url, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            // Check if URL already exists in tabs
            const pages = await instance.puppeteerBrowser.pages();
            for (const page of pages) {
                const pageUrl = page.url();
                if (pageUrl === url) {
                    await page.bringToFront();
                    logger.info(`Switched to existing tab with URL: ${url}`);
                    return page;
                }
            }

            // Open new tab if URL doesn't exist
            const newPage = await instance.puppeteerBrowser.newPage();
            await newPage.goto(url, { waitUntil: 'networkidle2' });
            logger.info(`Opened new tab with URL: ${url}`);
            return newPage;

        } catch (error) {
            logger.error(`Failed to open URL ${url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Force open URL (always create new tab)
     * @param {string} url - URL to open
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Page object
     */
    async forceOpenUrl(url, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const newPage = await instance.puppeteerBrowser.newPage();
            await newPage.goto(url, { waitUntil: 'networkidle2' });
            logger.info(`Force opened new tab with URL: ${url}`);
            return newPage;

        } catch (error) {
            logger.error(`Failed to force open URL ${url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Switch to tab by index
     * @param {number} tabIndex - Tab index
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Page object
     */
    async switchToTab(tabIndex, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const pages = await instance.puppeteerBrowser.pages();
            if (tabIndex >= 0 && tabIndex < pages.length) {
                await pages[tabIndex].bringToFront();
                logger.info(`Switched to tab ${tabIndex}`);
                return pages[tabIndex];
            } else {
                throw new Error(`Tab index ${tabIndex} out of range (0-${pages.length - 1})`);
            }

        } catch (error) {
            logger.error(`Failed to switch to tab ${tabIndex}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Switch to page by URL
     * @param {string} url - URL to switch to
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Page object
     */
    async switchToUrl(url, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const pages = await instance.puppeteerBrowser.pages();
            for (const page of pages) {
                const pageUrl = page.url();
                if (pageUrl === url) {
                    await page.bringToFront();
                    logger.info(`Switched to page with URL: ${url}`);
                    return page;
                }
            }

            throw new Error(`No page found with URL: ${url}`);

        } catch (error) {
            logger.error(`Failed to switch to URL ${url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Switch to page by number or URL
     * @param {number|string} target - Tab index or URL
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Page object
     */
    async switchTo(target, instanceId = this.defaultInstanceId) {
        if (typeof target === 'number') {
            return this.switchToTab(target, instanceId);
        } else if (typeof target === 'string') {
            return this.switchToUrl(target, instanceId);
        } else {
            throw new Error('Target must be a number (tab index) or string (URL)');
        }
    }

    /**
     * Get active page
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Active page object
     */
    async getActivePage(instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const pages = await instance.puppeteerBrowser.pages();
            if (pages.length > 0) {
                return pages[pages.length - 1]; // Last page is typically the active one
            } else {
                throw new Error('No pages available');
            }

        } catch (error) {
            logger.error(`Failed to get active page: ${error.message}`);
            throw error;
        }
    }

    /**
     * Close tab by index
     * @param {number} tabIndex - Tab index
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async closeTab(tabIndex, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const pages = await instance.puppeteerBrowser.pages();
            if (tabIndex >= 0 && tabIndex < pages.length) {
                await pages[tabIndex].close();
                logger.info(`Closed tab ${tabIndex}`);
            } else {
                throw new Error(`Tab index ${tabIndex} out of range (0-${pages.length - 1})`);
            }

        } catch (error) {
            logger.error(`Failed to close tab ${tabIndex}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Close page by URL
     * @param {string} url - URL to close
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async closeUrl(url, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const pages = await instance.puppeteerBrowser.pages();
            for (const page of pages) {
                const pageUrl = page.url();
                if (pageUrl === url) {
                    await page.close();
                    logger.info(`Closed page with URL: ${url}`);
                    return;
                }
            }

            throw new Error(`No page found with URL: ${url}`);

        } catch (error) {
            logger.error(`Failed to close URL ${url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Close page by number or URL
     * @param {number|string} target - Tab index or URL
     * @param {number} instanceId - Instance ID (default: 0)
     */
    async closePage(target, instanceId = this.defaultInstanceId) {
        if (typeof target === 'number') {
            return this.closeTab(target, instanceId);
        } else if (typeof target === 'string') {
            return this.closeUrl(target, instanceId);
        } else {
            throw new Error('Target must be a number (tab index) or string (URL)');
        }
    }
}

module.exports = new PuppeteerNavigation(); 