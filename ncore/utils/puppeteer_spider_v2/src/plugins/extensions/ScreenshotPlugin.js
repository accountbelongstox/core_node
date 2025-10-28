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
const IPlugin = require('../../interfaces/IPlugin');
const fs = require('fs');
const path = require('path');

class ScreenshotPlugin extends IPlugin {
    constructor() {
        super();
        this.name = 'screenshot';
        this.version = '1.0.0';
        this.defaultOptions = {
            type: 'png',
            quality: 90,
            fullPage: false,
            clip: null,
            omitBackground: false
        };
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            this.isInitialized = true;
            logger.info(`ScreenshotPlugin initialized for spider: ${spider.id}`);
        } catch (error) {
            logger.error('Failed to initialize ScreenshotPlugin:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.isInitialized = false;
            logger.info('ScreenshotPlugin cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup ScreenshotPlugin:', error);
        }
    }

    async takeScreenshot(page, options = {}) {
        try {
            const screenshotOptions = { ...this.defaultOptions, ...options };
            const screenshot = await page.screenshot(screenshotOptions);
            
            logger.debug('Screenshot taken');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            throw error;
        }
    }

    async takeElementScreenshot(page, selector, options = {}) {
        try {
            await page.waitForSelector(selector);
            
            const element = await page.$(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            
            const screenshotOptions = { ...this.defaultOptions, ...options };
            const screenshot = await element.screenshot(screenshotOptions);
            
            logger.debug(`Element screenshot taken: ${selector}`);
            return screenshot;
        } catch (error) {
            logger.error(`Failed to take element screenshot ${selector}:`, error);
            throw error;
        }
    }

    async saveScreenshot(page, filePath, options = {}) {
        try {
            const screenshot = await this.takeScreenshot(page, options);
            
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, screenshot);
            logger.info(`Screenshot saved: ${filePath}`);
            
            return {
                success: true,
                filePath: filePath,
                size: screenshot.length
            };
        } catch (error) {
            logger.error(`Failed to save screenshot to ${filePath}:`, error);
            throw error;
        }
    }

    async saveElementScreenshot(page, selector, filePath, options = {}) {
        try {
            const screenshot = await this.takeElementScreenshot(page, selector, options);
            
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, screenshot);
            logger.info(`Element screenshot saved: ${filePath}`);
            
            return {
                success: true,
                filePath: filePath,
                size: screenshot.length,
                selector: selector
            };
        } catch (error) {
            logger.error(`Failed to save element screenshot to ${filePath}:`, error);
            throw error;
        }
    }

    async takeFullPageScreenshot(page, options = {}) {
        try {
            const fullPageOptions = { ...this.defaultOptions, ...options, fullPage: true };
            const screenshot = await page.screenshot(fullPageOptions);
            
            logger.debug('Full page screenshot taken');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take full page screenshot:', error);
            throw error;
        }
    }

    async takeVisibleScreenshot(page, options = {}) {
        try {
            const visibleOptions = { ...this.defaultOptions, ...options, fullPage: false };
            const screenshot = await page.screenshot(visibleOptions);
            
            logger.debug('Visible area screenshot taken');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take visible screenshot:', error);
            throw error;
        }
    }

    async takeMultipleScreenshots(page, selectors, options = {}) {
        try {
            const screenshots = {};
            
            for (const selector of selectors) {
                try {
                    const screenshot = await this.takeElementScreenshot(page, selector, options);
                    screenshots[selector] = screenshot;
                } catch (error) {
                    logger.warn(`Failed to screenshot element ${selector}:`, error.message);
                    screenshots[selector] = null;
                }
            }
            
            logger.debug(`Multiple screenshots taken: ${Object.keys(screenshots).length} elements`);
            return screenshots;
        } catch (error) {
            logger.error('Failed to take multiple screenshots:', error);
            throw error;
        }
    }

    async compareScreenshots(screenshot1, screenshot2, options = {}) {
        try {
            // Simple comparison based on size and hash
            const size1 = screenshot1.length;
            const size2 = screenshot2.length;
            
            const crypto = require('crypto');
            const hash1 = crypto.createHash('md5').update(screenshot1).digest('hex');
            const hash2 = crypto.createHash('md5').update(screenshot2).digest('hex');
            
            const isIdentical = hash1 === hash2;
            const sizeDifference = Math.abs(size1 - size2);
            
            logger.debug('Screenshots compared');
            
            return {
                isIdentical: isIdentical,
                sizeDifference: sizeDifference,
                hash1: hash1,
                hash2: hash2,
                size1: size1,
                size2: size2
            };
        } catch (error) {
            logger.error('Failed to compare screenshots:', error);
            throw error;
        }
    }
}

module.exports = ScreenshotPlugin;
