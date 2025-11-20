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

class EventUtils extends BaseUtils {
    constructor() {
        super();
    }

    async addEventListener(page, eventType, callback) {
        try {
            await page.exposeFunction('pageEventCallback', callback);
            await page.evaluate((eventType) => {
                document.addEventListener(eventType, (event) => {
                    window.pageEventCallback(event);
                });
            }, eventType);
            
            logger.debug(`Event listener added for: ${eventType}`);
            return true;
        } catch (error) {
            logger.error(`Failed to add event listener for ${eventType}:`, error);
            throw error;
        }
    }

    async removeAllListeners(page) {
        try {
            await page.evaluate(() => {
                const events = ['click', 'submit', 'change', 'input'];
                events.forEach(eventType => {
                    const elements = document.querySelectorAll('*');
                    elements.forEach(element => {
                        element.removeEventListener(eventType, () => {});
                    });
                });
            });
            
            logger.debug('All event listeners removed');
            return true;
        } catch (error) {
            logger.error('Failed to remove event listeners:', error);
            throw error;
        }
    }

    async handleDialog(page, accept = true, promptText = '') {
        try {
            page.on('dialog', async dialog => {
                if (accept) {
                    if (dialog.type() === 'prompt' && promptText) {
                        await dialog.accept(promptText);
                    } else {
                        await dialog.accept();
                    }
                } else {
                    await dialog.dismiss();
                }
            });
            
            logger.debug(`Dialog handler set: accept=${accept}`);
            return true;
        } catch (error) {
            logger.error('Failed to handle dialog:', error);
            throw error;
        }
    }

    async waitForDownload(page, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            const download = await page.waitForEvent('download', { timeout });
            logger.debug('Download started');
            return download;
        } catch (error) {
            logger.error('Download timeout:', error);
            throw error;
        }
    }

    async waitForPopup(page, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            const popup = await page.waitForEvent('popup', { timeout });
            logger.debug('Popup opened');
            return popup;
        } catch (error) {
            logger.error('Popup timeout:', error);
            throw error;
        }
    }

    async waitForDialog(page, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            const dialog = await page.waitForEvent('dialog', { timeout });
            logger.debug('Dialog opened');
            return dialog;
        } catch (error) {
            logger.error('Dialog timeout:', error);
            throw error;
        }
    }

    async waitForResponse(page, urlPattern, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            const response = await page.waitForResponse(response => 
                response.url().includes(urlPattern), { timeout }
            );
            logger.debug(`Response received for pattern: ${urlPattern}`);
            return response;
        } catch (error) {
            logger.error(`Response timeout for pattern: ${urlPattern}`, error);
            throw error;
        }
    }

    async waitForRequest(page, urlPattern, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            const request = await page.waitForRequest(request => 
                request.url().includes(urlPattern), { timeout }
            );
            logger.debug(`Request received for pattern: ${urlPattern}`);
            return request;
        } catch (error) {
            logger.error(`Request timeout for pattern: ${urlPattern}`, error);
            throw error;
        }
    }
}

module.exports = EventUtils;
