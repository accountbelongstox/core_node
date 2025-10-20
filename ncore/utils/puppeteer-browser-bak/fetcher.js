// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const puppeteerAPI = require('./puppeteer-api/api.js');
const logger = require('#@logger');

class PuppeteerFetcher {
  constructor() {
    this.puppeteerInstanceId = null;
    this.isInitialized = false;
  }

  async initialize(config = {}) {
    if (this.isInitialized) {
      logger.warn('PuppeteerFetcher already initialized');
      return;
    }

    try {
      const instance = await puppeteerAPI.createInstance(config, 'server');
      this.puppeteerInstanceId = instance.id;
      puppeteerAPI.setDefaultInstance(this.puppeteerInstanceId);
      this.isInitialized = true;
      logger.success('PuppeteerFetcher initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize PuppeteerFetcher: ${error.message}`);
      throw error;
    }
  }

  async fetch(url) {
    if (!this.isInitialized) {
      throw new Error('PuppeteerFetcher not initialized. Call initialize() first.');
    }

    try {
      logger.info(`Fetching with Puppeteer: ${url}`);

      const result = await puppeteerAPI.fetchRenderedHtml(url, {
        waitForSelector: null,
        waitForTimeout: 30000,
        additionalWaitTime: 1000,
        closeAfterFetch: false
      }, this.puppeteerInstanceId);

      logger.success(`Page fetched successfully via Puppeteer: ${url}`);

      return result;

    } catch (error) {
      logger.error(`Puppeteer fetch failed for ${url}: ${error.message}`);
      throw error;
    }
  }

  async cleanup() {
    if (this.isInitialized && this.puppeteerInstanceId !== null) {
      try {
        await puppeteerAPI.closeInstance(this.puppeteerInstanceId);
        this.isInitialized = false;
        this.puppeteerInstanceId = null;
        logger.info('PuppeteerFetcher cleaned up successfully');
      } catch (error) {
        logger.error(`Failed to cleanup PuppeteerFetcher: ${error.message}`);
      }
    }
  }
}

module.exports = PuppeteerFetcher;
