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

/**
 * Ncore Controller - Main backend controller
 */

const { EventEmitter } = require('events');

const logger = require('#@logger');
const { browserManager } = require('./browser_manager');
const { platformDetector } = require('./platform_detector');
const { controllerManager } = require('./controller_manager');

class NcoreController extends EventEmitter {
    constructor() {
        super();

        this.browserManager = browserManager;
        this.platformDetector = platformDetector;
        this.controllerManager = controllerManager;
        this.isStarted = false;
        this.config = {
            autoLaunchBrowser: true,
            browserType: 'edge'
        };
    }

    /**
     * Start the controller
     * @param {Object} options - Start options
     * @returns {Promise<Object>}
     */
    async start(options = {}) {
        if (this.isStarted) {
            logger.warn('[NcoreController] Already started');
            return this.getStatus();
        }

        logger.info('[NcoreController] Starting backend controller...');

        // Merge options
        this.config = { ...this.config, ...options };

        // Initialize controller manager
        await this.controllerManager.initialize();

        // Detect platform
        const isDesktop = await this.platformDetector.isDesktopSystem();
        logger.info(`[NcoreController] Platform: ${this.platformDetector.platform}, Desktop: ${isDesktop}`);

        // Auto-launch browser if configured
        if (this.config.autoLaunchBrowser) {
            const browserOptions = {
                browserType: this.config.browserType
                // headless mode auto-detected by browserManager via platformDetector
            };

            await this.browserManager.launch(browserOptions);
        }

        this.isStarted = true;
        logger.success('[NcoreController] Backend controller started');
        this.emit('started', this.getStatus());

        return this.getStatus();
    }

    /**
     * Stop the controller
     * @returns {Promise<boolean>}
     */
    async stop() {
        if (!this.isStarted) {
            logger.warn('[NcoreController] Not started');
            return true;
        }

        logger.info('[NcoreController] Stopping backend controller...');

        // Close browser
        await this.browserManager.close();

        this.isStarted = false;
        logger.success('[NcoreController] Backend controller stopped');
        this.emit('stopped');

        return true;
    }

    /**
     * Get controller status
     * @returns {Object}
     */
    getStatus() {
        return {
            isStarted: this.isStarted,
            config: this.config,
            browser: this.browserManager.getStatus(),
            platform: this.platformDetector.getInfo(),
            controllers: this.controllerManager.getStatus()
        };
    }

    /**
     * Create a new browser page
     * @param {string} pageId - Page identifier
     * @param {Object} options - Page options
     * @returns {Promise<Object>}
     */
    async createPage(pageId, options = {}) {
        return this.browserManager.createPage(pageId, options);
    }

    /**
     * Navigate page to URL
     * @param {string} pageId - Page identifier
     * @param {string} url - URL to navigate
     * @param {Object} options - Navigation options
     * @returns {Promise<Object>}
     */
    async navigateTo(pageId, url, options = {}) {
        return this.browserManager.navigateTo(pageId, url, options);
    }

    /**
     * Get page content
     * @param {string} pageId - Page identifier
     * @returns {Promise<string>}
     */
    async getPageContent(pageId) {
        return this.browserManager.getPageContent(pageId);
    }

    /**
     * Take screenshot
     * @param {string} pageId - Page identifier
     * @param {Object} options - Screenshot options
     * @returns {Promise<Buffer>}
     */
    async takeScreenshot(pageId, options = {}) {
        return this.browserManager.takeScreenshot(pageId, options);
    }

    /**
     * Close page
     * @param {string} pageId - Page identifier
     * @returns {Promise<boolean>}
     */
    async closePage(pageId) {
        return this.browserManager.closePage(pageId);
    }

    /**
     * List all pages
     * @returns {Array}
     */
    listPages() {
        return this.browserManager.listPages();
    }

    /**
     * Restart browser
     * @returns {Promise<Object>}
     */
    async restartBrowser() {
        logger.info('[NcoreController] Restarting browser...');

        await this.browserManager.close();

        const browserOptions = {
            browserType: this.config.browserType
            // headless mode auto-detected by browserManager via platformDetector
        };

        return this.browserManager.launch(browserOptions);
    }

    /**
     * Shutdown controller and browser
     * @returns {Promise<void>}
     */
    async shutdown() {
        logger.info('[NcoreController] Shutting down...');
        await this.controllerManager.shutdown();
        await this.browserManager.shutdown();
        logger.success('[NcoreController] Shutdown completed');
    }

    getDocumentController() {
        return this.controllerManager.getController('document');
    }

    getDeepSeekChatController() {
        return this.controllerManager.getController('deepseek_chat');
    }
}

const ncoreController = new NcoreController();

module.exports = {
    NcoreController,
    ncoreController
};
