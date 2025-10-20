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

const Spider = require('./climber/driver.js');
const logger = require('#@logger');

class PuppeteerSpiderFetcher {
  constructor() {
    this.spider = null;
    this.driver = null;
    this.isInitialized = false;
  }

  async initialize(config = {}) {
    if (this.isInitialized) {
      logger.warn('PuppeteerSpiderFetcher already initialized');
      return;
    }

    try {
      logger.info(`[DEBUG] Starting PuppeteerSpiderFetcher initialization`);

      const defaultConfig = {
        headless: false,
        showImages: false,
        showStyle: false,
        mute: true,
        disableGpu: true,
        mobile: false,
        width: 1280,
        height: 720
      };

      const mergedConfig = { ...defaultConfig, ...config };
      logger.info(`[DEBUG] Config: ${JSON.stringify(mergedConfig)}`);
      logger.info(`[DEBUG] Headless mode: ${mergedConfig.headless}`);

      logger.info(`[DEBUG] Creating Spider instance`);
      this.spider = new Spider(mergedConfig);
      logger.info(`[DEBUG] Spider instance created: ${this.spider !== null}`);
      logger.info(`[DEBUG] Spider type: ${typeof this.spider}`);

      logger.info(`[DEBUG] Calling Spider.createDriver()`);
      this.driver = await this.spider.createDriver(mergedConfig, 'default');
      logger.info(`[DEBUG] Driver created: ${this.driver !== null}`);
      logger.info(`[DEBUG] Driver keys: ${this.driver ? Object.keys(this.driver).join(', ') : 'N/A'}`);

      this.isInitialized = true;
      logger.success('PuppeteerSpiderFetcher initialized successfully');
    } catch (error) {
      logger.error(`[DEBUG] Failed to initialize PuppeteerSpiderFetcher`);
      logger.error(`[DEBUG] Error type: ${error.constructor.name}`);
      logger.error(`[DEBUG] Error message: ${error.message}`);
      logger.error(`[DEBUG] Error stack: ${error.stack}`);
      throw error;
    }
  }

  async fetch(url) {
    if (!this.isInitialized) {
      throw new Error('PuppeteerSpiderFetcher not initialized. Call initialize() first.');
    }

    try {
      logger.info(`[DEBUG] Fetching with Puppeteer Spider: ${url}`);
      logger.info(`[DEBUG] Driver initialized: ${this.driver !== null}`);
      logger.info(`[DEBUG] Driver object keys: ${this.driver ? Object.keys(this.driver).join(', ') : 'N/A'}`);

      const pageFuncs = this.driver.encapsulatedPageFuncs;
      const contentFuncs = this.driver.encapsulatedContentFuncs;

      logger.info(`[DEBUG] pageFuncs available: ${pageFuncs !== undefined}`);
      logger.info(`[DEBUG] contentFuncs available: ${contentFuncs !== undefined}`);
      logger.info(`[DEBUG] pageFuncs type: ${typeof pageFuncs}`);
      logger.info(`[DEBUG] contentFuncs type: ${typeof contentFuncs}`);

      if (!pageFuncs) {
        throw new Error('pageFuncs is not available in driver');
      }
      if (!contentFuncs) {
        throw new Error('contentFuncs is not available in driver');
      }

      logger.info(`[DEBUG] Calling pageFuncs.open() with URL: ${url}`);
      await pageFuncs.open(url, {
        only: true,
        waitForComplete: true,
        timeout: 30000
      });
      logger.info(`[DEBUG] pageFuncs.open() completed successfully`);

      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info(`[DEBUG] Wait 1000ms completed`);

      logger.info(`[DEBUG] Calling contentFuncs.getFullPageOuterHTML()`);
      const html = await contentFuncs.getFullPageOuterHTML();
      logger.info(`[DEBUG] getFullPageOuterHTML() returned ${html ? html.length : 0} bytes`);

      if (!html || html.length === 0) {
        logger.warn(`[DEBUG] WARNING: HTML content is empty or null`);
      }

      logger.success(`Page fetched successfully via Puppeteer Spider: ${url}`);

      return {
        content: html,
        contentType: 'text/html',
        isText: true,
        isBinary: false
      };

    } catch (error) {
      logger.error(`[DEBUG] Puppeteer Spider fetch failed for ${url}`);
      logger.error(`[DEBUG] Error type: ${error.constructor.name}`);
      logger.error(`[DEBUG] Error message: ${error.message}`);
      logger.error(`[DEBUG] Error stack: ${error.stack}`);
      throw error;
    }
  }

  async cleanup() {
    if (this.isInitialized && this.driver) {
      try {
        const closeFn = this.driver.extendedCloseMethod;
        if (closeFn) {
          await closeFn.call(this.driver.encapsulatedPageFuncs);
        }
        this.isInitialized = false;
        this.driver = null;
        this.spider = null;
        logger.info('PuppeteerSpiderFetcher cleaned up successfully');
      } catch (error) {
        logger.error(`Failed to cleanup PuppeteerSpiderFetcher: ${error.message}`);
      }
    }
  }

  async takeScreenshot(filePath, options = {}) {
    if (!this.isInitialized || !this.driver) {
      throw new Error('PuppeteerSpiderFetcher not initialized');
    }

    try {
      const pageFuncs = this.driver.encapsulatedPageFuncs;
      if (!pageFuncs) {
        throw new Error('pageFuncs is not available in driver');
      }

      logger.info(`[DEBUG] Taking screenshot for: ${filePath}`);
      const screenshotOptions = {
        path: filePath,
        fullPage: options.fullPage !== false,
        quality: options.quality || 80,
        type: 'png'
      };

      logger.info(`[DEBUG] Screenshot options: ${JSON.stringify(screenshotOptions)}`);

      await pageFuncs.takeScreenshot(screenshotOptions);
      logger.success(`Screenshot captured: ${filePath}`);

      return filePath;
    } catch (error) {
      logger.error(`Failed to take screenshot: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PuppeteerSpiderFetcher;
