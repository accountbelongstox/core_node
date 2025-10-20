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

const puppeteerSpiderManager = require('../core/main.js');
const logger = require('#@logger');
const fs = require('fs');
const path = require('path');

/**
 * Puppeteer Script Class
 * Handles JavaScript execution and data retrieval
 */
class PuppeteerScript {
    constructor() {
        this.defaultInstanceId = 0;
    }

    /**
     * Get Puppeteer instance by ID
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Puppeteer instance
     */
    getInstance(instanceId = this.defaultInstanceId) {
        return puppeteerSpiderManager.getPuppeteerSpiderInstance(instanceId);
    }

    /**
     * Execute JavaScript code
     * @param {string} script - JavaScript code to execute
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {any} Script execution result
     */
    async runScript(script, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available for script execution');
            }

            const result = await page.evaluate(script);
            logger.info('JavaScript executed successfully');
            return result;

        } catch (error) {
            logger.error(`Failed to execute script: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute JavaScript from local file
     * @param {string} filePath - Path to JavaScript file
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {any} Script execution result
     */
    async runScriptFile(filePath, instanceId = this.defaultInstanceId) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const script = fs.readFileSync(filePath, 'utf8');
            return await this.runScript(script, instanceId);

        } catch (error) {
            logger.error(`Failed to execute script file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute JavaScript from remote URL using script tag
     * @param {string} url - Remote JavaScript URL
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {any} Script execution result
     */
    async runScriptUrl(url, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available for script execution');
            }

            const scriptTag = `<script src="${url}"></script>`;
            await page.evaluate((tag) => {
                const script = document.createElement('script');
                script.src = tag.match(/src="([^"]+)"/)[1];
                document.head.appendChild(script);
            }, scriptTag);

            logger.info(`Remote script loaded from: ${url}`);
            return true;

        } catch (error) {
            logger.error(`Failed to execute remote script ${url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute JavaScript with different input types
     * @param {string} input - JavaScript code, file path, or remote URL
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {any} Script execution result
     */
    async run(input, instanceId = this.defaultInstanceId) {
        if (input.startsWith('http://') || input.startsWith('https://')) {
            return await this.runScriptUrl(input, instanceId);
        } else if (input.endsWith('.js') || input.includes('/') || input.includes('\\')) {
            return await this.runScriptFile(input, instanceId);
        } else {
            return await this.runScript(input, instanceId);
        }
    }

    /**
     * Execute JavaScript and wait for element to exist
     * @param {string} script - JavaScript code to execute
     * @param {string} selector - CSS selector to wait for
     * @param {number} instanceId - Instance ID (default: 0)
     * @param {Object} options - Wait options
     * @returns {any} Script execution result
     */
    async runScriptAndWait(script, selector, instanceId = this.defaultInstanceId, options = {}) {
        try {
            const result = await this.runScript(script, instanceId);
            await this.waitForElementWithTimer(selector, options, instanceId);
            return result;

        } catch (error) {
            logger.error(`Failed to execute script and wait: ${error.message}`);
            throw error;
        }
    }

    /**
     * Wait for element to appear using timer-based polling
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Element object
     */
    async waitForElementWithTimer(selector, options = {}, instanceId = this.defaultInstanceId) {
        const { timeout = 30000, interval = 100 } = options;

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = async () => {
                try {
                    const instance = this.getInstance(instanceId);
                    if (!instance) {
                        reject(new Error(`Puppeteer instance ${instanceId} not found`));
                        return;
                    }

                    const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
                    if (!page) {
                        reject(new Error('No page available'));
                        return;
                    }

                    const element = await page.$(selector);
                    if (element) {
                        resolve(element);
                        return;
                    }

                    if (Date.now() - startTime > timeout) {
                        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                        return;
                    }

                    setTimeout(checkElement, interval);
                } catch (error) {
                    reject(error);
                }
            };

            checkElement();
        });
    }

    /**
     * Get IndexedDB data
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {any} IndexedDB data
     */
    async getIndexedDBData(instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            const indexedDBData = await page.evaluate(() => {
                return new Promise((resolve) => {
                    const request = indexedDB.open();
                    request.onsuccess = () => {
                        const db = request.result;
                        const databases = [];
                        
                        for (const dbName of db.objectStoreNames) {
                            const transaction = db.transaction([dbName], 'readonly');
                            const store = transaction.objectStore(dbName);
                            const data = [];
                            
                            store.openCursor().onsuccess = (event) => {
                                const cursor = event.target.result;
                                if (cursor) {
                                    data.push(cursor.value);
                                    cursor.continue();
                                } else {
                                    databases.push({
                                        name: dbName,
                                        data: data
                                    });
                                    resolve(databases);
                                }
                            };
                        }
                    };
                });
            });

            logger.info('IndexedDB data retrieved successfully');
            return indexedDBData;

        } catch (error) {
            logger.error(`Failed to get IndexedDB data: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new PuppeteerScript(); 