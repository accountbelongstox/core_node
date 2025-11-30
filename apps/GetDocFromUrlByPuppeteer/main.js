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

/**
 * DocOfflineDownloader App - Main Entry Point
 * 
 * This app provides functionality to output doc URLs and download them offline
 * using puppeteer-browser for web scraping and document processing.
 * 
 * @module DocOfflineDownloader
 */

const logger = require('#@logger');
const globalVars = require('#@global_vars');
const globalDir = require('#@global_dir');
const gconfig = require('#@gconfig');
const DocProcessorService = require('./service/docProcessor.js');

/**
 * Start the DocOfflineDownloader application
 * @param {Object} options - Application options
 */
async function start(options = {}) {
    try {
        logger.info('Starting DocOfflineDownloader application...');
        
        // Initialize app configuration
        const appConfig = gconfig.get('DocOfflineDownloader') || {};
        
        // Create app instance
        const app = new DocOfflineDownloaderApp(appConfig);
        
        // Start the application
        await app.start();
        
        logger.info('DocOfflineDownloader application started successfully');
    } catch (error) {
        logger.error('Failed to start DocOfflineDownloader application:', error);
        process.exit(1);
    }
}

/**
 * DocOfflineDownloader Application Class
 */
class DocOfflineDownloaderApp {
    constructor(config) {
        this.config = config;
        this.docProcessor = new DocProcessorService(config);
    }
    
    /**
     * Start the application
     */
    async start() {
        try {
            logger.info('Initializing DocOfflineDownloader...');
            
            // Create download directory
            const downloadDir = globalDir.getAppPublicDir('DocOfflineDownloader');
            logger.info(`Download directory: ${downloadDir}`);
            
            // Start the main application logic
            await this.runMainLogic();
            
        } catch (error) {
            logger.error('Error starting DocOfflineDownloader:', error);
            throw error;
        }
    }
    
    /**
     * Run the main application logic
     */
    async runMainLogic() {
        try {
            logger.info('Running main application logic...');
            
            // Get doc URLs from configuration
            const docUrls = this.config.docUrls || [];
            
            if (docUrls.length === 0) {
                logger.warn('No doc URLs configured. Please add URLs to config.');
                return;
            }
            
            // Process all doc URLs using the service
            const results = await this.docProcessor.processDocUrls(docUrls);
            
            logger.info(`Successfully processed ${results.length} doc URLs`);
            
        } catch (error) {
            logger.error('Error in main logic:', error);
            throw error;
        }
    }
}

// Export the start function
module.exports = {
    start
}; 