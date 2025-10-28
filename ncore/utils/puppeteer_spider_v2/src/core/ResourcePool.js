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

class ResourcePool {
    constructor() {
        this.browserPool = new Map();
        this.pagePool = new Map();
        this.maxBrowsers = 5;
        this.maxPagesPerBrowser = 10;
        this.isInitialized = false;
        this.metrics = {
            browsersCreated: 0,
            browsersReleased: 0,
            pagesCreated: 0,
            pagesReleased: 0,
            poolHits: 0,
            poolMisses: 0
        };
    }

    async initialize() {
        try {
            logger.info('Initializing ResourcePool...');
            this.isInitialized = true;
            logger.info('ResourcePool initialized');
        } catch (error) {
            logger.error('Failed to initialize ResourcePool:', error);
            throw error;
        }
    }

    async getBrowser(type = 'edge') {
        const pool = this.browserPool.get(type) || [];
        
        // Find idle browser
        let browser = pool.find(b => b.isIdle && b.isIdle());
        
        if (browser) {
            browser.markBusy();
            this.metrics.poolHits++;
            logger.debug(`Browser reused from pool: ${type}`);
        } else {
            browser = await this.createBrowser(type);
            pool.push(browser);
            this.browserPool.set(type, pool);
            this.metrics.poolMisses++;
            logger.debug(`New browser created: ${type}`);
        }
        
        this.metrics.browsersCreated++;
        return browser;
    }

    async releaseBrowser(browser) {
        try {
            browser.markIdle();
            this.metrics.browsersReleased++;
            logger.debug(`Browser released to pool: ${browser.type}`);
        } catch (error) {
            logger.error('Failed to release browser:', error);
        }
    }

    async createBrowser(type) {
        const BrowserFactory = require('../factories/BrowserFactory');
        const browser = await BrowserFactory.create(type);
        
        // Add pool management methods
        browser.isIdle = () => browser._isIdle !== false;
        browser.markBusy = () => { browser._isIdle = false; };
        browser.markIdle = () => { browser._isIdle = true; };
        browser.type = type;
        
        return browser;
    }

    async getPage(browserType = 'edge') {
        const pool = this.pagePool.get(browserType) || [];
        
        // Find idle page
        let page = pool.find(p => p.isIdle && p.isIdle());
        
        if (page) {
            page.markBusy();
            this.metrics.poolHits++;
            logger.debug(`Page reused from pool: ${browserType}`);
        } else {
            const browser = await this.getBrowser(browserType);
            page = await browser.newPage();
            
            // Add pool management methods
            page.isIdle = () => page._isIdle !== false;
            page.markBusy = () => { page._isIdle = false; };
            page.markIdle = () => { page._isIdle = true; };
            page.browserType = browserType;
            
            pool.push(page);
            this.pagePool.set(browserType, pool);
            this.metrics.poolMisses++;
            logger.debug(`New page created: ${browserType}`);
        }
        
        this.metrics.pagesCreated++;
        return page;
    }

    async releasePage(page) {
        try {
            page.markIdle();
            this.metrics.pagesReleased++;
            logger.debug(`Page released to pool: ${page.browserType}`);
        } catch (error) {
            logger.error('Failed to release page:', error);
        }
    }

    async cleanup() {
        try {
            logger.info('Cleaning up ResourcePool...');
            
            // Close all browsers
            for (const [type, browsers] of this.browserPool) {
                for (const browser of browsers) {
                    try {
                        await browser.close();
                    } catch (error) {
                        logger.warn(`Failed to close browser ${type}:`, error);
                    }
                }
            }
            
            // Close all pages
            for (const [type, pages] of this.pagePool) {
                for (const page of pages) {
                    try {
                        await page.close();
                    } catch (error) {
                        logger.warn(`Failed to close page ${type}:`, error);
                    }
                }
            }
            
            this.browserPool.clear();
            this.pagePool.clear();
            this.isInitialized = false;
            
            logger.info('ResourcePool cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup ResourcePool:', error);
            throw error;
        }
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            maxBrowsers: this.maxBrowsers,
            maxPagesPerBrowser: this.maxPagesPerBrowser,
            browserPools: Array.from(this.browserPool.keys()).map(type => ({
                type,
                count: this.browserPool.get(type).length
            })),
            pagePools: Array.from(this.pagePool.keys()).map(type => ({
                type,
                count: this.pagePool.get(type).length
            })),
            metrics: this.metrics
        };
    }
}

module.exports = ResourcePool;
