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

// Main entry point for puppeteer_spider library
// This file serves as the main export point for all functionality

// Core classes
const PuppeteerSpider = require('./library/puppeteer_spider');
const PuppeteerInstanceManager = require('./library/instance_manager');

// Global managers
const GLOBAL_INSTANCES = require('./library/global_instance_manager');
const { GlobalPuppeteerDriver, GlobalDownloadManager } = require('./library/global_wrappers');

// Configuration and utilities
const ConfigManager = require('./library/config/config_manager');
const BrowserDetector = require('./library/browser_detector');
const BrowserInstallerManager = require('./library/browser_installer_manager');

// Factory helpers (avoid eager singletons)
function createInstanceManager() {
    return new PuppeteerInstanceManager();
}

function createConfigManager(defaultBrowser = 'edge') {
    return new ConfigManager(defaultBrowser);
}

function createBrowserDetector() {
    return new BrowserDetector();
}

function createBrowserInstallerManager() {
    return new BrowserInstallerManager();
}

// Default config factory (deferred)
function getDefaultConfig(defaultBrowser = 'edge') {
    const cm = new ConfigManager(defaultBrowser);
    return cm.getConfig();
}

// Configuration example function
function showConfigExample() {
    const EdgeConfig = require('./library/config/edge_config');
    const ChromeConfig = require('./library/config/chrome_config');
    
    const edgeConfig = new EdgeConfig();
    const chromeConfig = new ChromeConfig();
    
    console.log('=== PuppeteerSpider Configuration Examples ===');
    console.log('\n=== Edge Configuration ===');
    console.log(JSON.stringify(edgeConfig.getConfig(), null, 2));
    console.log('\n=== Chrome Configuration ===');
    console.log(JSON.stringify(chromeConfig.getConfig(), null, 2));
    console.log('\n=== Usage Examples ===');
    console.log('// Single instance (default Edge)');
    console.log('const { PuppeteerSpider } = require("./main.js");');
    console.log('const spider = new PuppeteerSpider();');
    console.log('await spider.initialize(); // Uses Edge by default');
    console.log('\n// Multiple instances with different browsers');
    console.log('const spider1 = new PuppeteerSpider(config1, "spider1");');
    console.log('const spider2 = new PuppeteerSpider(config2, "spider2");');
    console.log('await spider1.initialize("edge");');
    console.log('await spider2.initialize("chrome");');
    console.log('\n=== Advanced Wrapper Usage Examples ===');
    console.log('// Standalone usage (default to first instance)');
    console.log('const { Download } = require("./main.js");');
    console.log('const download = new Download();');
    console.log('await download.initialize();');
    console.log('await download.downloadApplication("vscode");');
    console.log('\n// Specific instance usage');
    console.log('const download = new Download("instance-id");');
    console.log('await download.initialize("instance-id");');
    console.log('await download.downloadApplication("cursor");');
    console.log('\n// Page operations');
    console.log('const { PageWrapper } = require("./main.js");');
    console.log('const pageWrapper = new PageWrapper();');
    console.log('await pageWrapper.navigateTo("https://example.com");');
    console.log('await pageWrapper.clickElement("#button");');
    console.log('\n// Content extraction');
    console.log('const { ContentWrapper } = require("./main.js");');
    console.log('const contentWrapper = new ContentWrapper();');
    console.log('const text = await contentWrapper.extractText(".content");');
    console.log('const links = await contentWrapper.extractLinks();');
}

// Export main classes and functions
module.exports = {
    // Main classes
    PuppeteerSpider,
    PuppeteerInstanceManager,
    
    // Factories (preferred)
    createInstanceManager,
    createConfigManager,
    createBrowserDetector,
    createBrowserInstallerManager,
    
    // Configuration and utilities
    getDefaultConfig,
    
    // Browser-specific configurations
    EdgeConfig: require('./library/config/edge_config'),
    ChromeConfig: require('./library/config/chrome_config'),
    
    // Configuration
    DEFAULT_CONFIG: getDefaultConfig(),
    showConfigExample,
    
    // Browser finders and installers
    EdgeFinder: require('./library/browsers/edge/finder'),
    EdgeInstaller: require('./library/browsers/edge/installer'),
    ChromeFinder: require('./library/browsers/chrome/finder'),
    ChromeInstaller: require('./library/browsers/chrome/installer'),
    
    // Version mappers
    ChromeVersionMapper: require('./library/version_mappers/chrome'),
    EdgeVersionMapper: require('./library/version_mappers/edge'),
    
    // Driver downloader
    DriverDownloader: require('./library/drivers/driver_downloader'),
    
    // Advanced wrapper classes (can be used standalone or attached to instances)
    Download: require('./library/wrappers/climber/modus/download'),
    PageWrapper: require('./library/wrappers/climber/modus/page_wrapper'),
    ContentWrapper: require('./library/wrappers/climber/modus/content_wrapper'),
    
    // Climber wrappers
    PuppeteerDriver: require('./library/wrappers/climber/driver'),
    
    // Global high-level wrappers (default to first instance)
    GlobalPuppeteerDriver,
    GlobalDownloadManager,
    
    // Legacy exports for backward compatibility
    WebSpider: PuppeteerSpider,
    PuppeteerManager: PuppeteerSpider,
    PuppeteerSpiderFetcher: PuppeteerSpider
};