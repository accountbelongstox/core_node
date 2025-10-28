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
const GLOBAL_INSTANCES = require('../../../global_instance_manager');

// Declare variables
let driver = null;

class PageWrapper {
    constructor(instanceId = null, instanceManager = null) {
        this.instanceId = instanceId;
        this.instanceManager = instanceManager || GLOBAL_INSTANCES;
        this.driver = null;
        this.isInitialized = false;
    }
    
    // Initialize with instance
    async initialize(instanceId = null) {
        try {
            if (instanceId) {
                this.instanceId = instanceId;
            }
            
            const instance = this.instanceManager.getInstance(this.instanceId);
            if (!instance) {
                throw new Error(`Instance not found: ${this.instanceId}`);
            }
            
            // Get driver from instance
            this.driver = instance.wrappers.get('driver');
            if (!this.driver) {
                // Create driver if not exists
                const PuppeteerDriver = require('../driver');
                this.driver = await PuppeteerDriver.createForInstance(instance);
                instance.wrappers.set('driver', this.driver);
            }
            
            this.isInitialized = true;
            logger.info(`PageWrapper initialized with instance: ${this.instanceId}`);
            return this;
        } catch (error) {
            logger.error('Failed to initialize PageWrapper:', error.message);
            throw error;
        }
    }
    
    // Navigate to URL
    async navigateTo(url, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Navigating to: ${url}`);
            const page = this.driver.instance.page;
            await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: options.timeout || 30000
            });
            logger.info(`Navigation completed: ${url}`);
            return { success: true, url };
        } catch (error) {
            logger.error('Navigation failed:', error.message);
            throw error;
        }
    }
    
    // Click element
    async clickElement(selector, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Clicking element: ${selector}`);
            const page = this.driver.instance.page;
            await page.waitForSelector(selector, { timeout: options.timeout || 10000 });
            await page.click(selector);
            logger.info(`Element clicked: ${selector}`);
            return { success: true, selector };
        } catch (error) {
            logger.error('Click failed:', error.message);
            throw error;
        }
    }
    
    // Type text
    async typeText(selector, text, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Typing text in: ${selector}`);
            const page = this.driver.instance.page;
            await page.waitForSelector(selector, { timeout: options.timeout || 10000 });
            await page.type(selector, text, { delay: options.delay || 100 });
            logger.info(`Text typed: ${text}`);
            return { success: true, selector, text };
        } catch (error) {
            logger.error('Type text failed:', error.message);
            throw error;
        }
    }
    
    // Get element text
    async getElementText(selector, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Getting text from: ${selector}`);
            const page = this.driver.instance.page;
            await page.waitForSelector(selector, { timeout: options.timeout || 10000 });
            const text = await page.$eval(selector, el => el.textContent);
            logger.info(`Text retrieved: ${text}`);
            return { success: true, selector, text };
        } catch (error) {
            logger.error('Get text failed:', error.message);
            throw error;
        }
    }
    
    // Take screenshot
    async takeScreenshot(options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info('Taking screenshot');
            const page = this.driver.instance.page;
            const screenshot = await page.screenshot({
                path: options.path,
                fullPage: options.fullPage || false,
                type: options.type || 'png'
            });
            logger.info('Screenshot taken');
            return { success: true, screenshot };
        } catch (error) {
            logger.error('Screenshot failed:', error.message);
            throw error;
        }
    }
    
    // Wait for element
    async waitForElement(selector, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Waiting for element: ${selector}`);
            const page = this.driver.instance.page;
            await page.waitForSelector(selector, { 
                timeout: options.timeout || 10000,
                visible: options.visible || true
            });
            logger.info(`Element appeared: ${selector}`);
            return { success: true, selector };
        } catch (error) {
            logger.error('Wait for element failed:', error.message);
            throw error;
        }
    }
    
    // Get page title
    async getPageTitle() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const page = this.driver.instance.page;
            const title = await page.title();
            logger.info(`Page title: ${title}`);
            return { success: true, title };
        } catch (error) {
            logger.error('Get page title failed:', error.message);
            throw error;
        }
    }
    
    // Get page URL
    async getPageUrl() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const page = this.driver.instance.page;
            const url = page.url();
            logger.info(`Page URL: ${url}`);
            return { success: true, url };
        } catch (error) {
            logger.error('Get page URL failed:', error.message);
            throw error;
        }
    }
    
    // Close wrapper
    async close() {
        try {
            logger.info(`Closing PageWrapper: ${this.instanceId}`);
            this.isInitialized = false;
            logger.info(`PageWrapper closed: ${this.instanceId}`);
            return true;
        } catch (error) {
            logger.error('Failed to close PageWrapper:', error.message);
            return false;
        }
    }
}

module.exports = PageWrapper;
