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

class BrowserDetector {
    constructor() {
        this.detectedBrowsers = new Map();
    }
    
    // Detect all available browsers
    async detectAllBrowsers() {
        const browsers = {};
        
        try {
            // Detect Edge
            const edgeInfo = await this.detectEdge();
            if (edgeInfo) {
                browsers.edge = edgeInfo;
            }
            
            // Detect Chrome
            const chromeInfo = await this.detectChrome();
            if (chromeInfo) {
                browsers.chrome = chromeInfo;
            }
            
            logger.info(`Detected browsers: ${Object.keys(browsers).join(', ')}`);
            return browsers;
        } catch (error) {
            logger.error('Failed to detect browsers:', error.message);
            return {};
        }
    }
    
    // Detect Edge browser
    async detectEdge() {
        try {
            const EdgeFinder = require('./browsers/edge/finder');
            const finder = new EdgeFinder();
            const edgeInfo = finder.getEdgeInfo();
            
            if (edgeInfo && edgeInfo.executablePath) {
                this.detectedBrowsers.set('edge', edgeInfo);
                return edgeInfo;
            }
        } catch (error) {
            logger.debug('Edge detection failed:', error.message);
        }
        return null;
    }
    
    // Detect Chrome browser
    async detectChrome() {
        try {
            const ChromeFinder = require('./browsers/chrome/finder');
            const finder = new ChromeFinder();
            const chromeInfo = finder.getChromeInfo();
            
            if (chromeInfo && chromeInfo.executablePath) {
                this.detectedBrowsers.set('chrome', chromeInfo);
                return chromeInfo;
            }
        } catch (error) {
            logger.debug('Chrome detection failed:', error.message);
        }
        return null;
    }
    
    // Get browser info by type
    getBrowserInfo(browserType) {
        return this.detectedBrowsers.get(browserType);
    }
    
    // Get preferred browser (Edge first, then Chrome)
    async getPreferredBrowser() {
        const browsers = await this.detectAllBrowsers();
        
        if (browsers.edge) {
            return { type: 'edge', info: browsers.edge };
        } else if (browsers.chrome) {
            return { type: 'chrome', info: browsers.chrome };
        }
        
        throw new Error('No supported browser found');
    }
    
    // Check if browser is available
    async isBrowserAvailable(browserType) {
        const browsers = await this.detectAllBrowsers();
        return !!browsers[browserType];
    }
}

module.exports = BrowserDetector;
