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
const PuppeteerInstanceManager = require('./instance_manager');
const GLOBAL_INSTANCES = require('./global_instance_manager');

class PuppeteerSpider {
    constructor(config = {}, id = null) {
        this.config = config;
        this.id = id;
        this.instanceManager = new PuppeteerInstanceManager();
        this.instance = null;
    }

    // Initialize spider with browser
    async initialize(browserType = 'edge') {
        try {
            this.instance = await this.instanceManager.createInstance(this.config, this.id, browserType);
            logger.info(`PuppeteerSpider initialized with instance: ${this.instance.id} using ${browserType}`);
            return this;
        } catch (error) {
            logger.error(`Failed to initialize PuppeteerSpider: ${error.message}`);
            throw error;
        }
    }

    // Get current instance
    getInstance() {
        if (!this.instance) {
            throw new Error('Spider not initialized. Call initialize() first.');
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

    // Close spider
    async close() {
        if (this.instance) {
            await this.instanceManager.closeInstance(this.instance.id);
            this.instance = null;
            logger.info('PuppeteerSpider closed');
        }
    }

    // Get spider info
    getInfo() {
        if (!this.instance) {
            return { initialized: false };
        }
        
        return {
            initialized: true,
            instanceId: this.instance.id,
            browserType: this.instance.browserType,
            isActive: this.instance.isActive,
            createdAt: this.instance.createdAt
        };
    }
}

module.exports = PuppeteerSpider;
