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
const path = require('path');
const fs = require('fs');
const { commander } = require('#@commander');
const ConfigManager = require('../config/config_manager');

// Declare variables
const configManager = new ConfigManager('edge');
const DEFAULT_CONFIG = configManager.getConfig();

class WebSpider {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.puppeteerManager = null;
        this.isInitialized = false;
        this.activeTasks = new Set();
        this.taskQueue = [];
        this.results = [];
        this.errors = [];
    }

    // Initialize spider
    async initialize(options = {}) {
        try {
            logger.info('Initializing Web Spider...');
            
            // Initialize Puppeteer Spider
            const PuppeteerSpider = require('../puppeteer_spider');
            this.puppeteerSpider = new PuppeteerSpider();
            
            const puppeteerOptions = {
                headless: this.config.headless !== false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--user-agent=' + this.config.userAgent
                ],
                timeout: this.config.timeout,
                ...options
            };
            
            await this.puppeteerSpider.initialize();
            
            this.isInitialized = true;
            logger.info('Web Spider initialized successfully');
            
            return true;
        } catch (error) {
            logger.error('Failed to initialize Web Spider:', error.message);
            throw error;
        }
    }

    // Crawl single URL
    async crawlUrl(url, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        try {
            logger.info(`Crawling URL: ${url}`);
            
            // Navigate to URL
            await this.puppeteerSpider.getPage().goto(url, { waitUntil: 'networkidle2', timeout: options.timeout || 30000 });
            
            // Get page content
            const content = await this.puppeteerSpider.getPage().content();
            
            // Extract data if extractor provided
            let extractedData = null;
            if (options.extractor) {
                extractedData = await this.puppeteerSpider.getPage().evaluate(options.extractor);
            }
            
            // Take screenshot if requested
            let screenshot = null;
            if (options.screenshot) {
                screenshot = await this.puppeteerSpider.getPage().screenshot(options.screenshot);
            }
            
            const result = {
                url,
                content,
                extractedData,
                screenshot,
                timestamp: new Date().toISOString(),
                success: true
            };
            
            this.results.push(result);
            logger.info(`Successfully crawled: ${url}`);
            
            return result;
        } catch (error) {
            logger.error(`Failed to crawl ${url}:`, error.message);
            
            const errorResult = {
                url,
                error: error.message,
                timestamp: new Date().toISOString(),
                success: false
            };
            
            this.errors.push(errorResult);
            throw error;
        }
    }

    // Crawl multiple URLs
    async crawlUrls(urls, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        const results = [];
        const errors = [];
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            
            try {
                // Add delay between requests
                if (i > 0 && this.config.delay > 0) {
                    await this.delay(this.config.delay);
                }
                
                const result = await this.crawlUrl(url, options);
                results.push(result);
                
            } catch (error) {
                errors.push({
                    url,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                
                // Continue with next URL if not critical
                if (options.stopOnError) {
                    throw error;
                }
            }
        }
        
        return { results, errors };
    }

    // Extract data from current page
    async extractData(extractor) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        try {
            const data = await this.puppeteerSpider.getPage().evaluate(extractor);
            logger.debug('Data extracted successfully');
            
            return data;
        } catch (error) {
            logger.error('Failed to extract data:', error.message);
            throw error;
        }
    }

    // Download file from current page
    async downloadFile(url, savePath, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        try {
            // Use page to download file
            const page = this.puppeteerSpider.getPage();
            const response = await page.goto(url, { waitUntil: 'networkidle2' });
            logger.info(`File downloaded: ${url}`);
            
            return url;
        } catch (error) {
            logger.error(`Failed to download file from ${url}:`, error.message);
            throw error;
        }
    }

    // Take screenshot of current page
    async takeScreenshot(options = {}) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        try {
            const screenshot = await this.puppeteerSpider.getPage().screenshot(options);
            logger.debug('Screenshot taken');
            
            return screenshot;
        } catch (error) {
            logger.error('Failed to take screenshot:', error.message);
            throw error;
        }
    }

    // Wait for element and perform action
    async waitAndClick(selector, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        try {
            const page = this.puppeteerSpider.getPage();
            await page.waitForSelector(selector, { timeout: options.timeout || 30000 });
            await page.click(selector);
            
            logger.debug(`Clicked element: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Failed to click element ${selector}:`, error.message);
            throw error;
        }
    }

    // Wait for element and type text
    async waitAndType(selector, text, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        try {
            const page = this.puppeteerSpider.getPage();
            await page.waitForSelector(selector, { timeout: options.timeout || 30000 });
            await page.type(selector, text);
            
            logger.debug(`Typed text in element: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Failed to type text in ${selector}:`, error.message);
            throw error;
        }
    }

    // Execute custom JavaScript
    async executeScript(script, ...args) {
        if (!this.isInitialized) {
            throw new Error('Spider not initialized. Call initialize() first.');
        }
        
        try {
            const result = await this.puppeteerSpider.getPage().evaluate(script, ...args);
            logger.debug('Custom script executed');
            
            return result;
        } catch (error) {
            logger.error('Failed to execute custom script:', error.message);
            throw error;
        }
    }

    // Save results to file
    async saveResults(filePath, format = 'json') {
        try {
            const data = {
                results: this.results,
                errors: this.errors,
                summary: {
                    totalUrls: this.results.length + this.errors.length,
                    successful: this.results.length,
                    failed: this.errors.length,
                    timestamp: new Date().toISOString()
                }
            };
            
            let content;
            if (format === 'json') {
                content = JSON.stringify(data, null, 2);
            } else if (format === 'csv') {
                content = this.convertToCSV(data.results);
            } else {
                throw new Error(`Unsupported format: ${format}`);
            }
            
            fs.writeFileSync(filePath, content, 'utf8');
            logger.info(`Results saved to: ${filePath}`);
            
            return filePath;
        } catch (error) {
            logger.error('Failed to save results:', error.message);
            throw error;
        }
    }

    // Convert results to CSV format
    convertToCSV(results) {
        if (results.length === 0) {
            return '';
        }
        
        const headers = ['url', 'timestamp', 'success'];
        const rows = results.map(result => [
            result.url,
            result.timestamp,
            result.success
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        return csvContent;
    }

    // Utility function for delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get spider statistics
    getStats() {
        return {
            isInitialized: this.isInitialized,
            totalResults: this.results.length,
            totalErrors: this.errors.length,
            activeTasks: this.activeTasks.size,
            queuedTasks: this.taskQueue.length,
            config: this.config
        };
    }

    // Clear results and errors
    clearData() {
        this.results = [];
        this.errors = [];
        logger.info('Spider data cleared');
    }

    // Close spider and cleanup
    async close() {
        try {
            if (this.puppeteerSpider) {
                await this.puppeteerSpider.close();
                this.puppeteerSpider = null;
            }
            
            this.isInitialized = false;
            this.activeTasks.clear();
            this.taskQueue = [];
            
            logger.info('Web Spider closed');
        } catch (error) {
            logger.error('Failed to close Web Spider:', error.message);
            throw error;
        }
    }
}

module.exports = WebSpider;
