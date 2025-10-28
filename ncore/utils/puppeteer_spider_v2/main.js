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

// Core classes
const SpiderEngine = require('./src/core/SpiderEngine');
const SessionManager = require('./src/core/SessionManager');
const ResourcePool = require('./src/core/ResourcePool');
const EventBus = require('./src/core/EventBus');
const PluginManager = require('./src/core/PluginManager');

// Interfaces
const IBrowser = require('./src/interfaces/IBrowser');
const IPage = require('./src/interfaces/IPage');
const IDownloader = require('./src/interfaces/IDownloader');
const IPlugin = require('./src/interfaces/IPlugin');

// Factories
const BrowserFactory = require('./src/factories/BrowserFactory');

// Config
const ConfigManager = require('./src/config/ConfigManager');

// Core plugins
const DownloadPlugin = require('./src/plugins/core/DownloadPlugin');
const ContentPlugin = require('./src/plugins/core/ContentPlugin');
const AutomationPlugin = require('./src/plugins/core/AutomationPlugin');

// Extension plugins
const ScreenshotPlugin = require('./src/plugins/extensions/ScreenshotPlugin');
const FormPlugin = require('./src/plugins/extensions/FormPlugin');

// Browser implementations
const ChromeFinder = require('./src/implementations/browsers/ChromeFinder');
const ChromeInstaller = require('./src/implementations/browsers/ChromeInstaller');
const EdgeFinder = require('./src/implementations/browsers/EdgeFinder');
const EdgeInstaller = require('./src/implementations/browsers/EdgeInstaller');

// Utils
const { Logger, Validator, RetryHandler, PerformanceMonitor } = require('./src/utils/Logger');
const CacheManager = require('./src/utils/CacheManager');

// New categorized utils
const BaseUtils = require('./src/utils/base/BaseUtils');
const PageOperationUtils = require('./src/utils/operations/PageOperationUtils');
const ElementFinderUtils = require('./src/utils/finder/ElementFinderUtils');
const NavigationUtils = require('./src/utils/navigation/NavigationUtils');
const DataExtractionUtils = require('./src/utils/extraction/DataExtractionUtils');
const BrowserControlUtils = require('./src/utils/control/BrowserControlUtils');
const EventUtils = require('./src/utils/events/EventUtils');

// Compatibility
const { LegacyAdapter, MigrationTool } = require('./src/compat/LegacyAdapter');

// Create default engine instance
let defaultEngine = null;

// Factory function to create new engine instances
function createSpiderEngine(config = {}) {
    return new SpiderEngine(config);
}

// Factory function to get or create default engine
async function getDefaultEngine(config = {}) {
    if (!defaultEngine) {
        defaultEngine = new SpiderEngine(config);
        await defaultEngine.initialize();
    }
    return defaultEngine;
}

// Convenience function to create a session
async function createSession(options = {}) {
    const engine = await getDefaultEngine();
    return await engine.createSession(options);
}

// Convenience function to get a session
function getSession(sessionId) {
    if (!defaultEngine) {
        throw new Error('No default engine available. Call createSession() first.');
    }
    return defaultEngine.getSession(sessionId);
}

// Convenience function to close a session
async function closeSession(sessionId) {
    if (!defaultEngine) {
        throw new Error('No default engine available.');
    }
    return await defaultEngine.closeSession(sessionId);
}

// Convenience function to shutdown default engine
async function shutdown() {
    if (defaultEngine) {
        await defaultEngine.shutdown();
        defaultEngine = null;
    }
}

// Export everything
module.exports = {
    // Core classes
    SpiderEngine,
    SessionManager,
    ResourcePool,
    EventBus,
    PluginManager,
    
    // Interfaces
    IBrowser,
    IPage,
    IDownloader,
    IPlugin,
    
    // Factories
    BrowserFactory,
    
    // Config
    ConfigManager,
    
    // Core plugins
    DownloadPlugin,
    ContentPlugin,
    AutomationPlugin,
    
    // Extension plugins
    ScreenshotPlugin,
    FormPlugin,
    
    // Browser implementations
    ChromeFinder,
    ChromeInstaller,
    EdgeFinder,
    EdgeInstaller,
    
    // Utils
    Logger,
    Validator,
    RetryHandler,
    PerformanceMonitor,
    CacheManager,
    
    // New categorized utils
    BaseUtils,
    PageOperationUtils,
    ElementFinderUtils,
    NavigationUtils,
    DataExtractionUtils,
    BrowserControlUtils,
    EventUtils,
    
    // Compatibility
    LegacyAdapter,
    MigrationTool,
    
    // Convenience functions
    createSpiderEngine,
    getDefaultEngine,
    createSession,
    getSession,
    closeSession,
    shutdown,
    
    // Legacy compatibility (will be deprecated)
    PuppeteerSpider: SpiderEngine,
    PuppeteerInstanceManager: SessionManager,
    ConfigManager: ConfigManager,
    BrowserDetector: BrowserFactory,
    
    // Version info
    version: '2.0.0',
    name: 'puppeteer-spider-v2'
};
