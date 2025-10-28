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

class ContentWrapper {
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
            logger.info(`ContentWrapper initialized with instance: ${this.instanceId}`);
            return this;
        } catch (error) {
            logger.error('Failed to initialize ContentWrapper:', error.message);
            throw error;
        }
    }
    
    // Extract text content
    async extractText(selector = null, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Extracting text content${selector ? ` from: ${selector}` : ''}`);
            const page = this.driver.instance.page;
            
            let text;
            if (selector) {
                await page.waitForSelector(selector, { timeout: options.timeout || 10000 });
                text = await page.$eval(selector, el => el.textContent);
            } else {
                text = await page.evaluate(() => document.body.textContent);
            }
            
            logger.info(`Text extracted: ${text.length} characters`);
            return { success: true, text, selector };
        } catch (error) {
            logger.error('Text extraction failed:', error.message);
            throw error;
        }
    }
    
    // Extract HTML content
    async extractHtml(selector = null, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Extracting HTML content${selector ? ` from: ${selector}` : ''}`);
            const page = this.driver.instance.page;
            
            let html;
            if (selector) {
                await page.waitForSelector(selector, { timeout: options.timeout || 10000 });
                html = await page.$eval(selector, el => el.outerHTML);
            } else {
                html = await page.evaluate(() => document.documentElement.outerHTML);
            }
            
            logger.info(`HTML extracted: ${html.length} characters`);
            return { success: true, html, selector };
        } catch (error) {
            logger.error('HTML extraction failed:', error.message);
            throw error;
        }
    }
    
    // Extract links
    async extractLinks(options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info('Extracting links');
            const page = this.driver.instance.page;
            
            const links = await page.evaluate(() => {
                const linkElements = document.querySelectorAll('a[href]');
                return Array.from(linkElements).map(link => ({
                    text: link.textContent.trim(),
                    href: link.href,
                    title: link.title || ''
                }));
            });
            
            logger.info(`Links extracted: ${links.length} links`);
            return { success: true, links };
        } catch (error) {
            logger.error('Link extraction failed:', error.message);
            throw error;
        }
    }
    
    // Extract images
    async extractImages(options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info('Extracting images');
            const page = this.driver.instance.page;
            
            const images = await page.evaluate(() => {
                const imgElements = document.querySelectorAll('img[src]');
                return Array.from(imgElements).map(img => ({
                    src: img.src,
                    alt: img.alt || '',
                    title: img.title || '',
                    width: img.width,
                    height: img.height
                }));
            });
            
            logger.info(`Images extracted: ${images.length} images`);
            return { success: true, images };
        } catch (error) {
            logger.error('Image extraction failed:', error.message);
            throw error;
        }
    }
    
    // Extract forms
    async extractForms(options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info('Extracting forms');
            const page = this.driver.instance.page;
            
            const forms = await page.evaluate(() => {
                const formElements = document.querySelectorAll('form');
                return Array.from(formElements).map(form => ({
                    action: form.action,
                    method: form.method,
                    id: form.id || '',
                    name: form.name || '',
                    inputs: Array.from(form.querySelectorAll('input')).map(input => ({
                        type: input.type,
                        name: input.name || '',
                        id: input.id || '',
                        value: input.value || '',
                        placeholder: input.placeholder || ''
                    }))
                }));
            });
            
            logger.info(`Forms extracted: ${forms.length} forms`);
            return { success: true, forms };
        } catch (error) {
            logger.error('Form extraction failed:', error.message);
            throw error;
        }
    }
    
    // Extract table data
    async extractTableData(selector, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.info(`Extracting table data from: ${selector}`);
            const page = this.driver.instance.page;
            
            await page.waitForSelector(selector, { timeout: options.timeout || 10000 });
            
            const tableData = await page.evaluate((sel) => {
                const table = document.querySelector(sel);
                if (!table) return null;
                
                const rows = Array.from(table.querySelectorAll('tr'));
                return rows.map(row => {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    return cells.map(cell => cell.textContent.trim());
                });
            }, selector);
            
            logger.info(`Table data extracted: ${tableData.length} rows`);
            return { success: true, tableData, selector };
        } catch (error) {
            logger.error('Table data extraction failed:', error.message);
            throw error;
        }
    }
    
    // Close wrapper
    async close() {
        try {
            logger.info(`Closing ContentWrapper: ${this.instanceId}`);
            this.isInitialized = false;
            logger.info(`ContentWrapper closed: ${this.instanceId}`);
            return true;
        } catch (error) {
            logger.error('Failed to close ContentWrapper:', error.message);
            return false;
        }
    }
}

module.exports = ContentWrapper;
