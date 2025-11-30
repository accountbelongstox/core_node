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

class IframeRecursiveCrawler {
    constructor(page, frame, options = {}) {
        this.page = page;
        this.initialFrame = frame;
        this.maxDepth = options.maxDepth || 10;
        this.delay = options.delay || 1000;
        this.maxLinksPerPage = options.maxLinksPerPage || Infinity;
        this.sameOriginOnly = options.sameOriginOnly !== false;
        this.skipHashLinks = options.skipHashLinks !== false;
        this.onPageCallback = options.onPageCallback;
        this.onFailedCallback = options.onFailedCallback;

        this.globalProcessedUrls = new Set();
        this.globalFailedUrls = new Set();
        this.pageLinkMap = new Map();
        this.results = [];
        this.navigationStack = [];
        this.startOrigin = null;
    }

    async initialize() {
        try {
            const initialUrl = await this.initialFrame.evaluate(() => window.location.href);
            this.startOrigin = new URL(initialUrl).origin;
            logger.info(`[RECURSIVE-CRAWLER] Initialized with origin: ${this.startOrigin}`);
            logger.info(`[RECURSIVE-CRAWLER] Max depth: ${this.maxDepth}, Delay: ${this.delay}ms`);
            return true;
        } catch (error) {
            logger.error('[RECURSIVE-CRAWLER] Failed to initialize:', error);
            return false;
        }
    }

    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            if (this.skipHashLinks) {
                parsed.hash = '';
            }
            return parsed.href;
        } catch (error) {
            return url;
        }
    }

    isValidLink(url) {
        try {
            const parsed = new URL(url);

            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return false;
            }

            if (this.sameOriginOnly && parsed.origin !== this.startOrigin) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    async getPageLinks(frame, currentUrl) {
        try {
            const links = await frame.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                return anchors.map((a, index) => ({
                    href: a.href,
                    text: a.textContent.trim(),
                    id: a.id || '',
                    className: a.className || '',
                    index: index
                }));
            });

            const validLinks = links.filter(link => this.isValidLink(link.href));

            const normalizedLinks = validLinks.map(link => ({
                ...link,
                normalizedUrl: this.normalizeUrl(link.href)
            }));

            this.pageLinkMap.set(currentUrl, normalizedLinks);

            logger.info(`[RECURSIVE-CRAWLER] Found ${normalizedLinks.length} valid links on page: ${currentUrl}`);
            return normalizedLinks;
        } catch (error) {
            logger.error('[RECURSIVE-CRAWLER] Failed to get page links:', error);
            return [];
        }
    }

    async clickLinkByHref(frame, targetHref) {
        try {
            const clicked = await frame.evaluate((href) => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                const targetAnchor = anchors.find(a => a.href === href);
                if (targetAnchor) {
                    targetAnchor.click();
                    return true;
                }
                return false;
            }, targetHref);

            if (!clicked) {
                return false;
            }

            await frame.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 30000
            }).catch(() => {
                logger.warn('[RECURSIVE-CRAWLER] Navigation timeout or no navigation occurred');
            });

            if (this.delay) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }

            return true;
        } catch (error) {
            logger.error(`[RECURSIVE-CRAWLER] Failed to click link with href ${targetHref}:`, error);
            return false;
        }
    }

    async clickLinkByIndex(frame, linkIndex) {
        try {
            const clicked = await frame.evaluate((index) => {
                const anchors = document.querySelectorAll('a[href]');
                if (index >= 0 && index < anchors.length) {
                    anchors[index].click();
                    return true;
                }
                return false;
            }, linkIndex);

            if (!clicked) {
                return false;
            }

            await frame.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 30000
            }).catch(() => {
                logger.warn('[RECURSIVE-CRAWLER] Navigation timeout or no navigation occurred');
            });

            if (this.delay) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }

            return true;
        } catch (error) {
            logger.error(`[RECURSIVE-CRAWLER] Failed to click link at index ${linkIndex}:`, error);
            return false;
        }
    }

    async navigateBack(frame) {
        try {
            await frame.evaluate(() => window.history.back());

            await frame.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 30000
            }).catch(() => {
                logger.warn('[RECURSIVE-CRAWLER] Back navigation timeout');
            });

            if (this.delay) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }

            return true;
        } catch (error) {
            logger.error('[RECURSIVE-CRAWLER] Failed to navigate back:', error);
            return false;
        }
    }

    async capturePageContent(frame, url, linkInfo, depth) {
        try {
            const content = await frame.content();
            const currentUrl = await frame.evaluate(() => window.location.href);
            const normalizedUrl = this.normalizeUrl(currentUrl);

            const result = {
                url: normalizedUrl,
                originalUrl: currentUrl,
                linkText: linkInfo.text,
                linkHref: linkInfo.href,
                content: content,
                contentLength: content.length,
                depth: depth,
                success: true,
                timestamp: new Date().toISOString()
            };

            this.results.push(result);
            this.globalProcessedUrls.add(normalizedUrl);

            if (this.onPageCallback && typeof this.onPageCallback === 'function') {
                await this.onPageCallback(result, this.results.length, depth);
            }

            logger.success(`[RECURSIVE-CRAWLER] Captured page (depth ${depth}): ${linkInfo.text || normalizedUrl}`);
            return result;
        } catch (error) {
            logger.error('[RECURSIVE-CRAWLER] Failed to capture page content:', error);
            return null;
        }
    }

    async recursiveCrawl(frame, currentUrl, depth = 0) {
        if (depth >= this.maxDepth) {
            logger.warn(`[RECURSIVE-CRAWLER] Max depth ${this.maxDepth} reached at ${currentUrl}`);
            return;
        }

        const normalizedCurrentUrl = this.normalizeUrl(currentUrl);

        if (this.globalProcessedUrls.has(normalizedCurrentUrl)) {
            logger.info(`[RECURSIVE-CRAWLER] Skipping already processed URL: ${normalizedCurrentUrl}`);
            return;
        }

        logger.info(`[RECURSIVE-CRAWLER] Processing URL at depth ${depth}: ${currentUrl}`);

        const links = await this.getPageLinks(frame, normalizedCurrentUrl);

        const unprocessedLinks = links.filter(link =>
            !this.globalProcessedUrls.has(link.normalizedUrl) &&
            !this.globalFailedUrls.has(link.normalizedUrl)
        );

        logger.info(`[RECURSIVE-CRAWLER] ${unprocessedLinks.length} unprocessed links at depth ${depth}`);

        const linksToProcess = unprocessedLinks.slice(0, this.maxLinksPerPage);

        for (let i = 0; i < linksToProcess.length; i++) {
            const link = linksToProcess[i];

            if (this.globalProcessedUrls.has(link.normalizedUrl)) {
                logger.info(`[RECURSIVE-CRAWLER] Skipping already processed URL from global set: ${link.normalizedUrl}`);
                continue;
            }

            logger.info(`[RECURSIVE-CRAWLER] Clicking link ${i + 1}/${linksToProcess.length} at depth ${depth}: ${link.text || link.normalizedUrl}`);

            const previousUrl = await frame.evaluate(() => window.location.href);
            const clicked = await this.clickLinkByHref(frame, link.href);

            if (!clicked) {
                logger.warn(`[RECURSIVE-CRAWLER] Failed to click link: ${link.normalizedUrl}`);
                this.globalFailedUrls.add(link.normalizedUrl);

                if (this.onFailedCallback && typeof this.onFailedCallback === 'function') {
                    await this.onFailedCallback({
                        linkText: link.text,
                        linkHref: link.href,
                        targetUrl: link.normalizedUrl,
                        success: false,
                        error: 'Click failed',
                        depth: depth
                    });
                }
                continue;
            }

            await new Promise(resolve => setTimeout(resolve, this.delay));

            const newUrl = await frame.evaluate(() => window.location.href);
            const normalizedNewUrl = this.normalizeUrl(newUrl);

            if (normalizedNewUrl === this.normalizeUrl(previousUrl)) {
                logger.warn(`[RECURSIVE-CRAWLER] Navigation failed - URL did not change: ${link.normalizedUrl}`);
                this.globalFailedUrls.add(link.normalizedUrl);

                if (this.onFailedCallback && typeof this.onFailedCallback === 'function') {
                    await this.onFailedCallback({
                        linkText: link.text,
                        linkHref: link.href,
                        targetUrl: link.normalizedUrl,
                        success: false,
                        error: 'Navigation timeout or same URL',
                        depth: depth
                    });
                }
                continue;
            }

            if (this.globalProcessedUrls.has(normalizedNewUrl)) {
                logger.info(`[RECURSIVE-CRAWLER] Arrived at already processed URL: ${normalizedNewUrl}, going back`);
                await this.navigateBack(frame);
                continue;
            }

            await this.capturePageContent(frame, newUrl, link, depth + 1);

            this.navigationStack.push({
                url: normalizedCurrentUrl,
                linkHref: link.href
            });

            await this.recursiveCrawl(frame, newUrl, depth + 1);

            this.navigationStack.pop();

            logger.info(`[RECURSIVE-CRAWLER] Going back from depth ${depth + 1} to ${depth}`);
            await this.navigateBack(frame);

            await new Promise(resolve => setTimeout(resolve, this.delay));
        }
    }

    async start() {
        try {
            const initialized = await this.initialize();
            if (!initialized) {
                throw new Error('Failed to initialize crawler');
            }

            const initialUrl = await this.initialFrame.evaluate(() => window.location.href);
            const normalizedInitialUrl = this.normalizeUrl(initialUrl);

            logger.info(`[RECURSIVE-CRAWLER] Starting recursive crawl from: ${initialUrl}`);

            await this.capturePageContent(this.initialFrame, initialUrl, { text: 'Initial Page', href: initialUrl }, 0);

            await this.recursiveCrawl(this.initialFrame, initialUrl, 0);

            logger.success(`[RECURSIVE-CRAWLER] Crawl completed!`);
            logger.success(`[RECURSIVE-CRAWLER] Total pages processed: ${this.results.length}`);
            logger.success(`[RECURSIVE-CRAWLER] Total URLs in global set: ${this.globalProcessedUrls.size}`);
            logger.success(`[RECURSIVE-CRAWLER] Failed URLs: ${this.globalFailedUrls.size}`);

            return {
                results: this.results,
                totalProcessed: this.results.length,
                globalProcessedUrls: Array.from(this.globalProcessedUrls),
                failedUrls: Array.from(this.globalFailedUrls),
                pageLinkMap: Object.fromEntries(this.pageLinkMap),
                maxDepthReached: Math.max(...this.results.map(r => r.depth))
            };
        } catch (error) {
            logger.error('[RECURSIVE-CRAWLER] Crawl failed:', error);
            throw error;
        }
    }

    getResults() {
        return this.results;
    }

    getPageLinkMap() {
        return this.pageLinkMap;
    }

    getGlobalProcessedUrls() {
        return this.globalProcessedUrls;
    }

    getStatistics() {
        return {
            totalPages: this.results.length,
            totalProcessedUrls: this.globalProcessedUrls.size,
            totalFailedUrls: this.globalFailedUrls.size,
            totalPagesInMap: this.pageLinkMap.size,
            maxDepthReached: this.results.length > 0 ? Math.max(...this.results.map(r => r.depth)) : 0,
            averageLinksPerPage: this.pageLinkMap.size > 0
                ? Array.from(this.pageLinkMap.values()).reduce((sum, links) => sum + links.length, 0) / this.pageLinkMap.size
                : 0
        };
    }
}

module.exports = IframeRecursiveCrawler;
