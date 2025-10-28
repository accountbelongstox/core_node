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
const GLOBAL_INSTANCES = require('./global_instance_manager');

// High-level wrapper classes that can use default instance
class GlobalPuppeteerDriver {
    constructor(instanceId = null) {
        this.instanceId = instanceId;
        this.driver = null;
    }
    
    async initialize() {
        const instance = GLOBAL_INSTANCES.getInstance(this.instanceId);
        const PuppeteerDriver = require('./wrappers/climber/driver');
        this.driver = await PuppeteerDriver.createForInstance(instance);
        return this;
    }
    
    async close() {
        if (this.driver) {
            await this.driver.close();
        }
    }
    
    // Proxy methods to driver
    async downloadApplication(target, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadApplication(target, options);
    }
    
    async downloadImage(selector, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadImage(selector, options);
    }
    
    async downloadAudio(selector, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadAudio(selector, options);
    }
    
    async downloadFromUrl(url, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadFromUrl(url, options);
    }
    
    async getDownloadStatus() {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.getDownloadStatus();
    }
    
    listTargets() {
        if (!this.driver) {
            const gconfig = require('#@gconfig');
            const downloadConfigs = gconfig.downloadConfigs || gconfig.DOWNLOADCONFIGS;
            if (!downloadConfigs) {
                return [];
            }
            return Object.entries(downloadConfigs).map(([key, config]) => ({
                key,
                name: config.name || key,
                description: config.description || ''
            }));
        }
        return this.driver.downloadManager.listTargets();
    }
}

// Global DownloadManager wrapper
class GlobalDownloadManager {
    constructor(instanceId = null) {
        this.instanceId = instanceId;
        this.driver = null;
    }
    
    async initialize() {
        try {
            const instance = GLOBAL_INSTANCES.getInstance(this.instanceId);
            const PuppeteerDriver = require('./wrappers/climber/driver');
            this.driver = await PuppeteerDriver.createForInstance(instance);
            return this.driver.downloadManager;
        } catch (error) {
            // If no instance exists, create one
            if (error.message.includes('No instances available')) {
                const PuppeteerSpider = require('./puppeteer_spider');
                const spider = new PuppeteerSpider();
                await spider.initialize('edge');
                const instance = spider.getInstance();
                const PuppeteerDriver = require('./wrappers/climber/driver');
                this.driver = await PuppeteerDriver.createForInstance(instance);
                return this.driver.downloadManager;
            }
            throw error;
        }
    }
    
    async downloadApplication(target, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadApplication(target, options);
    }
    
    async downloadImage(selector, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadImage(selector, options);
    }
    
    async downloadAudio(selector, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadAudio(selector, options);
    }
    
    async downloadFromUrl(url, options = {}) {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.downloadFromUrl(url, options);
    }
    
    async getDownloadStatus() {
        if (!this.driver) await this.initialize();
        return await this.driver.downloadManager.getDownloadStatus();
    }
    
    listTargets() {
        if (!this.driver) {
            const gconfig = require('#@gconfig');
            const downloadConfigs = gconfig.downloadConfigs || gconfig.DOWNLOADCONFIGS;
            if (!downloadConfigs) {
                return [];
            }
            return Object.entries(downloadConfigs).map(([key, config]) => ({
                key,
                name: config.name || key,
                description: config.description || ''
            }));
        }
        return this.driver.downloadManager.listTargets();
    }
    
    async close() {
        if (this.driver) {
            await this.driver.close();
        }
    }
}

module.exports = {
    GlobalPuppeteerDriver,
    GlobalDownloadManager
};
