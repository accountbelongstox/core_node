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
const IBrowser = require('../interfaces/IBrowser');
const IPage = require('../interfaces/IPage');

class ChromeBrowser extends IBrowser {
    constructor() {
        super();
        this.type = 'chrome';
        this.finder = null;
        this.config = null;
    }

    async launch(options = {}) {
        try {
            const ChromeFinder = require('../implementations/browsers/ChromeFinder');
            
            this.finder = new ChromeFinder();
            
            let executablePath = await this.finder.find();
            if (!executablePath) {
                logger.warn('Chrome browser not found. Attempting to install...');
                const ChromeInstaller = require('../implementations/browsers/ChromeInstaller');
                const installer = new ChromeInstaller();
                await installer.install();
                executablePath = await this.finder.find();
                
                if (!executablePath) {
                    throw new Error('Failed to install Chrome browser');
                }
            }
            
            const puppeteer = require('puppeteer');
            this.browser = await puppeteer.launch({
                executablePath,
                headless: options.headless !== false,
                args: options.args || [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                ...options
            });
            
            this.isLaunched = true;
            this.version = await this.getVersion();
            
            logger.info(`Chrome browser launched: ${this.version}`);
            return this.browser;
        } catch (error) {
            logger.error('Failed to launch Chrome browser:', error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.isLaunched = false;
                logger.info('Chrome browser closed');
            }
        } catch (error) {
            logger.error('Failed to close Chrome browser:', error);
            throw error;
        }
    }

    async newPage(options = {}) {
        if (!this.isLaunched) {
            throw new Error('Browser must be launched before creating pages');
        }

        try {
            const page = await this.browser.newPage();
            const StandardPage = require('../implementations/pages/StandardPage');
            return new StandardPage(page, options);
        } catch (error) {
            logger.error('Failed to create new page:', error);
            throw error;
        }
    }

    async getVersion() {
        if (!this.browser) {
            return null;
        }

        try {
            const version = await this.browser.version();
            return version;
        } catch (error) {
            logger.error('Failed to get browser version:', error);
            return null;
        }
    }

    async getPages() {
        if (!this.browser) {
            return [];
        }

        try {
            const pages = await this.browser.pages();
            return pages;
        } catch (error) {
            logger.error('Failed to get pages:', error);
            return [];
        }
    }

    async isConnected() {
        if (!this.browser) {
            return false;
        }

        try {
            return this.browser.isConnected();
        } catch (error) {
            logger.error('Failed to check connection:', error);
            return false;
        }
    }
}

class EdgeBrowser extends IBrowser {
    constructor() {
        super();
        this.type = 'edge';
        this.finder = null;
        this.config = null;
    }

    async launch(options = {}) {
        try {
            const EdgeFinder = require('../implementations/browsers/EdgeFinder');
            
            this.finder = new EdgeFinder();
            
            let executablePath = await this.finder.find();
            if (!executablePath) {
                logger.warn('Edge browser not found. Attempting to install...');
                const EdgeInstaller = require('../implementations/browsers/EdgeInstaller');
                const installer = new EdgeInstaller();
                await installer.install();
                executablePath = await this.finder.find();
                
                if (!executablePath) {
                    throw new Error('Failed to install Edge browser');
                }
            }
            
            const puppeteer = require('puppeteer');
            
            // Filter Edge-compatible arguments
            const edgeArgs = (options.args || []).filter(arg => {
                // Remove Chrome-specific arguments that Edge doesn't support
                return !arg.includes('--user-data-dir') && 
                       !arg.includes('--disable-gpu') &&
                       !arg.includes('--disable-accelerated-2d-canvas') &&
                       !arg.includes('--no-first-run') &&
                       !arg.includes('--no-zygote');
            });
            
            // Add Edge-specific arguments
            const defaultArgs = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images'
            ];
            
            this.browser = await puppeteer.launch({
                executablePath,
                headless: options.headless !== false,
                args: [...defaultArgs, ...edgeArgs],
                ...options
            });
            
            this.isLaunched = true;
            this.version = await this.getVersion();
            
            logger.info(`Edge browser launched: ${this.version}`);
            return this.browser;
        } catch (error) {
            logger.error('Failed to launch Edge browser:', error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.isLaunched = false;
                logger.info('Edge browser closed');
            }
        } catch (error) {
            logger.error('Failed to close Edge browser:', error);
            throw error;
        }
    }

    async newPage(options = {}) {
        if (!this.isLaunched) {
            throw new Error('Browser must be launched before creating pages');
        }

        try {
            const page = await this.browser.newPage();
            const StandardPage = require('../implementations/pages/StandardPage');
            return new StandardPage(page, options);
        } catch (error) {
            logger.error('Failed to create new page:', error);
            throw error;
        }
    }

    async getVersion() {
        if (!this.browser) {
            return null;
        }

        try {
            const version = await this.browser.version();
            return version;
        } catch (error) {
            logger.error('Failed to get browser version:', error);
            return null;
        }
    }

    async getPages() {
        if (!this.browser) {
            return [];
        }

        try {
            const pages = await this.browser.pages();
            return pages;
        } catch (error) {
            logger.error('Failed to get pages:', error);
            return [];
        }
    }

    async isConnected() {
        if (!this.browser) {
            return false;
        }

        try {
            return this.browser.isConnected();
        } catch (error) {
            logger.error('Failed to check connection:', error);
            return false;
        }
    }
}

class BrowserFactory {
    static async create(type = 'edge', config = {}) {
        logger.info(`Creating browser: ${type}`);
        
        switch (type.toLowerCase()) {
            case 'chrome':
                return new ChromeBrowser();
            case 'edge':
                return new EdgeBrowser();
            default:
                throw new Error(`Unsupported browser type: ${type}`);
        }
    }

    static getSupportedBrowsers() {
        return ['chrome', 'edge'];
    }
}

module.exports = BrowserFactory;
