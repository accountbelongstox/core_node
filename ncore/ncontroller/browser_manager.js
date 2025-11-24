// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');
const { getInstance } = require('#@singleton_browser');
const { getThreadBus } = require('#@thread_bus');
const globalDir = require('#@global_dir');
const path = require('path');
const fs = require('fs');
const EnhancedPage = require('#@ncore/utils/puppeteer_spider_v2/src/implementations/pages/EnhancedPage.js');
const UnifiedRequestUtils = require('#@ncore/utils/puppeteer_spider_v2/src/utils/request/UnifiedRequestUtils.js');

class BrowserManager {
    constructor() {
        this.singleton = null;
        this.isLaunched = false;
        this.browserType = 'edge';
        this.enhancedPage = null;
        this.requestUtils = new Map(); // Map pageId -> UnifiedRequestUtils
    }

    async launch(options = {}) {
        try {
            logger.info('[BrowserManager] Launching browser...');

            this.browserType = options.browserType || 'edge';
            this.singleton = getInstance();
            await this.singleton.initialize();

            // Initialize EnhancedPage for smart tab reuse
            const session = await this.singleton.getSession();
            const browser = session.browser;

            // Get or create the first page
            let pages = await browser.pages();
            if (pages.length === 0) {
                await browser.newPage();
                pages = await browser.pages();
            }

            this.enhancedPage = new EnhancedPage(pages[0], browser, {
                urlComparisonStrict: false
            });
            await this.enhancedPage.initialize();

            this.isLaunched = true;
            logger.success(`[BrowserManager] Browser launched successfully (${this.browserType})`);
            logger.info(`[BrowserManager] Profile: ${this.singleton.sessionId}`);
            logger.success(`[BrowserManager] EnhancedPage initialized with smart tab reuse`);

            // Register with ThreadBus
            const threadBus = getThreadBus();
            threadBus.register('browser-manager', {
                priority: 15,
                onShutdown: async () => {
                    logger.info('[BrowserManager] ThreadBus shutdown signal received');
                    await this.shutdown();
                }
            });

            return true;
        } catch (error) {
            logger.error(`[BrowserManager] Failed to launch browser: ${error.message}`);
            return false;
        }
    }

    getStatus() {
        return {
            isLaunched: this.isLaunched,
            browserType: this.browserType,
            sessionId: this.singleton?.sessionId || null
        };
    }

    async openUrl(url, options = {}) {
        try {
            if (!this.isLaunched || !this.enhancedPage) {
                throw new Error('Browser is not launched. Call launch() first.');
            }

            logger.info(`[BrowserManager] Opening URL with smart tab reuse: ${url}`);

            // Use EnhancedPage's openUrl for smart tab reuse
            const navResult = await this.enhancedPage.openUrl(url, {
                waitForComplete: true,
                timeout: options.timeout || 30000,
                logging: true,
                showImages: options.showImages !== false,
                showStyle: options.showStyle !== false,
                urlStrict: options.matchMode === 'fullUrl'
            });

            const page = navResult.page || this.enhancedPage.activePage;
            const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const result = {
                success: true,
                pageId: pageId,
                url: await page.url(),
                title: await page.title(),
                tabAction: navResult.action // 'switched', 'reused', or 'created'
            };

            // Initialize UnifiedRequestUtils for this page
            const requestUtils = new UnifiedRequestUtils(page, {
                timeout: options.timeout || 30000,
                preferredMethod: options.preferredMethod || 'inject'
            });
            this.requestUtils.set(pageId, requestUtils);

            // Optional: Take screenshot
            if (options.screenshot !== false) {
                const screenshotBuffer = await page.screenshot({
                    type: options.screenshotOptions?.format || 'png',
                    quality: options.screenshotOptions?.quality || 80,
                    fullPage: options.screenshotOptions?.fullPage || false
                });
                // Save screenshot locally
                const screenshotDir = globalDir.getAppPublicDir('screenshots');
                const screenshotPath = path.join(screenshotDir, `${pageId}.png`);
                fs.writeFileSync(screenshotPath, screenshotBuffer);
                result.screenshot = screenshotPath;
            }

            // Optional: Get HTML content
            if (options.htmlContent) {
                result.htmlContent = await page.content();
            }

            // Store page reference
            if (!this.pages) {
                this.pages = new Map();
            }
            this.pages.set(pageId, page);

            logger.success(`[BrowserManager] Page opened successfully: ${pageId} (action: ${navResult.action})`);
            return result;

        } catch (error) {
            logger.error(`[BrowserManager] Failed to open URL: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Inject and execute API request in page context
     * @param {string} pageId - Page identifier
     * @param {string} apiUrl - API URL to request
     * @param {Object} options - Request options
     */
    async injectAPIRequest(pageId, apiUrl, options = {}) {
        try {
            const requestUtils = this.requestUtils.get(pageId);
            if (!requestUtils) {
                throw new Error(`No request utils found for pageId: ${pageId}`);
            }

            logger.info(`[BrowserManager] Injecting API request: ${apiUrl}`);

            const result = await requestUtils.fetchViaInject(apiUrl, {
                method: options.method || 'GET',
                headers: options.headers || {},
                body: options.body,
                responseType: options.responseType || 'json',
                timeout: options.timeout || 30000
            });

            logger.success(`[BrowserManager] API request completed: ${apiUrl}`);
            return result;

        } catch (error) {
            logger.error(`[BrowserManager] Failed to inject API request: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getPage(pageId) {
        return this.pages?.get(pageId) || null;
    }

    async closePage(pageId) {
        try {
            const page = this.getPage(pageId);
            if (page) {
                await page.close();
                this.pages.delete(pageId);
                logger.info(`[BrowserManager] Page closed: ${pageId}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`[BrowserManager] Failed to close page: ${error.message}`);
            return false;
        }
    }

    async navigateTo(pageId, url, options = {}) {
        try {
            const page = this.getPage(pageId);
            if (!page) {
                throw new Error(`Page not found: ${pageId}`);
            }

            await page.goto(url, {
                waitUntil: options.waitUntil || 'networkidle2',
                timeout: options.timeout || 30000
            });

            return {
                success: true,
                url: page.url(),
                title: await page.title()
            };
        } catch (error) {
            logger.error(`[BrowserManager] Failed to navigate: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getPageContent(pageId) {
        try {
            const page = this.getPage(pageId);
            if (!page) {
                throw new Error(`Page not found: ${pageId}`);
            }

            return await page.content();
        } catch (error) {
            logger.error(`[BrowserManager] Failed to get page content: ${error.message}`);
            throw error;
        }
    }

    async takeScreenshot(pageId, options = {}) {
        try {
            const page = this.getPage(pageId);
            if (!page) {
                throw new Error(`Page not found: ${pageId}`);
            }

            return await page.screenshot({
                type: options.format || 'png',
                quality: options.quality || 80,
                fullPage: options.fullPage || false
            });
        } catch (error) {
            logger.error(`[BrowserManager] Failed to take screenshot: ${error.message}`);
            throw error;
        }
    }

    listPages() {
        if (!this.pages) {
            return [];
        }
        return Array.from(this.pages.keys());
    }

    async createPage(pageId, options = {}) {
        try {
            if (!this.isLaunched || !this.singleton) {
                throw new Error('Browser is not launched');
            }

            const page = await this.singleton.createPage();
            const id = pageId || `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            if (!this.pages) {
                this.pages = new Map();
            }
            this.pages.set(id, page);

            logger.info(`[BrowserManager] Page created: ${id}`);
            return {
                success: true,
                pageId: id
            };
        } catch (error) {
            logger.error(`[BrowserManager] Failed to create page: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async shutdown() {
        try {
            // Close all pages
            if (this.pages) {
                for (const [pageId, page] of this.pages.entries()) {
                    try {
                        await page.close();
                    } catch (err) {
                        logger.warn(`[BrowserManager] Error closing page ${pageId}: ${err.message}`);
                    }
                }
                this.pages.clear();
            }

            if (this.singleton) {
                await this.singleton.cleanup();
            }
            this.isLaunched = false;
            logger.info('[BrowserManager] Browser shutdown complete');
        } catch (error) {
            logger.error(`[BrowserManager] Error during shutdown: ${error.message}`);
        }
    }
}

const browserManager = new BrowserManager();

module.exports = {
    browserManager,
    BrowserManager
};
