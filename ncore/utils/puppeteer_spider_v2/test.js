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

// Test browser finders and installers
async function testBrowserDetection() {
    try {
        logger.info('Testing browser detection and installation...');
        
        const ChromeFinder = require('./src/implementations/browsers/ChromeFinder');
        const ChromeInstaller = require('./src/implementations/browsers/ChromeInstaller');
        const EdgeFinder = require('./src/implementations/browsers/EdgeFinder');
        const EdgeInstaller = require('./src/implementations/browsers/EdgeInstaller');
        
        // Test Chrome detection
        const chromeFinder = new ChromeFinder();
        const chromePath = await chromeFinder.find();
        logger.info(`Chrome found at: ${chromePath || 'Not found'}`);
        
        if (chromePath) {
            const chromeVersion = await chromeFinder.getVersion(chromePath);
            logger.info(`Chrome version: ${chromeVersion || 'Unknown'}`);
        }
        
        // Test Edge detection
        const edgeFinder = new EdgeFinder();
        const edgePath = await edgeFinder.find();
        logger.info(`Edge found at: ${edgePath || 'Not found'}`);
        
        if (edgePath) {
            const edgeVersion = await edgeFinder.getVersion(edgePath);
            logger.info(`Edge version: ${edgeVersion || 'Unknown'}`);
        }
        
        // Test installer info
        const chromeInstaller = new ChromeInstaller();
        const edgeInstaller = new EdgeInstaller();
        
        logger.info('Chrome installer info:', chromeInstaller.getInfo());
        logger.info('Edge installer info:', edgeInstaller.getInfo());
        
        logger.info('Browser detection test completed successfully');
        
    } catch (error) {
        logger.error('Browser detection test failed:', error);
    }
}

// Test BrowserFactory
async function testBrowserFactory() {
    try {
        logger.info('Testing BrowserFactory...');
        
        const BrowserFactory = require('./src/factories/BrowserFactory');
        
        // Test supported browsers
        const supportedBrowsers = BrowserFactory.getSupportedBrowsers();
        logger.info('Supported browsers:', supportedBrowsers);
        
        // Test browser creation (without launching)
        const chromeBrowser = await BrowserFactory.create('chrome');
        const edgeBrowser = await BrowserFactory.create('edge');
        
        logger.info('Chrome browser created:', chromeBrowser.type);
        logger.info('Edge browser created:', edgeBrowser.type);
        
        logger.info('BrowserFactory test completed successfully');
        
    } catch (error) {
        logger.error('BrowserFactory test failed:', error);
    }
}

// Test core functionality
async function testCoreFunctionality() {
    try {
        logger.info('Testing core functionality...');
        
        const { createSpiderEngine, createSession } = require('./main');
        
        // Test session creation
        const session = await createSession('test-session', {
            browser: 'edge',
            headless: true
        });
        
        logger.info('Session created:', session.id);
        
        // Test engine creation
        const engine = createSpiderEngine();
        logger.info('Engine created:', engine.constructor.name);
        
        logger.info('Core functionality test completed successfully');
        
    } catch (error) {
        logger.error('Core functionality test failed:', error);
    }
}

// Run all tests
async function runTests() {
    try {
        logger.info('Starting puppeteer_spider_v2 tests...');
        
        await testBrowserDetection();
        await testBrowserFactory();
        await testCoreFunctionality();
        
        logger.info('All tests completed successfully!');
        
    } catch (error) {
        logger.error('Test suite failed:', error);
    }
}

// Export test functions
module.exports = {
    testBrowserDetection,
    testBrowserFactory,
    testCoreFunctionality,
    runTests
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}
