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
const globalVars = require('#@global_vars');
const IframeRecursiveCrawler = require('./IframeRecursiveCrawler');

class IframeUtils {
    constructor(page) {
        this.page = page;
    }

    async getAllIframes() {
        try {
            const iframes = await this.page.$$('iframe');
            logger.info(`Found ${iframes.length} iframes on page`);
            return iframes;
        } catch (error) {
            logger.error('Failed to get iframes:', error);
            throw error;
        }
    }

    async getIframeInfo(iframeElement) {
        try {
            const info = await this.page.evaluate((iframe) => {
                return {
                    src: iframe.src || '',
                    id: iframe.id || '',
                    name: iframe.name || '',
                    width: iframe.width || '',
                    height: iframe.height || '',
                    classList: Array.from(iframe.classList || [])
                };
            }, iframeElement);
            return info;
        } catch (error) {
            logger.error('Failed to get iframe info:', error);
            return null;
        }
    }

    async switchToIframe(iframeElement) {
        try {
            const frame = await iframeElement.contentFrame();
            if (!frame) {
                throw new Error('Cannot access iframe content frame');
            }
            logger.debug('Switched to iframe successfully');
            return frame;
        } catch (error) {
            logger.error('Failed to switch to iframe:', error);
            throw error;
        }
    }

    async getIframeContent(frame) {
        try {
            const content = await frame.content();
            logger.debug(`Got iframe content, length: ${content.length}`);
            return content;
        } catch (error) {
            logger.error('Failed to get iframe content:', error);
            throw error;
        }
    }

    async getIframeLinks(frame) {
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
            logger.info(`Found ${links.length} links in iframe`);
            return links;
        } catch (error) {
            logger.error('Failed to get iframe links:', error);
            throw error;
        }
    }

    async clickLinkByIndex(frame, linkIndex, options = {}) {
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
                logger.error(`Link index ${linkIndex} out of range`);
                return false;
            }

            if (options.waitForNavigation !== false) {
                const timeout = options.navigationTimeout || globalVars.PUPPETEER_NAVIGATION_TIMEOUT_MS;
                const timeoutMinutes = Math.round(timeout / 60000);
                logger.info(`Navigation will timeout after ${timeoutMinutes} minute(s) (${timeout}ms)`);

                await frame.waitForNavigation({
                    waitUntil: options.waitUntil || 'networkidle2',
                    timeout: timeout
                }).catch(() => {
                    logger.warn('Navigation timeout or no navigation occurred');
                });
            }

            if (options.delay) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }

            logger.debug(`Clicked link at index ${linkIndex} in iframe`);
            return true;
        } catch (error) {
            logger.error(`Failed to click link at index ${linkIndex} in iframe:`, error);
            return false;
        }
    }

    async processIframeLinks(frame, options = {}) {
        const results = [];
        const delay = options.delay || 1000;
        const maxLinks = options.maxLinks || Infinity;
        const processedUrls = new Set();
        const failedUrls = new Set();
        const onPageCallback = options.onPageCallback;
        const onFailedCallback = options.onFailedCallback;

        try {
            const links = await this.getIframeLinks(frame);
            const linksToProcess = links.slice(0, maxLinks);
            let previousUrl = await frame.evaluate(() => window.location.href);

            for (let i = 0; i < linksToProcess.length; i++) {
                const link = linksToProcess[i];
                logger.info(`Processing link ${i + 1}/${linksToProcess.length}: ${link.text || link.href}`);

                let targetUrl = link.href;
                try {
                    const parsedTarget = new URL(targetUrl);
                    parsedTarget.hash = '';
                    targetUrl = parsedTarget.href;
                } catch (error) {
                    logger.warn(`Could not parse target URL: ${targetUrl}`);
                }

                if (processedUrls.has(targetUrl)) {
                    logger.warn(`Skipping already processed URL: ${targetUrl}`);
                    continue;
                }

                if (failedUrls.has(targetUrl)) {
                    logger.warn(`Skipping previously failed URL: ${targetUrl}`);
                    continue;
                }

                try {
                    const navigationTimeout = globalVars.PUPPETEER_NAVIGATION_TIMEOUT_MS;
                    const timeoutMinutes = Math.round(navigationTimeout / 60000);
                    logger.info(`Navigation will timeout after ${timeoutMinutes} minute(s) (${navigationTimeout}ms)`);

                    const clicked = await this.clickLinkByIndex(frame, link.index, {
                        waitForNavigation: true,
                        waitUntil: 'networkidle2',
                        navigationTimeout: navigationTimeout,
                        delay: delay
                    });

                    if (clicked) {
                        await new Promise(resolve => setTimeout(resolve, delay));

                        const content = await this.getIframeContent(frame);
                        const currentUrl = await frame.evaluate(() => window.location.href);

                        let cleanUrl = currentUrl;
                        try {
                            const parsedUrl = new URL(currentUrl);
                            parsedUrl.hash = '';
                            cleanUrl = parsedUrl.href;
                        } catch (error) {
                            logger.warn(`Could not parse URL to remove hash: ${currentUrl}`);
                        }

                        if (cleanUrl === previousUrl) {
                            logger.warn(`Navigation failed for ${targetUrl} - URL did not change from ${previousUrl}`);
                            failedUrls.add(targetUrl);
                            const failedResult = {
                                linkText: link.text,
                                linkHref: link.href,
                                targetUrl: targetUrl,
                                success: false,
                                error: 'Navigation timeout or same URL'
                            };
                            results.push(failedResult);
                            if (onFailedCallback && typeof onFailedCallback === 'function') {
                                await onFailedCallback(failedResult, i, linksToProcess.length);
                            }
                            continue;
                        }

                        processedUrls.add(cleanUrl);
                        previousUrl = cleanUrl;

                        const result = {
                            linkText: link.text,
                            linkHref: link.href,
                            currentUrl: cleanUrl,
                            content: content,
                            contentLength: content.length,
                            success: true
                        };

                        results.push(result);

                        if (onPageCallback && typeof onPageCallback === 'function') {
                            await onPageCallback(result, i, linksToProcess.length);
                        }

                        logger.success(`Captured content from link ${i + 1}: ${link.text || link.href}`);
                    } else {
                        failedUrls.add(targetUrl);
                        const failedResult = {
                            linkText: link.text,
                            linkHref: link.href,
                            targetUrl: targetUrl,
                            success: false,
                            error: 'Click failed'
                        };
                        results.push(failedResult);
                        if (onFailedCallback && typeof onFailedCallback === 'function') {
                            await onFailedCallback(failedResult, i, linksToProcess.length);
                        }
                    }
                } catch (error) {
                    logger.error(`Error processing link ${i + 1}:`, error);
                    failedUrls.add(targetUrl);
                    const failedResult = {
                        linkText: link.text,
                        linkHref: link.href,
                        targetUrl: targetUrl,
                        success: false,
                        error: error.message
                    };
                    results.push(failedResult);
                    if (onFailedCallback && typeof onFailedCallback === 'function') {
                        await onFailedCallback(failedResult, i, linksToProcess.length);
                    }
                }
            }

            return results;
        } catch (error) {
            logger.error('Failed to process iframe links:', error);
            throw error;
        }
    }

    async getAllIframesWithContent(options = {}) {
        const results = [];

        try {
            const iframes = await this.getAllIframes();

            for (let i = 0; i < iframes.length; i++) {
                logger.info(`Processing iframe ${i + 1}/${iframes.length}`);

                try {
                    const info = await this.getIframeInfo(iframes[i]);
                    const frame = await this.switchToIframe(iframes[i]);

                    if (!frame) {
                        logger.warn(`Cannot access iframe ${i + 1}, skipping`);
                        continue;
                    }

                    const initialContent = await this.getIframeContent(frame);

                    const linkResults = await this.processIframeLinks(frame, {
                        delay: options.delay || 1000,
                        maxLinks: options.maxLinksPerIframe || Infinity,
                        onPageCallback: options.onPageCallback
                    });

                    results.push({
                        iframeIndex: i,
                        iframeInfo: info,
                        initialContent: initialContent,
                        linkResults: linkResults,
                        totalLinks: linkResults.length,
                        successfulLinks: linkResults.filter(r => r.success).length
                    });

                    logger.success(`Completed processing iframe ${i + 1}`);
                } catch (error) {
                    logger.error(`Error processing iframe ${i + 1}:`, error);
                    results.push({
                        iframeIndex: i,
                        error: error.message,
                        success: false
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Failed to get all iframes with content:', error);
            throw error;
        }
    }

    async extractIframeContentByIndex(iframeIndex, options = {}) {
        try {
            const iframes = await this.getAllIframes();

            if (iframeIndex >= iframes.length) {
                throw new Error(`Iframe index ${iframeIndex} out of range (total: ${iframes.length})`);
            }

            const iframe = iframes[iframeIndex];
            const info = await this.getIframeInfo(iframe);
            const frame = await this.switchToIframe(iframe);

            if (!frame) {
                throw new Error(`Cannot access iframe at index ${iframeIndex}`);
            }

            const initialContent = await this.getIframeContent(frame);
            const linkResults = await this.processIframeLinks(frame, options);

            return {
                iframeIndex,
                iframeInfo: info,
                initialContent,
                linkResults,
                totalLinks: linkResults.length,
                successfulLinks: linkResults.filter(r => r.success).length
            };
        } catch (error) {
            logger.error(`Failed to extract iframe content at index ${iframeIndex}:`, error);
            throw error;
        }
    }

    async recursiveCrawlIframeByIndex(iframeIndex, options = {}) {
        try {
            const iframes = await this.getAllIframes();

            if (iframeIndex >= iframes.length) {
                throw new Error(`Iframe index ${iframeIndex} out of range (total: ${iframes.length})`);
            }

            const iframe = iframes[iframeIndex];
            const info = await this.getIframeInfo(iframe);
            const frame = await this.switchToIframe(iframe);

            if (!frame) {
                throw new Error(`Cannot access iframe at index ${iframeIndex}`);
            }

            logger.info(`[IFRAME-RECURSIVE] Starting recursive crawl of iframe ${iframeIndex}`);

            const crawler = new IframeRecursiveCrawler(this.page, frame, {
                maxDepth: options.maxDepth || 10,
                delay: options.delay || 1000,
                maxLinksPerPage: options.maxLinksPerPage || Infinity,
                sameOriginOnly: options.sameOriginOnly !== false,
                skipHashLinks: options.skipHashLinks !== false,
                onPageCallback: options.onPageCallback,
                onFailedCallback: options.onFailedCallback
            });

            const crawlResult = await crawler.start();

            return {
                iframeIndex,
                iframeInfo: info,
                crawlResult,
                statistics: crawler.getStatistics()
            };
        } catch (error) {
            logger.error(`[IFRAME-RECURSIVE] Failed to recursively crawl iframe ${iframeIndex}:`, error);
            throw error;
        }
    }

    async recursiveCrawlAllIframes(options = {}) {
        const results = [];

        try {
            const iframes = await this.getAllIframes();
            logger.info(`[IFRAME-RECURSIVE] Found ${iframes.length} iframes to recursively crawl`);

            for (let i = 0; i < iframes.length; i++) {
                logger.info(`[IFRAME-RECURSIVE] Processing iframe ${i + 1}/${iframes.length}`);

                try {
                    const result = await this.recursiveCrawlIframeByIndex(i, options);
                    results.push(result);
                    logger.success(`[IFRAME-RECURSIVE] Completed iframe ${i + 1}`);
                } catch (error) {
                    logger.error(`[IFRAME-RECURSIVE] Error processing iframe ${i + 1}:`, error);
                    results.push({
                        iframeIndex: i,
                        error: error.message,
                        success: false
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('[IFRAME-RECURSIVE] Failed to recursively crawl all iframes:', error);
            throw error;
        }
    }
}

module.exports = IframeUtils;
