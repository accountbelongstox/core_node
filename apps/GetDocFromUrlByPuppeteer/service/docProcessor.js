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
 * Doc Processor Service
 * 
 * This service handles doc URL processing, content extraction, and offline downloading
 * using puppeteer-browser functionality.
 */

const logger = require('#@logger');
const globalDir = require('#@global_dir');
const fwriter = require('#@fwriter');
const puppeteerBrowser = require('#@ncore/utils/puppeteer-browser/index.js');

/**
 * Doc Processor Service Class
 */
class DocProcessorService {
    constructor(config) {
        this.config = config;
        this.puppeteerManager = puppeteerBrowser.manager;
        this.processedUrls = new Set();
    }
    
    /**
     * Process a list of doc URLs
     * @param {Array<string>} urls - Array of doc URLs to process
     * @returns {Promise<Array>} Array of processed doc information
     */
    async processDocUrls(urls) {
        const results = [];
        
        for (const url of urls) {
            try {
                const result = await this.processSingleDocUrl(url);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                logger.error(`Error processing URL ${url}:`, error);
            }
        }
        
        return results;
    }
    
    /**
     * Process a single doc URL
     * @param {string} url - The doc URL to process
     * @returns {Promise<Object>} Processed doc information
     */
    async processSingleDocUrl(url) {
        if (this.processedUrls.has(url)) {
            logger.info(`URL already processed: ${url}`);
            return null;
        }
        
        try {
            logger.info(`Processing doc URL: ${url}`);
            
            // Create puppeteer instance
            const instance = await this.puppeteerManager.createPuppeteerSpiderInstance({
                headless: this.config.puppeteer?.headless ?? true,
                stealth: this.config.puppeteer?.stealth ?? true
            });
            
            try {
                // Navigate to the doc URL
                await instance.goto(url, {
                    waitUntil: this.config.puppeteer?.waitUntil ?? 'networkidle2',
                    timeout: this.config.puppeteer?.timeout ?? 30000
                });
                
                // Extract doc information
                const docInfo = await this.extractDocInformation(instance, url);
                
                // Mark as processed
                this.processedUrls.add(url);
                
                // Output doc information
                await this.outputDocInformation(docInfo);
                
                // Download content if enabled
                if (this.config.enableDownload) {
                    await this.downloadDocContent(instance, docInfo);
                }
                
                return docInfo;
                
            } finally {
                // Close the instance
                await this.puppeteerManager.closePuppeteerSpiderInstance(instance);
            }
            
        } catch (error) {
            logger.error(`Error processing doc URL ${url}:`, error);
            return null;
        }
    }
    
    /**
     * Extract doc information from the page
     * @param {Object} instance - Puppeteer instance
     * @param {string} url - The doc URL
     * @returns {Promise<Object>} Doc information
     */
    async extractDocInformation(instance, url) {
        try {
            const docInfo = await instance.evaluate(() => {
                const title = document.title || '';
                const description = document.querySelector('meta[name="description"]')?.content || '';
                const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
                
                // Extract all links for potential doc pages
                const links = Array.from(document.querySelectorAll('a[href]'))
                    .map(link => ({
                        href: link.href,
                        text: link.textContent?.trim() || '',
                        title: link.title || '',
                        isExternal: link.href && !link.href.startsWith(window.location.origin)
                    }))
                    .filter(link => link.href && link.href.startsWith('http'));
                
                return {
                    title,
                    description,
                    keywords,
                    links,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                };
            });
            
            return docInfo;
            
        } catch (error) {
            logger.error('Error extracting doc information:', error);
            return {
                url,
                title: '',
                description: '',
                keywords: '',
                links: [],
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Output doc information to console and file
     * @param {Object} docInfo - Doc information object
     */
    async outputDocInformation(docInfo) {
        try {
            // Console output
            logger.info('=== Doc Information ===');
            logger.info(`URL: ${docInfo.url}`);
            logger.info(`Title: ${docInfo.title}`);
            logger.info(`Description: ${docInfo.description}`);
            logger.info(`Keywords: ${docInfo.keywords}`);
            logger.info(`Found ${docInfo.links.length} links`);
            logger.info(`Timestamp: ${docInfo.timestamp}`);
            
            // Log internal links
            const internalLinks = docInfo.links.filter(link => !link.isExternal);
            if (internalLinks.length > 0) {
                logger.info('Internal links:');
                internalLinks.forEach((link, index) => {
                    logger.info(`  ${index + 1}. ${link.text} - ${link.href}`);
                });
            }
        } catch (error) {
            logger.error('Error outputting doc information:', error);
        }
    }
    
    /**
     * Save doc information to file
     * @param {Object} docInfo - Doc information object
     */
    async saveDocInfoToFile(docInfo) {
        try {
            const outputDir = globalDir.getAppPublicDir('DocOfflineDownloader');
            const outputFile = this.config.output?.outputFile || 'doc_analysis.json';
            const outputPath = `${outputDir}/${outputFile}`;
            
            // Read existing data if file exists
            let existingData = [];
            try {
                const existingContent = await fwriter.readFile(outputPath, 'utf8');
                existingData = JSON.parse(existingContent);
            } catch (error) {
                // File doesn't exist or is invalid, start with empty array
            }
            
            // Add new doc info
            existingData.push(docInfo);
            
            // Write back to file
            await fwriter.writeFile(outputPath, JSON.stringify(existingData, null, 2), 'utf8');
            
            logger.info(`Doc information saved to: ${outputPath}`);
            
        } catch (error) {
            logger.error('Error saving doc information to file:', error);
        }
    }
    
    /**
     * Download doc content (HTML and screenshot)
     * @param {Object} instance - Puppeteer instance
     * @param {Object} docInfo - Doc information object
     */
    async downloadDocContent(instance, docInfo) {
        try {
            logger.info(`Downloading content for: ${docInfo.url}`);
            
            const downloadDir = globalDir.getAppPublicDir('DocOfflineDownloader');
            const fileName = this.sanitizeFileName(docInfo.title || 'doc');
            
            // Take screenshot
            const screenshotPath = `${downloadDir}/${fileName}.png`;
            await instance.screenshot({
                path: screenshotPath,
                fullPage: true
            });
            logger.info(`Screenshot saved to: ${screenshotPath}`);
            
            // Save HTML content
            const htmlPath = `${downloadDir}/${fileName}.html`;
            const htmlContent = await instance.evaluate(() => document.documentElement.outerHTML);
            await fwriter.writeFile(htmlPath, htmlContent, 'utf8');
            logger.info(`HTML content saved to: ${htmlPath}`);
            
        } catch (error) {
            logger.error('Error downloading doc content:', error);
        }
    }
    
    /**
     * Sanitize filename for safe file system usage
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     */
    sanitizeFileName(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }
}

module.exports = DocProcessorService; 