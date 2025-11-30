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

/**
 * Document Controller - Manages document and site downloading functionality
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const logger = require('#@logger');
const UnifiedResourceProcessor = require('#@ncore/utils/web_offline/unified_resource_processor.js');
const DomainContext = require('#@ncore/utils/web_offline/domain_context.js');
const FileMapper = require('#@ncore/utils/web_offline/file_mapper.js');
const UrlQueue = require('#@apps/DocumentOffline/libs/url_queue.js');
const downloader = require('#@downloader');
const systemPaths = require('#@ncore/foundation/common/system_paths.js');
const PuppeteerModule = require('#@puppeteer');

class DocumentController extends EventEmitter {
    constructor() {
        super();

        this.name = 'document';
        this.isInitialized = false;
        this.activeDownloads = new Map();
    }

    /**
     * Get controller name
     * @returns {string}
     */
    getName() {
        return this.name;
    }

    /**
     * Initialize the controller
     * @param {Object} options - Initialization options
     * @returns {Promise<boolean>}
     */
    async initialize(options = {}) {
        if (this.isInitialized) {
            logger.warn('[DocumentController] Already initialized');
            return true;
        }

        logger.info('[DocumentController] Initializing...');

        this.isInitialized = true;
        logger.success('[DocumentController] Initialized successfully');
        this.emit('initialized', this.getStatus());

        return true;
    }

    /**
     * Get controller status
     * @returns {Object}
     */
    getStatus() {
        return {
            name: this.name,
            initialized: this.isInitialized,
            activeDownloads: this.activeDownloads.size,
            downloads: Array.from(this.activeDownloads.keys())
        };
    }

    /**
     * Download entire documentation site
     * @param {string} url - Target URL
     * @param {Object} options - Download options
     * @returns {Promise<Object>}
     */
    async downloadDocumentation(url, options = {}) {
        const sessionId = `doc_${Date.now()}`;
        let domainContext = null;
        let resourceProcessor = null;
        let fileMapper = null;
        let queue = null;
        let downloadDir = null;
        let fetcher = null;
        let downloadedUrls = [];
        let failedUrls = [];

        try {
            logger.info(`[DocumentController] Starting documentation download for: ${url}`);

            this.activeDownloads.set(sessionId, { url, type: 'documentation', status: 'starting' });
            this.emit('downloadStarted', { sessionId, url, type: 'documentation' });

            const depth = options.depth || 3;
            const autoConfirm = options.autoConfirm !== undefined ? options.autoConfirm : true;
            const disableJs = true;
            const removeHeadersFooters = options.removeHeadersFooters !== undefined ? options.removeHeadersFooters : true;
            const fetcherType = options.fetcherType || 'http';

            domainContext = new DomainContext(url);
            fileMapper = new FileMapper(new Set([
                '.html', '.htm', '.xhtml', '.xml', '.json', '.txt', '.csv',
                '.pdf', '.zip', '.gz', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.gif',
                '.svg', '.webp', '.ico'
            ]));
            resourceProcessor = new UnifiedResourceProcessor(
                domainContext,
                fileMapper,
                downloader,
                logger
            );
            queue = new UrlQueue();

            const parsed = new URL(domainContext.getOrigin());
            const hostDir = path.join(systemPaths.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);
            downloadDir = await this.prepareDownloadDirectory(hostDir);

            logger.info(`[DocumentController] Download directory: ${downloadDir}`);

            const canonicalTarget = domainContext.getStartUrl();
            queue.enqueue(canonicalTarget, 0);

            if (fetcherType === 'puppeteer') {
                fetcher = new PuppeteerModule.Fetcher();
                await fetcher.initialize('edge', { headless: true });
            } else {
                const PageFetcher = require('#@apps/DocumentOffline/services/page_fetcher.js');
                fetcher = new PageFetcher(fileMapper);
            }

            this.activeDownloads.set(sessionId, { url, type: 'documentation', status: 'downloading' });

            while (queue.hasPending()) {
                const item = queue.dequeue();
                if (!item) break;

                const { url: currentUrl, depth: currentDepth } = item;
                if (currentDepth > depth) continue;
                if (queue.hasProcessed(currentUrl)) continue;

                queue.markProcessed(currentUrl);
                logger.info(`[DocumentController] Processing depth ${currentDepth}: ${currentUrl}`);

                try {
                    const fetchResult = await fetcher.fetch(currentUrl);
                    let content = fetchResult.content;

                    if (!fetchResult.isBinary && this.isHtmlContent(currentUrl)) {
                        if (removeHeadersFooters) {
                            content = this.removeHeadersFooters(content);
                        }

                        if (disableJs) {
                            content = this.stripScriptTags(content);
                        }

                        const result = await resourceProcessor.processPageResources(content, currentUrl, downloadDir);
                        content = result.html;

                        const canonical = domainContext.canonicalize(currentUrl) || currentUrl;
                        const parsedUrl = new URL(canonical);
                        const relativePath = fileMapper.mapPath(parsedUrl);
                        const finalPath = path.join(downloadDir, relativePath);

                        const directory = path.dirname(finalPath);
                        this.ensureDirectory(directory);

                        await fs.promises.writeFile(finalPath, content, 'utf8');
                        logger.info(`[DocumentController] Saved: ${relativePath}`);

                        downloadedUrls.push(canonical);

                        if (currentDepth < depth) {
                            await this.analysePage(currentUrl, content, currentDepth, domainContext, queue);
                        }
                    }

                    await this.delay(100);
                } catch (error) {
                    logger.error(`[DocumentController] Failed to download ${currentUrl}: ${error.message}`);
                    failedUrls.push({
                        url: currentUrl,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            await this.generateSitemap(downloadDir, downloadedUrls, domainContext);

            if (failedUrls.length > 0) {
                await this.saveFailedUrlsReport(downloadDir, failedUrls);
            }

            logger.success(`[DocumentController] Documentation download completed. Downloaded: ${downloadedUrls.length}, Failed: ${failedUrls.length}`);

            const result = {
                success: true,
                sessionId: sessionId,
                localDirectory: downloadDir,
                structure: {
                    totalUrls: downloadedUrls.length,
                    failedUrls: failedUrls.length,
                    downloadedUrls: downloadedUrls
                }
            };

            this.activeDownloads.delete(sessionId);
            this.emit('downloadCompleted', { sessionId, result });

            if (fetcher && fetcher.cleanup) {
                await fetcher.cleanup();
            }

            return result;
        } catch (error) {
            logger.error(`[DocumentController] Documentation download failed: ${error.message}`);

            if (fetcher && fetcher.cleanup) {
                await fetcher.cleanup();
            }

            this.activeDownloads.delete(sessionId);
            this.emit('downloadFailed', { sessionId, error });

            return {
                success: false,
                sessionId: sessionId,
                error: error.message,
                localDirectory: downloadDir,
                structure: {
                    totalUrls: downloadedUrls.length,
                    failedUrls: failedUrls.length,
                    downloadedUrls: downloadedUrls
                }
            };
        }
    }

    /**
     * Download entire website with all resources
     * @param {string} url - Target URL
     * @param {Object} options - Download options
     * @returns {Promise<Object>}
     */
    async downloadSite(url, options = {}) {
        const sessionId = `site_${Date.now()}`;
        let domainContext = null;
        let resourceProcessor = null;
        let fileMapper = null;
        let queue = null;
        let downloadDir = null;
        let fetcher = null;
        let downloadedUrls = [];
        let failedUrls = [];

        try {
            logger.info(`[DocumentController] Starting full site download for: ${url}`);

            this.activeDownloads.set(sessionId, { url, type: 'site', status: 'starting' });
            this.emit('downloadStarted', { sessionId, url, type: 'site' });

            const depth = options.depth || 3;
            const autoConfirm = options.autoConfirm !== undefined ? options.autoConfirm : true;
            const disableJs = options.disableJs !== undefined ? options.disableJs : false;
            const fetcherType = options.fetcherType || 'http';

            domainContext = new DomainContext(url);
            fileMapper = new FileMapper(new Set([
                '.html', '.htm', '.xhtml', '.xml', '.json', '.txt', '.csv',
                '.pdf', '.zip', '.gz', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.gif',
                '.svg', '.webp', '.ico', '.css', '.js', '.mp3', '.mp4', '.avi', '.mov', '.m4v', '.webm',
                '.woff', '.woff2', '.ttf', '.otf', '.eot'
            ]));
            resourceProcessor = new UnifiedResourceProcessor(
                domainContext,
                fileMapper,
                downloader,
                logger
            );
            queue = new UrlQueue();

            const parsed = new URL(domainContext.getOrigin());
            const hostDir = path.join(systemPaths.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);
            downloadDir = await this.prepareDownloadDirectory(hostDir);

            logger.info(`[DocumentController] Download directory: ${downloadDir}`);

            const canonicalTarget = domainContext.getStartUrl();
            queue.enqueue(canonicalTarget, 0);

            if (fetcherType === 'puppeteer') {
                fetcher = new PuppeteerModule.Fetcher();
                await fetcher.initialize('edge', { headless: true });
            } else {
                const PageFetcher = require('#@apps/DocumentOffline/services/page_fetcher.js');
                fetcher = new PageFetcher(fileMapper);
            }

            this.activeDownloads.set(sessionId, { url, type: 'site', status: 'downloading' });

            while (queue.hasPending()) {
                const item = queue.dequeue();
                if (!item) break;

                const { url: currentUrl, depth: currentDepth } = item;
                if (currentDepth > depth) continue;
                if (queue.hasProcessed(currentUrl)) continue;

                queue.markProcessed(currentUrl);
                logger.info(`[DocumentController] Processing depth ${currentDepth}: ${currentUrl}`);

                try {
                    const fetchResult = await fetcher.fetch(currentUrl);
                    let content = fetchResult.content;

                    if (!fetchResult.isBinary && this.isHtmlContent(currentUrl)) {
                        if (disableJs) {
                            content = this.stripScriptTags(content);
                        }

                        const result = await resourceProcessor.processPageResources(content, currentUrl, downloadDir);
                        content = result.html;

                        const canonical = domainContext.canonicalize(currentUrl) || currentUrl;
                        const parsedUrl = new URL(canonical);
                        const relativePath = fileMapper.mapPath(parsedUrl);
                        const finalPath = path.join(downloadDir, relativePath);

                        const directory = path.dirname(finalPath);
                        this.ensureDirectory(directory);

                        await fs.promises.writeFile(finalPath, content, 'utf8');
                        logger.info(`[DocumentController] Saved: ${relativePath}`);

                        downloadedUrls.push(canonical);

                        if (currentDepth < depth) {
                            await this.analysePage(currentUrl, content, currentDepth, domainContext, queue);
                        }
                    } else if (fetchResult.isBinary) {
                        const canonical = domainContext.canonicalize(currentUrl) || currentUrl;
                        const parsedUrl = new URL(canonical);
                        const relativePath = fileMapper.mapPath(parsedUrl);
                        const finalPath = path.join(downloadDir, relativePath);

                        const directory = path.dirname(finalPath);
                        this.ensureDirectory(directory);

                        await fs.promises.writeFile(finalPath, content);
                        logger.info(`[DocumentController] Saved binary: ${relativePath}`);

                        downloadedUrls.push(canonical);
                    }

                    await this.delay(100);
                } catch (error) {
                    logger.error(`[DocumentController] Failed to download ${currentUrl}: ${error.message}`);
                    failedUrls.push({
                        url: currentUrl,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            await this.generateSitemap(downloadDir, downloadedUrls, domainContext);

            if (failedUrls.length > 0) {
                await this.saveFailedUrlsReport(downloadDir, failedUrls);
            }

            logger.success(`[DocumentController] Site download completed. Downloaded: ${downloadedUrls.length}, Failed: ${failedUrls.length}`);

            const result = {
                success: true,
                sessionId: sessionId,
                localDirectory: downloadDir,
                structure: {
                    totalUrls: downloadedUrls.length,
                    failedUrls: failedUrls.length,
                    downloadedUrls: downloadedUrls
                }
            };

            this.activeDownloads.delete(sessionId);
            this.emit('downloadCompleted', { sessionId, result });

            if (fetcher && fetcher.cleanup) {
                await fetcher.cleanup();
            }

            return result;
        } catch (error) {
            logger.error(`[DocumentController] Site download failed: ${error.message}`);

            if (fetcher && fetcher.cleanup) {
                await fetcher.cleanup();
            }

            this.activeDownloads.delete(sessionId);
            this.emit('downloadFailed', { sessionId, error });

            return {
                success: false,
                sessionId: sessionId,
                error: error.message,
                localDirectory: downloadDir,
                structure: {
                    totalUrls: downloadedUrls.length,
                    failedUrls: failedUrls.length,
                    downloadedUrls: downloadedUrls
                }
            };
        }
    }

    /**
     * Remove headers and footers from HTML using cheerio
     * @param {string} html - HTML content
     * @returns {string}
     */
    removeHeadersFooters(html) {
        try {
            const $ = cheerio.load(html, { decodeEntities: false });

            $('header').remove();
            $('footer').remove();
            $('nav').remove();
            $('.header').remove();
            $('.footer').remove();
            $('.navigation').remove();
            $('.navbar').remove();
            $('.menu').remove();
            $('.sidebar').remove();
            $('.advertisement').remove();
            $('.ad').remove();
            $('.ads').remove();

            return $.html();
        } catch (error) {
            logger.warn(`[DocumentController] Failed to remove headers/footers: ${error.message}`);
            return html;
        }
    }

    /**
     * Strip script tags from HTML
     * @param {string} html - HTML content
     * @returns {string}
     */
    stripScriptTags(html) {
        try {
            const $ = cheerio.load(html, { decodeEntities: false });
            $('script').remove();
            return $.html();
        } catch (error) {
            logger.warn(`[DocumentController] Failed to strip script tags: ${error.message}`);
            return html;
        }
    }

    /**
     * Analyze page and extract links
     * @param {string} baseUrl - Base URL
     * @param {string} htmlContent - HTML content
     * @param {number} currentDepth - Current depth
     * @param {Object} domainContext - Domain context
     * @param {Object} queue - URL queue
     * @returns {Promise<void>}
     */
    async analysePage(baseUrl, htmlContent, currentDepth, domainContext, queue) {
        try {
            const HtmlParse = require('#@ncore/utils/htmltool/libs/htmlparse.js');
            const parser = new HtmlParse(htmlContent, baseUrl);
            const rawAnchors = parser.getAllAnchorHrefs(true);
            const uniqueAnchors = Array.from(new Set(rawAnchors));

            let internalCount = 0;

            for (const link of uniqueAnchors) {
                const resolved = domainContext.resolveHref(baseUrl, link);
                if (!resolved) {
                    continue;
                }

                if (resolved.canonical && domainContext.isInternalLink(resolved.url)) {
                    internalCount++;
                    queue.enqueue(resolved.canonical, currentDepth + 1);
                }
            }

            logger.info(`[DocumentController] Links discovered: total=${uniqueAnchors.length}, internal=${internalCount}`);
        } catch (error) {
            logger.warn(`[DocumentController] Failed to analyze page: ${error.message}`);
        }
    }

    /**
     * Generate sitemap
     * @param {string} hostDir - Host directory
     * @param {Array} downloadedUrls - Downloaded URLs
     * @param {Object} domainContext - Domain context
     * @returns {Promise<void>}
     */
    async generateSitemap(hostDir, downloadedUrls, domainContext) {
        try {
            const SitemapGenerator = require('#@apps/DocumentOffline/services/sitemap_generator.js');
            const sitemapGenerator = new SitemapGenerator();

            for (const url of downloadedUrls) {
                sitemapGenerator.addUrl(url);
            }

            const sitemapPath = path.join(hostDir, 'sitemap.xml');
            await sitemapGenerator.save(sitemapPath);

            logger.success(`[DocumentController] Sitemap generated: ${sitemapPath}`);
        } catch (error) {
            logger.warn(`[DocumentController] Failed to generate sitemap: ${error.message}`);
        }
    }

    /**
     * Save failed URLs report
     * @param {string} hostDir - Host directory
     * @param {Array} failedUrls - Failed URLs
     * @returns {Promise<void>}
     */
    async saveFailedUrlsReport(hostDir, failedUrls) {
        try {
            const failedReportPath = path.join(hostDir, 'failed_urls.json');
            const failedReport = {
                timestamp: new Date().toISOString(),
                totalFailed: failedUrls.length,
                failedUrls: failedUrls
            };

            await fs.promises.writeFile(failedReportPath, JSON.stringify(failedReport, null, 2), 'utf8');
            logger.warn(`[DocumentController] Failed URLs report saved: ${failedReportPath}`);
        } catch (error) {
            logger.error(`[DocumentController] Failed to save failed URLs report: ${error.message}`);
        }
    }

    /**
     * Prepare download directory
     * @param {string} baseHostDir - Base host directory
     * @returns {Promise<string>}
     */
    async prepareDownloadDirectory(baseHostDir) {
        const parentDir = path.dirname(baseHostDir);
        const dirName = path.basename(baseHostDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').substring(0, 19);

        if (!fs.existsSync(baseHostDir)) {
            logger.info(`[DocumentController] Creating new download directory: ${dirName}`);
            return baseHostDir;
        }

        const stats = fs.statSync(baseHostDir);
        if (!stats.isDirectory()) {
            logger.warn(`[DocumentController] Path exists but is not a directory, creating timestamped directory`);
            const newDirName = `${dirName}_${timestamp}`;
            return path.join(parentDir, newDirName);
        }

        const files = fs.readdirSync(baseHostDir);
        if (files.length === 0) {
            logger.info(`[DocumentController] Directory exists but is empty, reusing: ${dirName}`);
            return baseHostDir;
        }

        const newDirName = `${dirName}_${timestamp}`;
        const newHostDir = path.join(parentDir, newDirName);

        logger.info(`[DocumentController] Creating new directory with timestamp: ${newDirName}`);

        return newHostDir;
    }

    /**
     * Ensure directory exists
     * @param {string} directory - Directory path
     */
    ensureDirectory(directory) {
        if (fs.existsSync(directory)) {
            const stats = fs.lstatSync(directory);
            if (stats.isDirectory()) {
                return;
            }
            fs.unlinkSync(directory);
        }
        fs.mkdirSync(directory, { recursive: true });
    }

    /**
     * Check if content is HTML
     * @param {string} filePath - File path
     * @returns {boolean}
     */
    isHtmlContent(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return ['.html', '.htm', '.xhtml'].includes(ext);
    }

    /**
     * Delay execution
     * @param {number} ms - Milliseconds
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const documentController = new DocumentController();

module.exports = {
    DocumentController,
    documentController
};
