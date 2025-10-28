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
const BaseUtils = require('../base/BaseUtils');

class BrowserControlUtils extends BaseUtils {
    constructor() {
        super();
    }

    async takeScreenshot(page, options = {}) {
        try {
            const screenshot = await page.screenshot(options);
            logger.debug('Screenshot taken successfully');
            return screenshot;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            throw error;
        }
    }

    async setUserAgent(page, userAgent) {
        try {
            await page.setUserAgent(userAgent);
            logger.debug(`User agent set: ${userAgent}`);
            return true;
        } catch (error) {
            logger.error('Failed to set user agent:', error);
            throw error;
        }
    }

    async setViewport(page, viewport) {
        try {
            await page.setViewport(viewport);
            logger.debug(`Viewport set: ${JSON.stringify(viewport)}`);
            return true;
        } catch (error) {
            logger.error('Failed to set viewport:', error);
            throw error;
        }
    }

    async clearCookies(page) {
        try {
            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            logger.debug('Cookies cleared');
            return true;
        } catch (error) {
            logger.error('Failed to clear cookies:', error);
            throw error;
        }
    }

    async clearCache(page) {
        try {
            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCache');
            logger.debug('Cache cleared');
            return true;
        } catch (error) {
            logger.error('Failed to clear cache:', error);
            throw error;
        }
    }

    async getCookies(page) {
        try {
            const cookies = await page.cookies();
            logger.debug(`Retrieved ${cookies.length} cookies`);
            return cookies;
        } catch (error) {
            logger.error('Failed to get cookies:', error);
            throw error;
        }
    }

    async setCookies(page, cookies) {
        try {
            await page.setCookie(...cookies);
            logger.debug(`Set ${cookies.length} cookies`);
            return true;
        } catch (error) {
            logger.error('Failed to set cookies:', error);
            throw error;
        }
    }

    async blockResources(page, resourceTypes = ['image', 'stylesheet', 'font']) {
        try {
            await page.setRequestInterception(true);
            
            page.on('request', request => {
                if (resourceTypes.includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
            
            logger.debug(`Blocked resources: ${resourceTypes.join(', ')}`);
            return true;
        } catch (error) {
            logger.error('Failed to block resources:', error);
            throw error;
        }
    }

    async injectScript(page, script, options = {}) {
        try {
            const result = await page.evaluate(script);
            logger.debug('Script injected successfully');
            return result;
        } catch (error) {
            logger.error('Failed to inject script:', error);
            throw error;
        }
    }
}

module.exports = BrowserControlUtils;
