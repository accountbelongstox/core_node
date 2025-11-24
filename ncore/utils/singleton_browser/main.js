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
const { createSpiderEngine } = require('#@puppeteer-v2');

class SingletonBrowser {
    constructor() {
        this.spiderEngine = null;
        this.defaultSession = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        this.sessionId = 'singleton_browser_session';
    }

    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    async _doInitialize() {
        try {
            if (this.isInitialized) {
                return this.defaultSession;
            }

            logger.info('Initializing singleton browser instance...');

            this.spiderEngine = createSpiderEngine();
            await this.spiderEngine.initialize();

            const { platformDetector } = require('#@platform_detector');
            const isDesktop = await platformDetector.isDesktopSystem();
            const headlessMode = !isDesktop;

            logger.info(`[SingletonBrowser] Browser headless mode: ${headlessMode} (desktop: ${isDesktop})`);

            this.defaultSession = await this.spiderEngine.createSession({
                browser: 'edge',
                browserOptions: {
                    headless: headlessMode,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--mute=true',
                        '--disable-extensions',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding'
                    ],
                    timeout: 120000,
                    ignoreDefaultArgs: false,
                    ignoreHTTPSErrors: true
                }
            });

            this.isInitialized = true;
            logger.info(`Singleton browser initialized successfully. Session ID: ${this.sessionId}`);

            return this.defaultSession;
        } catch (error) {
            logger.error(`Failed to initialize singleton browser: ${error.message}`);
            this.initializationPromise = null;
            throw error;
        }
    }

    async getSession() {
        await this.initialize();
        return this.defaultSession;
    }

    async createPage() {
        const session = await this.getSession();
        return await session.newPage();
    }

    async takeScreenshot(url = null, options = {}) {
        try {
            const page = await this.createPage();

            if (url) {
                await page.goto(url, {
                    waitUntil: 'networkidle2',
                    timeout: options.timeout || 30000
                });
            }

            const screenshot = await page.screenshot({
                type: options.format || 'png',
                quality: options.quality || 80,
                fullPage: options.fullPage || false,
                clip: options.clip || null
            });

            await page.close();
            return screenshot;
        } catch (error) {
            logger.error(`Failed to take screenshot: ${error.message}`);
            throw error;
        }
    }

    async getPageContent(url = null, options = {}) {
        try {
            const page = await this.createPage();

            if (url) {
                await page.goto(url, {
                    waitUntil: options.waitUntil || 'networkidle2',
                    timeout: options.timeout || 30000
                });
            }

            const content = await page.content();
            const title = await page.title();

            const result = {
                url: url || page.url(),
                title: title,
                html: content,
                timestamp: new Date().toISOString()
            };

            await page.close();
            return result;
        } catch (error) {
            logger.error(`Failed to get page content: ${error.message}`);
            throw error;
        }
    }

    async evaluateJavaScript(url, script, options = {}) {
        try {
            const page = await this.createPage();

            if (url) {
                await page.goto(url, {
                    waitUntil: options.waitUntil || 'networkidle2',
                    timeout: options.timeout || 30000
                });
            }

            const result = await page.evaluate(script);

            await page.close();
            return result;
        } catch (error) {
            logger.error(`Failed to evaluate JavaScript: ${error.message}`);
            throw error;
        }
    }

    async clickElement(url, selector, options = {}) {
        try {
            const page = await this.createPage();

            if (url) {
                await page.goto(url, {
                    waitUntil: options.waitUntil || 'networkidle2',
                    timeout: options.timeout || 30000
                });
            }

            await page.waitForSelector(selector, { timeout: options.waitTimeout || 10000 });
            await page.click(selector);

            if (options.waitForNavigation) {
                await page.waitForNavigation({ timeout: options.navTimeout || 10000 });
            }

            const result = {
                url: page.url(),
                title: await page.title(),
                success: true
            };

            await page.close();
            return result;
        } catch (error) {
            logger.error(`Failed to click element: ${error.message}`);
            throw error;
        }
    }

    async waitForElement(url, selector, options = {}) {
        try {
            const page = await this.createPage();

            if (url) {
                await page.goto(url, {
                    waitUntil: options.waitUntil || 'networkidle2',
                    timeout: options.timeout || 30000
                });
            }

            await page.waitForSelector(selector, { timeout: options.waitTimeout || 10000 });

            const element = await page.$(selector);
            const text = await page.evaluate(el => el.textContent, element);

            const result = {
                found: true,
                text: text,
                selector: selector
            };

            await page.close();
            return result;
        } catch (error) {
            logger.error(`Failed to wait for element: ${error.message}`);
            return { found: false, error: error.message };
        }
    }

    async getStatus() {
        const status = {
            isInitialized: this.isInitialized,
            hasEngine: !!this.spiderEngine,
            hasSession: !!this.defaultSession,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
        };

        if (this.isInitialized && this.defaultSession) {
            try {
                // Get detailed browser information
                const browser = this.defaultSession.browser;
                if (browser) {
                    status.browser = {
                        userAgent: await browser.userAgent(),
                        version: await browser.version(),
                        processId: browser.process()?.pid || null
                    };
                }

                // Get session information
                status.session = {
                    id: this.defaultSession.id,
                    pagesCount: this.defaultSession.pages.size,
                    activePages: Array.from(this.defaultSession.pages.keys())
                };

                // Test browser responsiveness
                const testPage = await this.createPage();
                status.browser.responsive = true;
                await testPage.close();

            } catch (error) {
                status.browser = {
                    responsive: false,
                    error: error.message
                };
            }
        }

        return status;
    }

    async cleanup() {
        try {
            if (this.defaultSession && this.spiderEngine) {
                await this.spiderEngine.closeSession(this.sessionId);
            }

            if (this.spiderEngine) {
                await this.spiderEngine.shutdown();
            }

            this.isInitialized = false;
            this.initializationPromise = null;
            this.defaultSession = null;
            this.spiderEngine = null;

            logger.info('Singleton browser cleaned up successfully');
        } catch (error) {
            logger.error(`Error during cleanup: ${error.message}`);
        }
    }
}

// Singleton instance
let instance = null;

function getInstance() {
    if (!instance) {
        instance = new SingletonBrowser();
    }
    return instance;
}

module.exports = {
    SingletonBrowser,
    getInstance
};