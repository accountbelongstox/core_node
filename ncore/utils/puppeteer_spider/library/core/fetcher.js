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
const PuppeteerSpider = require('../puppeteer_spider.js');

// Declare variables
const DEFAULT_CONFIG = {
    timeout: 30000,
    retries: 3,
    delay: 1000
};

class PuppeteerSpiderFetcher {
  constructor() {
    this.puppeteerSpider = null;
    this.config = { ...DEFAULT_CONFIG };
    this.isInitialized = false;
  }

  async initialize(config = {}) {
    try {
      logger.info('Initializing Puppeteer Spider Fetcher...');
      
      this.config = { ...this.config, ...config };
      
      // Initialize Puppeteer Spider
      this.puppeteerSpider = new PuppeteerSpider();
      await this.puppeteerSpider.initialize();
      
      this.isInitialized = true;
      logger.info('Puppeteer Spider Fetcher initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize Puppeteer Spider Fetcher:', error.message);
      throw error;
    }
  }

  async fetch(url, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Fetcher not initialized. Call initialize() first.');
    }
    
    try {
      logger.info(`Fetching URL: ${url}`);
      
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
      
      logger.info(`Successfully fetched: ${url}`);
      return result;
      
    } catch (error) {
      logger.error(`Failed to fetch ${url}:`, error.message);
      throw error;
    }
  }

  async takeScreenshot(filePath, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Fetcher not initialized. Call initialize() first.');
    }
    
    try {
      const screenshotOptions = {
        path: filePath,
        fullPage: options.fullPage !== false,
        type: 'jpeg',
        quality: options.quality || 80,
        ...options
      };
      
      const screenshot = await this.puppeteerSpider.getPage().screenshot(screenshotOptions);
      logger.info(`Screenshot captured: ${filePath}`);
      
      return screenshot;
    } catch (error) {
      logger.error(`Failed to take screenshot: ${error.message}`);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.puppeteerSpider) {
        await this.puppeteerSpider.close();
        this.puppeteerSpider = null;
      }
      
      this.isInitialized = false;
      logger.info('Puppeteer Spider Fetcher cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup Puppeteer Spider Fetcher:', error.message);
      throw error;
    }
  }

  getInfo() {
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      puppeteerSpider: this.puppeteerSpider ? this.puppeteerSpider.getInfo() : null
    };
  }
}

module.exports = PuppeteerSpiderFetcher;