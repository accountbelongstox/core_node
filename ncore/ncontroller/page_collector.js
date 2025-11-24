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

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logger = require('#@logger');
const systemPaths = require('#@ncore/foundation/common/system_paths.js');

const SCREENSHOTS_DIR = path.join(systemPaths.getSystemCacheDir(), 'screenshots');
const DOWNLOADS_DIR = path.join(systemPaths.getSystemCacheDir(), 'downloads');
const RESOURCES_DIR = path.join(systemPaths.getSystemCacheDir(), 'resources');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
}

class PageCollector {
    constructor() {
        this.consoleLogs = new Map();
        this.pageResources = new Map();
    }

    /**
     * Setup page collectors
     * @param {Object} page - Puppeteer page
     * @param {string} pageId - Page identifier
     */
    setupPageCollectors(page, pageId) {
        if (!this.consoleLogs.has(pageId)) {
            this.consoleLogs.set(pageId, []);
        }

        if (!this.pageResources.has(pageId)) {
            this.pageResources.set(pageId, []);
        }

        page.on('console', (msg) => {
            const logs = this.consoleLogs.get(pageId) || [];
            logs.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: Date.now()
            });
            this.consoleLogs.set(pageId, logs);
        });

        page.on('response', async (response) => {
            const url = response.url();
            const resourceType = response.request().resourceType();

            if (['stylesheet', 'script', 'image', 'font'].includes(resourceType)) {
                const resources = this.pageResources.get(pageId) || [];
                resources.push({
                    url: url,
                    type: resourceType,
                    status: response.status(),
                    timestamp: Date.now()
                });
                this.pageResources.set(pageId, resources);
            }
        });

        logger.info(`[PageCollector] Setup collectors for page: ${pageId}`);
    }

    /**
     * Get console logs for page
     * @param {string} pageId - Page identifier
     * @returns {Array}
     */
    getConsoleLogs(pageId) {
        return this.consoleLogs.get(pageId) || [];
    }

    /**
     * Get resources for page
     * @param {string} pageId - Page identifier
     * @returns {Array}
     */
    getPageResources(pageId) {
        return this.pageResources.get(pageId) || [];
    }

    /**
     * Clear logs for page
     * @param {string} pageId - Page identifier
     */
    clearPageData(pageId) {
        this.consoleLogs.delete(pageId);
        this.pageResources.delete(pageId);
    }

    /**
     * Take screenshot
     * @param {Object} page - Puppeteer page
     * @param {Object} options - Screenshot options
     * @returns {Promise<string>}
     */
    async takeScreenshot(page, options = {}) {
        const timestamp = Date.now();
        const hash = crypto.randomBytes(8).toString('hex');
        const filename = `screenshot_${timestamp}_${hash}.png`;
        const filepath = path.join(SCREENSHOTS_DIR, filename);

        await page.screenshot({
            path: filepath,
            fullPage: options.fullPage !== false,
            ...options
        });

        logger.info(`[PageCollector] Screenshot saved: ${filepath}`);

        return filepath;
    }

    /**
     * Get HTML content
     * @param {Object} page - Puppeteer page
     * @returns {Promise<string>}
     */
    async getHtmlContent(page) {
        return await page.content();
    }

    /**
     * Download page resources
     * @param {Object} page - Puppeteer page
     * @param {Array} resourceTypes - Resource types to download
     * @returns {Promise<Object>}
     */
    async downloadPageResources(page, resourceTypes = ['stylesheet', 'script']) {
        const pageUrl = page.url();
        const urlHash = crypto.createHash('md5').update(pageUrl).digest('hex');
        const pageResourceDir = path.join(RESOURCES_DIR, urlHash);

        if (!fs.existsSync(pageResourceDir)) {
            fs.mkdirSync(pageResourceDir, { recursive: true });
        }

        const downloadedResources = {
            stylesheets: [],
            scripts: [],
            images: [],
            fonts: []
        };

        const cdpClient = await page.target().createCDPSession();
        await cdpClient.send('Network.enable');

        const resources = await cdpClient.send('Page.getResourceTree');
        const frameResources = resources.frameTree.resources || [];

        for (const resource of frameResources) {
            const resourceType = resource.type.toLowerCase();

            if (resourceTypes.includes(resourceType)) {
                try {
                    const content = await cdpClient.send('Page.getResourceContent', {
                        frameId: resources.frameTree.frame.id,
                        url: resource.url
                    });

                    const resourceHash = crypto.createHash('md5').update(resource.url).digest('hex');
                    const ext = this.getResourceExtension(resourceType, resource.url);
                    const filename = `${resourceType}_${resourceHash}${ext}`;
                    const filepath = path.join(pageResourceDir, filename);

                    const contentData = content.base64Encoded
                        ? Buffer.from(content.content, 'base64')
                        : content.content;

                    fs.writeFileSync(filepath, contentData);

                    const resourceInfo = {
                        url: resource.url,
                        type: resourceType,
                        path: filepath,
                        filename: filename
                    };

                    if (resourceType === 'stylesheet') {
                        downloadedResources.stylesheets.push(resourceInfo);
                    } else if (resourceType === 'script') {
                        downloadedResources.scripts.push(resourceInfo);
                    } else if (resourceType === 'image') {
                        downloadedResources.images.push(resourceInfo);
                    } else if (resourceType === 'font') {
                        downloadedResources.fonts.push(resourceInfo);
                    }

                    logger.info(`[PageCollector] Downloaded resource: ${filename}`);
                } catch (error) {
                    logger.warn(`[PageCollector] Failed to download resource ${resource.url}:`, error.message);
                }
            }
        }

        await cdpClient.detach();

        return {
            directory: pageResourceDir,
            resources: downloadedResources,
            total: Object.values(downloadedResources).reduce((sum, arr) => sum + arr.length, 0)
        };
    }

    /**
     * Get resource extension
     * @param {string} type - Resource type
     * @param {string} url - Resource URL
     * @returns {string}
     */
    getResourceExtension(type, url) {
        const urlPath = new URL(url).pathname;
        const ext = path.extname(urlPath);

        if (ext) {
            return ext;
        }

        const typeMap = {
            'stylesheet': '.css',
            'script': '.js',
            'image': '.png',
            'font': '.woff2'
        };

        return typeMap[type] || '';
    }

    /**
     * Collect all page data
     * @param {Object} page - Puppeteer page
     * @param {string} pageId - Page identifier
     * @param {Object} options - Collection options
     * @returns {Promise<Object>}
     */
    async collectPageData(page, pageId, options = {}) {
        const result = {
            url: page.url(),
            title: await page.title(),
            timestamp: Date.now()
        };

        if (options.screenshot !== false) {
            result.screenshot = await this.takeScreenshot(page, options.screenshotOptions);
        }

        if (options.consoleLogs !== false) {
            result.consoleLogs = this.getConsoleLogs(pageId);
        }

        if (options.htmlContent) {
            result.htmlContent = await this.getHtmlContent(page);
        }

        if (options.resources) {
            const resourceTypes = Array.isArray(options.resources)
                ? options.resources
                : ['stylesheet', 'script'];
            result.downloadedResources = await this.downloadPageResources(page, resourceTypes);
        }

        return result;
    }
}

const pageCollector = new PageCollector();

module.exports = {
    PageCollector,
    pageCollector
};
