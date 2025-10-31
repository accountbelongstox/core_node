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
const gconfig = require('#@gconfig');
const { fdir } = require('#@ftools');
const path = require('path');
const fs = require('fs');

const {
    createSpiderEngine
} = require('#@puppeteer-v2');

let spiderEngine = null;
let session = null;
let currentPage = null;

class WebAutomationTools {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        logger.info('Initializing Web Automation Tools...');

        try {
            const downloadDirConfig = gconfig.downloadDirConfig || gconfig.DOWNLOADDIRCONFIG;
            const loggingConfig = gconfig.loggingConfig || gconfig.LOGGINGCONFIG;

            if (downloadDirConfig) {
                fdir.mkdirSync(downloadDirConfig.cacheDir);
                fdir.mkdirSync(downloadDirConfig.tempDir);
            }
            if (loggingConfig) {
                fdir.mkdirSync(loggingConfig.logDir);
            }

            spiderEngine = createSpiderEngine();
            await spiderEngine.initialize();

            session = await spiderEngine.createSession({
                browser: 'chrome',
                browserOptions: {
                    headless: false,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage'
                    ],
                    timeout: 60000,
                    ignoreHTTPSErrors: true
                }
            });

            this.initialized = true;
            logger.info('Web Automation Tools initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Web Automation Tools:', error.message);
            throw error;
        }
    }

    getTools() {
        return [
            {
                name: 'open_webpage',
                description: 'Open a webpage in the browser',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL to open'
                        },
                        waitUntil: {
                            type: 'string',
                            description: 'Wait until event (load, domcontentloaded, networkidle0, networkidle2)',
                            default: 'networkidle2'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'take_screenshot',
                description: 'Take a screenshot of the current page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filename: {
                            type: 'string',
                            description: 'The filename for the screenshot (optional, will generate if not provided)'
                        },
                        fullPage: {
                            type: 'boolean',
                            description: 'Whether to take a full page screenshot',
                            default: true
                        },
                        selector: {
                            type: 'string',
                            description: 'CSS selector to screenshot a specific element (optional)'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'get_html_content',
                description: 'Get the HTML content of the current page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        selector: {
                            type: 'string',
                            description: 'CSS selector to get HTML of a specific element (optional)'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'click_element',
                description: 'Click on an element on the page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        selector: {
                            type: 'string',
                            description: 'CSS selector of the element to click'
                        },
                        waitForNavigation: {
                            type: 'boolean',
                            description: 'Whether to wait for navigation after click',
                            default: false
                        }
                    },
                    required: ['selector']
                }
            },
            {
                name: 'type_text',
                description: 'Type text into an input element',
                inputSchema: {
                    type: 'object',
                    properties: {
                        selector: {
                            type: 'string',
                            description: 'CSS selector of the input element'
                        },
                        text: {
                            type: 'string',
                            description: 'Text to type'
                        },
                        delay: {
                            type: 'number',
                            description: 'Delay between keystrokes in milliseconds',
                            default: 0
                        }
                    },
                    required: ['selector', 'text']
                }
            },
            {
                name: 'download_resource',
                description: 'Download a resource from a URL',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the resource to download'
                        },
                        filename: {
                            type: 'string',
                            description: 'The filename to save as (optional)'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'evaluate_javascript',
                description: 'Execute JavaScript code on the page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'JavaScript code to execute'
                        }
                    },
                    required: ['code']
                }
            },
            {
                name: 'get_element_attribute',
                description: 'Get an attribute value from an element',
                inputSchema: {
                    type: 'object',
                    properties: {
                        selector: {
                            type: 'string',
                            description: 'CSS selector of the element'
                        },
                        attribute: {
                            type: 'string',
                            description: 'Attribute name to get'
                        }
                    },
                    required: ['selector', 'attribute']
                }
            },
            {
                name: 'wait_for_selector',
                description: 'Wait for an element to appear on the page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        selector: {
                            type: 'string',
                            description: 'CSS selector to wait for'
                        },
                        timeout: {
                            type: 'number',
                            description: 'Maximum time to wait in milliseconds',
                            default: 30000
                        }
                    },
                    required: ['selector']
                }
            },
            {
                name: 'close_browser',
                description: 'Close the browser session',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        ];
    }

    async executeTool(name, args) {
        if (!this.initialized) {
            throw new Error('Web Automation Tools not initialized');
        }

        switch (name) {
            case 'open_webpage':
                return await this.openWebpage(args);
            case 'take_screenshot':
                return await this.takeScreenshot(args);
            case 'get_html_content':
                return await this.getHtmlContent(args);
            case 'click_element':
                return await this.clickElement(args);
            case 'type_text':
                return await this.typeText(args);
            case 'download_resource':
                return await this.downloadResource(args);
            case 'evaluate_javascript':
                return await this.evaluateJavascript(args);
            case 'get_element_attribute':
                return await this.getElementAttribute(args);
            case 'wait_for_selector':
                return await this.waitForSelector(args);
            case 'close_browser':
                return await this.closeBrowser(args);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }

    async openWebpage(args) {
        const { url, waitUntil = 'networkidle2' } = args;

        try {
            if (!currentPage) {
                currentPage = await session.createPage();
            }

            await currentPage.goto(url, {
                waitUntil: waitUntil,
                timeout: 60000
            });

            const title = await currentPage.title();

            return {
                success: true,
                message: `Successfully opened ${url}`,
                title: title,
                url: currentPage.url()
            };
        } catch (error) {
            logger.error('Error opening webpage:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async takeScreenshot(args) {
        const { filename, fullPage = true, selector } = args;
        let screenshotPath;
        let screenshotBuffer;

        try {
            if (!currentPage) {
                throw new Error('No page is currently open. Please open a webpage first.');
            }

            const downloadDir = gconfig.downloadDirConfig?.cacheDir || './cache';
            fdir.mkdirSync(downloadDir);

            const timestamp = Date.now();
            const defaultFilename = `screenshot_${timestamp}.png`;
            screenshotPath = path.join(downloadDir, filename || defaultFilename);

            if (selector) {
                const element = await currentPage.$(selector);
                if (!element) {
                    throw new Error(`Element not found: ${selector}`);
                }
                screenshotBuffer = await element.screenshot();
            } else {
                screenshotBuffer = await currentPage.screenshot({
                    fullPage: fullPage
                });
            }

            fs.writeFileSync(screenshotPath, screenshotBuffer);

            return {
                success: true,
                message: 'Screenshot taken successfully',
                path: screenshotPath,
                size: screenshotBuffer.length
            };
        } catch (error) {
            logger.error('Error taking screenshot:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getHtmlContent(args) {
        const { selector } = args;

        try {
            if (!currentPage) {
                throw new Error('No page is currently open. Please open a webpage first.');
            }

            let html;
            if (selector) {
                html = await currentPage.$eval(selector, el => el.innerHTML);
            } else {
                html = await currentPage.content();
            }

            return {
                success: true,
                html: html,
                length: html.length
            };
        } catch (error) {
            logger.error('Error getting HTML content:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async clickElement(args) {
        const { selector, waitForNavigation = false } = args;

        try {
            if (!currentPage) {
                throw new Error('No page is currently open. Please open a webpage first.');
            }

            if (waitForNavigation) {
                await Promise.all([
                    currentPage.waitForNavigation({ timeout: 30000 }),
                    currentPage.click(selector)
                ]);
            } else {
                await currentPage.click(selector);
            }

            return {
                success: true,
                message: `Successfully clicked element: ${selector}`
            };
        } catch (error) {
            logger.error('Error clicking element:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async typeText(args) {
        const { selector, text, delay = 0 } = args;

        try {
            if (!currentPage) {
                throw new Error('No page is currently open. Please open a webpage first.');
            }

            await currentPage.type(selector, text, { delay: delay });

            return {
                success: true,
                message: `Successfully typed text into element: ${selector}`
            };
        } catch (error) {
            logger.error('Error typing text:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async downloadResource(args) {
        const { url, filename } = args;

        try {
            if (!currentPage) {
                currentPage = await session.createPage();
            }

            const downloadDir = gconfig.downloadDirConfig?.cacheDir || './cache';
            fdir.mkdirSync(downloadDir);

            const response = await currentPage.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            const buffer = await response.buffer();

            const defaultFilename = filename || path.basename(url) || `download_${Date.now()}`;
            const downloadPath = path.join(downloadDir, defaultFilename);

            fs.writeFileSync(downloadPath, buffer);

            return {
                success: true,
                message: 'Resource downloaded successfully',
                path: downloadPath,
                size: buffer.length
            };
        } catch (error) {
            logger.error('Error downloading resource:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async evaluateJavascript(args) {
        const { code } = args;

        try {
            if (!currentPage) {
                throw new Error('No page is currently open. Please open a webpage first.');
            }

            const result = await currentPage.evaluate(code);

            return {
                success: true,
                result: result
            };
        } catch (error) {
            logger.error('Error evaluating JavaScript:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getElementAttribute(args) {
        const { selector, attribute } = args;

        try {
            if (!currentPage) {
                throw new Error('No page is currently open. Please open a webpage first.');
            }

            const value = await currentPage.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);

            return {
                success: true,
                selector: selector,
                attribute: attribute,
                value: value
            };
        } catch (error) {
            logger.error('Error getting element attribute:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async waitForSelector(args) {
        const { selector, timeout = 30000 } = args;

        try {
            if (!currentPage) {
                throw new Error('No page is currently open. Please open a webpage first.');
            }

            await currentPage.waitForSelector(selector, { timeout: timeout });

            return {
                success: true,
                message: `Element found: ${selector}`
            };
        } catch (error) {
            logger.error('Error waiting for selector:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async closeBrowser(args) {
        try {
            if (currentPage) {
                await currentPage.close();
                currentPage = null;
            }

            return {
                success: true,
                message: 'Browser closed successfully'
            };
        } catch (error) {
            logger.error('Error closing browser:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async cleanup() {
        try {
            if (currentPage) {
                await currentPage.close();
                currentPage = null;
            }

            if (session && spiderEngine) {
                await spiderEngine.closeSession(session.id);
                session = null;
            }

            if (spiderEngine) {
                await spiderEngine.shutdown();
                spiderEngine = null;
            }

            this.initialized = false;
            logger.info('Web Automation Tools cleanup completed');
        } catch (error) {
            logger.error('Error during cleanup:', error.message);
        }
    }
}

module.exports = WebAutomationTools;
