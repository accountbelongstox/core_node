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

class AutomationPlugin extends IPlugin {
    constructor() {
        super();
        this.name = 'automation';
        this.version = '1.0.0';
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            this.isInitialized = true;
            logger.info(`AutomationPlugin initialized for spider: ${spider.id}`);
        } catch (error) {
            logger.error('Failed to initialize AutomationPlugin:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.isInitialized = false;
            logger.info('AutomationPlugin cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup AutomationPlugin:', error);
        }
    }

    async click(page, selector, options = {}) {
        try {
            await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
            await page.click(selector, options);
            logger.debug(`Clicked element: ${selector}`);
        } catch (error) {
            logger.error(`Failed to click element ${selector}:`, error);
            throw error;
        }
    }

    async type(page, selector, text, options = {}) {
        try {
            await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
            await page.type(selector, text, options);
            logger.debug(`Typed text into element: ${selector}`);
        } catch (error) {
            logger.error(`Failed to type into element ${selector}:`, error);
            throw error;
        }
    }

    async select(page, selector, value, options = {}) {
        try {
            await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
            await page.select(selector, value);
            logger.debug(`Selected value ${value} in element: ${selector}`);
        } catch (error) {
            logger.error(`Failed to select value in element ${selector}:`, error);
            throw error;
        }
    }

    async hover(page, selector, options = {}) {
        try {
            await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
            await page.hover(selector);
            logger.debug(`Hovered over element: ${selector}`);
        } catch (error) {
            logger.error(`Failed to hover over element ${selector}:`, error);
            throw error;
        }
    }

    async scrollTo(page, selector, options = {}) {
        try {
            await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
            await page.evaluate((sel) => {
                document.querySelector(sel).scrollIntoView();
            }, selector);
            logger.debug(`Scrolled to element: ${selector}`);
        } catch (error) {
            logger.error(`Failed to scroll to element ${selector}:`, error);
            throw error;
        }
    }

    async waitForElement(page, selector, options = {}) {
        try {
            await page.waitForSelector(selector, options);
            logger.debug(`Element appeared: ${selector}`);
        } catch (error) {
            logger.error(`Element did not appear: ${selector}`, error);
            throw error;
        }
    }

    async waitForText(page, text, options = {}) {
        try {
            await page.waitForFunction(
                (text) => document.body.innerText.includes(text),
                options,
                text
            );
            logger.debug(`Text appeared: ${text}`);
        } catch (error) {
            logger.error(`Text did not appear: ${text}`, error);
            throw error;
        }
    }

    async fillForm(page, formData, options = {}) {
        try {
            for (const [selector, value] of Object.entries(formData)) {
                await this.type(page, selector, value, options);
                await this.delay(options.delay || 100);
            }
            logger.debug('Form filled successfully');
        } catch (error) {
            logger.error('Failed to fill form:', error);
            throw error;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async retry(fn, maxAttempts = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                logger.warn(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxAttempts) {
                    await this.delay(delay * attempt);
                }
            }
        }
        
        throw lastError;
    }
}

module.exports = AutomationPlugin;
