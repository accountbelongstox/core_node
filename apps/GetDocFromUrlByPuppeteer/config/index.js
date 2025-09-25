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
 * DocOfflineDownloader Configuration
 * 
 * This module exports the configuration for the DocOfflineDownloader application.
 * The configuration will be merged with the main configuration through gconfig.
 */

module.exports = {
    // Application name
    appName: 'DocOfflineDownloader',
    
    // Application version
    version: '1.0.0',
    
    // Application description
    description: 'Doc URL output and offline downloader using puppeteer-browser',
    
    // Default configuration
    DocOfflineDownloader: {
        // Enable/disable download functionality
        enableDownload: true,
        
        // List of doc URLs to process
        docUrls: [
            'https://docs.puppeteer.dev/',
            'https://nodejs.org/docs/',
            'https://developer.mozilla.org/en-US/docs/'
        ],
        
        // Puppeteer configuration
        puppeteer: {
            headless: true,
            stealth: true,
            timeout: 30000,
            waitUntil: 'networkidle2'
        },
        
        // Download settings
        download: {
            // Maximum concurrent downloads
            maxConcurrent: 3,
            
            // Delay between downloads (ms)
            delayBetweenDownloads: 1000,
            
            // File types to download
            fileTypes: ['html', 'png', 'pdf'],
            
            // Maximum file size (bytes)
            maxFileSize: 50 * 1024 * 1024 // 50MB
        },
        
        // Output settings
        output: {
            // Enable console output
            console: true,
            
            // Enable file output
            file: true,
            
            // Output file path
            outputFile: 'doc_analysis.json',
            
            // Include screenshots
            includeScreenshots: true,
            
            // Include HTML content
            includeHTML: true
        },
        
        // Logging settings
        logging: {
            level: 'info',
            enableFileLogging: true,
            logFile: 'doc_downloader.log'
        }
    }
}; 