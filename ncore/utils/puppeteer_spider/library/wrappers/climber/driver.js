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
const Download = require('./modus/download');
const FileMonitor = require('./modus/file_monitor.js');

// Declare variables
const DEFAULT_CONFIG = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ],
    timeout: 30000,
    viewport: {
        width: 1920,
        height: 1080
    }
};

class PuppeteerDriver {
    constructor(instance = null, instanceManager = null) {
        this.instance = instance;
        this.instanceManager = instanceManager;
        this.downloadManager = null;
        this.isInitialized = false;
        this.driverId = `driver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Initialize driver with instance
    async initialize(instance = null, instanceManager = null) {
        try {
            if (instance) {
                this.instance = instance;
            }
            
            if (instanceManager) {
                this.instanceManager = instanceManager;
            }
            
            if (!this.instance) {
                throw new Error('No instance provided for driver initialization');
            }
            
            // Initialize file monitor
            this.fileMonitor = new FileMonitor();
            
            // Initialize encapsulated functions
            this.encapsulatedPageFuncs = {
                getCurrentPage: () => this.instance.page
            };
            
            this.encapsulatedDownloadFuncs = {
                findAndClickDownloadLink: async (selector, options = {}) => {
                    const page = this.instance.page;
                    await page.waitForSelector(selector, { timeout: options.timeout || 30000 });
                    await page.click(selector);
                    return { success: true };
                },
                saveImageFromSelector: async (selector, options = {}) => {
                    const page = this.instance.page;
                    await page.waitForSelector(selector, { timeout: options.timeout || 30000 });
                    const element = await page.$(selector);
                    const src = await page.evaluate(el => el.src, element);
                    return { success: true, src };
                },
                saveAudioFromSelector: async (selector, options = {}) => {
                    const page = this.instance.page;
                    await page.waitForSelector(selector, { timeout: options.timeout || 30000 });
                    const element = await page.$(selector);
                    const src = await page.evaluate(el => el.src, element);
                    return { success: true, src };
                },
                fetch: async (url, options = {}) => {
                    const page = this.instance.page;
                    const response = await page.goto(url, { waitUntil: 'networkidle0' });
                    return { success: true, response };
                }
            };
            
            // Initialize download wrapper
            this.downloadManager = new Download(this.instance.id, this.instanceManager);
            await this.downloadManager.initialize();
            
            this.isInitialized = true;
            logger.info(`PuppeteerDriver initialized with instance: ${this.instance.id}`);
            
            return this;
        } catch (error) {
            logger.error('Failed to initialize PuppeteerDriver:', error.message);
            throw error;
        }
    }

    // Get current instance
    getInstance() {
        if (!this.instance) {
            throw new Error('Driver not initialized. Call initialize() first.');
        }
        return this.instance;
    }

    // Get page
    getPage() {
        return this.getInstance().page;
    }

    // Get browser
    getBrowser() {
        return this.getInstance().browser;
    }

    // Navigate to URL
    async navigateTo(url, options = {}) {
        try {
            const page = this.getPage();
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: options.timeout || 30000,
                ...options
            });
            
            logger.info(`Navigated to: ${url}`);
            return page;
        } catch (error) {
            logger.error(`Failed to navigate to ${url}:`, error.message);
            throw error;
        }
    }

    // Take screenshot
    async takeScreenshot(options = {}) {
        try {
            const page = this.getPage();
            const screenshot = await page.screenshot({
                fullPage: true,
                ...options
            });
            
            logger.info('Screenshot taken');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take screenshot:', error.message);
            throw error;
        }
    }

    // Get page content
    async getPageContent() {
        try {
            const page = this.getPage();
            const content = await page.content();
            
            logger.info('Page content retrieved');
            return content;
        } catch (error) {
            logger.error('Failed to get page content:', error.message);
            throw error;
        }
    }

    // Execute JavaScript
    async executeScript(script, ...args) {
        try {
            const page = this.getPage();
            const result = await page.evaluate(script, ...args);
            
            logger.info('Script executed successfully');
            return result;
        } catch (error) {
            logger.error('Failed to execute script:', error.message);
            throw error;
        }
    }

    // Wait for element
    async waitForElement(selector, options = {}) {
        try {
            const page = this.getPage();
            const element = await page.waitForSelector(selector, {
                timeout: 30000,
                ...options
            });
            
            logger.info(`Element found: ${selector}`);
            return element;
        } catch (error) {
            logger.error(`Failed to wait for element ${selector}:`, error.message);
            throw error;
        }
    }

    // Click element
    async clickElement(selector, options = {}) {
        try {
            const page = this.getPage();
            await page.click(selector, options);
            
            logger.info(`Clicked element: ${selector}`);
        } catch (error) {
            logger.error(`Failed to click element ${selector}:`, error.message);
            throw error;
        }
    }

    // Type text
    async typeText(selector, text, options = {}) {
        try {
            const page = this.getPage();
            await page.type(selector, text, options);
            
            logger.info(`Typed text into: ${selector}`);
        } catch (error) {
            logger.error(`Failed to type text into ${selector}:`, error.message);
            throw error;
        }
    }

    // Get element text
    async getElementText(selector) {
        try {
            const page = this.getPage();
            const text = await page.$eval(selector, el => el.textContent);
            
            logger.info(`Retrieved text from: ${selector}`);
            return text;
        } catch (error) {
            logger.error(`Failed to get text from ${selector}:`, error.message);
            throw error;
        }
    }

    // Get element attribute
    async getElementAttribute(selector, attribute) {
        try {
            const page = this.getPage();
            const value = await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
            
            logger.info(`Retrieved attribute ${attribute} from: ${selector}`);
            return value;
        } catch (error) {
            logger.error(`Failed to get attribute ${attribute} from ${selector}:`, error.message);
            throw error;
        }
    }

    // Download file
    async downloadFile(url, filename = null, options = {}) {
        try {
            if (!this.downloadManager) {
                throw new Error('Download manager not initialized');
            }
            
            const result = await this.downloadManager.downloadFile(url, filename, options);
            
            logger.info(`File downloaded: ${url}`);
            return result;
        } catch (error) {
            logger.error(`Failed to download file ${url}:`, error.message);
            throw error;
        }
    }

    // Close driver
    async close() {
        try {
            logger.info(`Closing PuppeteerDriver: ${this.driverId}`);
            
            if (this.downloadManager) {
                await this.downloadManager.close();
            }
            
            this.isInitialized = false;
            logger.info(`PuppeteerDriver closed: ${this.driverId}`);
            
            return true;
        } catch (error) {
            logger.error('Failed to close PuppeteerDriver:', error.message);
            return false;
        }
    }

    // Get driver info
    getInfo() {
        return {
            driverId: this.driverId,
            isInitialized: this.isInitialized,
            instanceId: this.instance ? this.instance.id : null,
            hasDownloadManager: !!this.downloadManager
        };
    }
}

// Static method to create driver for specific instance
PuppeteerDriver.createForInstance = async function(instance, instanceManager = null) {
    const driver = new PuppeteerDriver(instance, instanceManager);
    await driver.initialize();
    return driver;
};

// Static method to create driver for instance by ID
PuppeteerDriver.createForInstanceId = async function(instanceId, instanceManager) {
    if (!instanceManager) {
        throw new Error('Instance manager required for creating driver by instance ID');
    }
    
    const instance = instanceManager.getInstance(instanceId);
    return await PuppeteerDriver.createForInstance(instance, instanceManager);
};

module.exports = PuppeteerDriver;