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
const puppeteer = require('puppeteer');
const GLOBAL_INSTANCES = require('./global_instance_manager');
const ConfigManager = require('./config/config_manager');
const BrowserDetector = require('./browser_detector');
const BrowserInstallerManager = require('./browser_installer_manager');

// Declare variables
const configManager = new ConfigManager();
const browserDetector = new BrowserDetector();
const browserInstallerManager = new BrowserInstallerManager();

class PuppeteerInstanceManager {
    constructor() {
        // Use global instance manager
        this.globalInstances = GLOBAL_INSTANCES;
    }

    // Create new instance
    async createInstance(config = {}, id = null, browserType = null) {
        try {
            const instanceId = id || this.globalInstances.generateInstanceId();
            
            // Initialize configuration with browser type
            const browser = browserType || 'edge';
            const configManager = new ConfigManager(browser);
            await configManager.initialize();
            const mergedConfig = configManager.updateConfig(config);
            
            logger.info(`Creating Puppeteer instance: ${instanceId} with ${browser}`);
            
            // Detect and setup browser
            await this.setupBrowser(browser);
            
            // Build browser-specific arguments
            mergedConfig.args = configManager.buildBrowserArgs();
            mergedConfig.ignoreDefaultArgs = configManager.getIgnoreDefaultArgs();
            
            // Launch browser
            const browserInstance = await puppeteer.launch(mergedConfig);
            const page = await browserInstance.newPage();
            await page.setViewport(mergedConfig.viewport);
            
            const instance = {
                id: instanceId,
                browser: browserInstance,
                page: page,
                config: mergedConfig,
                browserType: browser,
                configManager: configManager,
                isActive: true,
                createdAt: new Date().toISOString(),
                wrappers: new Map()
            };
            
            // Add to global instance manager
            this.globalInstances.addInstance(instance);
            
            logger.info(`Puppeteer instance created: ${instanceId}`);
            return instance;
            
        } catch (error) {
            logger.error(`Failed to create instance ${id}: ${error.message}`);
            throw error;
        }
    }

    // Setup browser (detect and install if needed)
    async setupBrowser(browserType = 'edge') {
        try {
            // Check if browser is available
            const isAvailable = await browserDetector.isBrowserAvailable(browserType);
            
            if (isAvailable) {
                // Get browser info
                const browserInfo = browserDetector.getBrowserInfo(browserType);
                if (browserInfo && browserInfo.executablePath) {
                    logger.info(`Using ${browserType} at: ${browserInfo.executablePath}`);
                    return browserInfo.executablePath;
                }
            }
            
            // Try to install browser
            logger.info(`${browserType} not found, attempting installation...`);
            const result = await browserInstallerManager.installBrowserWithFallback(browserType);
            
            if (result.success) {
                const browserPath = await browserInstallerManager.getBrowserPath(result.browserType);
                if (browserPath) {
                    logger.info(`Using ${result.browserType} at: ${browserPath}`);
                    return browserPath;
                }
            }
        } catch (error) {
            logger.warn('Browser setup failed:', error.message);
        }
        return null;
    }

    // Get instance by ID
    getInstance(id = null) {
        return this.globalInstances.getInstance(id);
    }

    // Get all instances
    getAllInstances() {
        return this.globalInstances.getAllInstances();
    }

    // Close instance
    async closeInstance(id) {
        const instance = this.globalInstances.getInstance(id);
        if (!instance) {
            throw new Error(`Instance ${id} not found`);
        }
        
        try {
            await instance.browser.close();
            this.globalInstances.removeInstance(id);
            
            logger.info(`Instance ${id} closed`);
        } catch (error) {
            logger.error(`Failed to close instance ${id}: ${error.message}`);
            throw error;
        }
    }

    // Close all instances
    async closeAllInstances() {
        const instances = this.globalInstances.getAllInstances();
        const closePromises = instances.map(instance => 
            this.closeInstance(instance.id).catch(error => 
                logger.error(`Failed to close instance ${instance.id}: ${error.message}`)
            )
        );
        
        await Promise.all(closePromises);
        logger.info('All instances closed');
    }

    // Get instance info
    getInstanceInfo(id = null) {
        if (id) {
            const instance = this.globalInstances.getInstance(id);
            return instance ? {
                id: instance.id,
                isActive: instance.isActive,
                config: instance.config,
                createdAt: instance.createdAt
            } : null;
        }
        
        return this.globalInstances.getAllInstances().map(instance => ({
            id: instance.id,
            isActive: instance.isActive,
            config: instance.config,
            createdAt: instance.createdAt
        }));
    }
}

module.exports = PuppeteerInstanceManager;
