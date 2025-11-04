// ==UserScript==
// @name         DocumentOffline Iframe Crawler
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Capture iframe content recursively and send to local server
// @author       DocumentOffline
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const BASE_CONFIG = {
        SERVER_URL: 'http://127.0.0.1:8765',
        MAX_IFRAMES: Infinity,
        MAX_DEPTH: 5,
        DELAY: 1000,
        NAVIGATION_TIMEOUT: 10000,
        MAX_LINKS_PER_PAGE: Infinity,
        SAME_ORIGIN_ONLY: true,
        SKIP_HASH_LINKS: true,
        AUTO_START: false
    };

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeUrl(url, skipHash = true) {
        try {
            const parsed = new URL(url);
            if (skipHash) {
                parsed.hash = '';
            }
            return parsed.href;
        } catch (error) {
            return url;
        }
    }

    class ServerClient {
        constructor(config) {
            this.config = config;
        }

        log(message, type = 'info') {
            const prefix = '[DocumentOffline-Iframe]';
            const styles = {
                info: 'color: #2196F3',
                success: 'color: #4CAF50',
                warn: 'color: #FF9800',
                error: 'color: #F44336'
            };
            console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
        }

        async request(endpoint, payload) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${this.config.SERVER_URL}${endpoint}`,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify(payload || {}),
                    onload: (response) => {
                        try {
                            resolve(JSON.parse(response.responseText));
                        } catch (error) {
                            resolve({ success: true });
                        }
                    },
                    onerror: (error) => {
                        this.log(`Server error on ${endpoint}: ${error}`, 'error');
                        reject(error);
                    },
                    ontimeout: () => {
                        this.log(`Server timeout on ${endpoint}`, 'error');
                        reject(new Error('Timeout'));
                    },
                    timeout: 10000
                });
            });
        }

        async ping() {
            try {
                await this.request('/ping', {});
                return true;
            } catch (error) {
                return false;
            }
        }

        async sendPage(data) {
            return this.request('/page', data);
        }

        async sendComplete(data) {
            return this.request('/complete', data);
        }
    }

    class BrowserIframeCrawler {
        constructor(iframeElement, options) {
            this.iframeElement = iframeElement;
            this.config = options.config;
            this.iframeIndex = options.iframeIndex;
            this.iframeInfo = options.iframeInfo;
            this.serverClient = options.serverClient;
            this.sharedProcessedUrls = options.sharedProcessedUrls;
            this.sharedFailedUrls = options.sharedFailedUrls;
            this.onPageCaptured = options.onPageCaptured;
            this.onFailed = options.onFailed;
            this.onLinksDiscovered = options.onLinksDiscovered;

            this.results = [];
            this.pageLinkMap = {};
            this.navigationStack = [];
            this.startOrigin = null;
        }

        log(message, type = 'info') {
            const prefix = `[Iframe-${this.iframeIndex}]`;
            const styles = {
                info: 'color: #2196F3',
                success: 'color: #4CAF50',
                warn: 'color: #FF9800',
                error: 'color: #F44336'
            };
            console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
        }

        getFrameWindow() {
            try {
                return this.iframeElement?.contentWindow || null;
            } catch (error) {
                return null;
            }
        }

        getFrameDocument() {
            try {
                return this.iframeElement?.contentDocument || null;
            } catch (error) {
                return null;
            }
        }

        getCurrentUrl() {
            try {
                const frameWindow = this.getFrameWindow();
                return frameWindow ? frameWindow.location.href : null;
            } catch (error) {
                return null;
            }
        }

        isValidLink(url) {
            try {
                const parsed = new URL(url);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    return false;
                }
                if (this.config.SAME_ORIGIN_ONLY && parsed.origin !== this.startOrigin) {
                    return false;
                }
                return true;
            } catch (error) {
                return false;
            }
        }

        collectLinks(currentUrl) {
            const frameDocument = this.getFrameDocument();
            if (!frameDocument) {
                return [];
            }

            const anchors = Array.from(frameDocument.querySelectorAll('a[href]'));
            const links = anchors.map((anchor, index) => ({
                href: anchor.href,
                text: anchor.textContent.trim(),
                id: anchor.id || '',
                className: anchor.className || '',
                index
            }));

            const validLinks = links.filter(link => this.isValidLink(link.href));
            const normalizedLinks = validLinks.map(link => ({
                ...link,
                normalizedUrl: normalizeUrl(link.href, this.config.SKIP_HASH_LINKS)
            }));

            this.pageLinkMap[currentUrl] = normalizedLinks;
            if (this.onLinksDiscovered) {
                this.onLinksDiscovered(this.iframeIndex, currentUrl, normalizedLinks);
            }

            this.log(`Found ${normalizedLinks.length} valid links on ${currentUrl}`);
            return normalizedLinks;
        }

        async waitForNavigation(previousUrl, expectedUrl) {
            const timeout = this.config.NAVIGATION_TIMEOUT;
            const start = Date.now();
            const normalizedPrevious = previousUrl ? normalizeUrl(previousUrl, this.config.SKIP_HASH_LINKS) : null;
            const normalizedExpected = expectedUrl ? normalizeUrl(expectedUrl, this.config.SKIP_HASH_LINKS) : null;

            while (Date.now() - start < timeout) {
                const currentUrl = this.getCurrentUrl();
                if (!currentUrl) {
                    await delay(200);
                    continue;
                }

                const normalizedCurrent = normalizeUrl(currentUrl, this.config.SKIP_HASH_LINKS);

                if (normalizedExpected) {
                    if (normalizedCurrent === normalizedExpected) {
                        await this.waitForReadyState();
                        return true;
                    }
                } else if (!normalizedPrevious || normalizedCurrent !== normalizedPrevious) {
                    await this.waitForReadyState();
                    return true;
                }

                await delay(200);
            }

            return false;
        }

        async waitForReadyState() {
            const timeout = this.config.NAVIGATION_TIMEOUT;
            const start = Date.now();

            while (Date.now() - start < timeout) {
                const doc = this.getFrameDocument();
                if (!doc) {
                    await delay(100);
                    continue;
                }

                if (doc.readyState === 'complete' || doc.readyState === 'interactive') {
                    return true;
                }

                await delay(100);
            }

            return false;
        }

        async clickLink(link) {
            const frameDocument = this.getFrameDocument();
            if (!frameDocument) {
                return false;
            }

            const anchors = frameDocument.querySelectorAll('a[href]');
            if (link.index < 0 || link.index >= anchors.length) {
                return false;
            }

            const anchor = anchors[link.index];
            anchor.target = '_self';

            const event = frameDocument.createEvent('MouseEvents');
            event.initMouseEvent('click', true, true, this.getFrameWindow(), 0,
                0, 0, 0, 0, false, false, false, false, 0, null);
            anchor.dispatchEvent(event);

            return true;
        }

        async navigateBack(previousUrl) {
            const frameWindow = this.getFrameWindow();
            if (!frameWindow) {
                return false;
            }

            try {
                frameWindow.history.back();
            } catch (error) {
                this.log('Failed to navigate back: ' + error.message, 'warn');
                return false;
            }

            const success = await this.waitForNavigation(null, previousUrl);
            if (!success) {
                this.log('Back navigation timed out', 'warn');
            }
            await delay(this.config.DELAY);
            return success;
        }

        async capturePageContent(linkInfo, depth) {
            const doc = this.getFrameDocument();
            const frameWindow = this.getFrameWindow();
            if (!doc || !frameWindow) {
                return null;
            }

            const content = doc.documentElement.outerHTML;
            const currentUrl = frameWindow.location.href;
            const normalizedUrl = normalizeUrl(currentUrl, this.config.SKIP_HASH_LINKS);

            const pageData = {
                iframeIndex: this.iframeIndex,
                iframeInfo: this.iframeInfo,
                url: normalizedUrl,
                originalUrl: currentUrl,
                linkText: linkInfo?.text || '',
                linkHref: linkInfo?.href || currentUrl,
                depth,
                content,
                contentLength: content.length,
                timestamp: new Date().toISOString()
            };

            this.results.push(pageData);
            this.sharedProcessedUrls.add(normalizedUrl);

            if (this.onPageCaptured) {
                await this.onPageCaptured(pageData);
            }

            this.log(`Captured iframe content at depth ${depth}: ${pageData.url}`, 'success');
            return pageData;
        }

        async recursiveCrawl(depth = 0) {
            if (depth >= this.config.MAX_DEPTH) {
                this.log(`Max depth ${this.config.MAX_DEPTH} reached`, 'warn');
                return;
            }

            const currentUrl = this.getCurrentUrl();
            if (!currentUrl) {
                this.log('Cannot determine current URL for iframe', 'warn');
                return;
            }

            const normalizedCurrentUrl = normalizeUrl(currentUrl, this.config.SKIP_HASH_LINKS);
            if (this.sharedProcessedUrls.has(normalizedCurrentUrl)) {
                this.log(`Already processed ${normalizedCurrentUrl}, skipping`);
                return;
            }

            const links = this.collectLinks(normalizedCurrentUrl);
            const unprocessed = links.filter(link =>
                !this.sharedProcessedUrls.has(link.normalizedUrl) &&
                !this.sharedFailedUrls.has(link.normalizedUrl)
            );

            const linksToProcess = unprocessed.slice(0, this.config.MAX_LINKS_PER_PAGE);
            this.log(`${linksToProcess.length} links queued at depth ${depth}`);

            for (let i = 0; i < linksToProcess.length; i++) {
                const link = linksToProcess[i];

                const previousUrl = this.getCurrentUrl();
                const clicked = await this.clickLink(link);
                if (!clicked) {
                    this.log(`Failed to click link ${link.normalizedUrl}`, 'warn');
                    this.sharedFailedUrls.add(link.normalizedUrl);
                    if (this.onFailed) {
                        await this.onFailed({ ...link, error: 'Click failed', depth });
                    }
                    continue;
                }

                const navigated = await this.waitForNavigation(previousUrl);
                if (!navigated) {
                    this.log(`Navigation failed for ${link.normalizedUrl}`, 'warn');
                    this.sharedFailedUrls.add(link.normalizedUrl);
                    if (this.onFailed) {
                        await this.onFailed({ ...link, error: 'Navigation timeout or same URL', depth });
                    }
                    continue;
                }

                await delay(this.config.DELAY);

                await this.capturePageContent(link, depth + 1);

                this.navigationStack.push({ url: normalizedCurrentUrl, linkHref: link.href });
                await this.recursiveCrawl(depth + 1);
                this.navigationStack.pop();

                const wentBack = await this.navigateBack(normalizedCurrentUrl);
                if (!wentBack) {
                    this.log('Failed to navigate back, stopping crawl for this iframe', 'error');
                    break;
                }
            }
        }

        async start() {
            const initialUrl = this.getCurrentUrl();
            if (!initialUrl) {
                this.log('Cannot access iframe URL, skipping', 'error');
                return {
                    success: false,
                    error: 'Iframe not accessible'
                };
            }

            try {
                this.startOrigin = new URL(initialUrl).origin;
            } catch (error) {
                this.startOrigin = null;
            }

            await this.capturePageContent({ text: 'Initial Frame', href: initialUrl }, 0);
            await this.recursiveCrawl(0);

            return {
                success: true,
                iframeIndex: this.iframeIndex,
                iframeInfo: this.iframeInfo,
                results: this.results,
                pageLinkMap: this.pageLinkMap,
                processedCount: this.results.length,
                failedCount: this.sharedFailedUrls.size
            };
        }
    }

    class IframeCrawlerController {
        constructor(config) {
            this.config = { ...BASE_CONFIG, ...config };
            this.serverClient = new ServerClient(this.config);
            this.globalProcessedUrls = new Set();
            this.globalFailedUrls = new Set();
            this.pageLinkMap = {};
            this.results = [];
            this.isRunning = false;
        }

        log(message, type = 'info') {
            const prefix = '[DocumentOffline-Iframe]';
            const styles = {
                info: 'color: #2196F3',
                success: 'color: #4CAF50',
                warn: 'color: #FF9800',
                error: 'color: #F44336'
            };
            console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
        }

        getAccessibleIframes() {
            const nodes = Array.from(document.querySelectorAll('iframe'));
            const accessible = [];

            nodes.forEach((iframe, index) => {
                try {
                    const doc = iframe.contentDocument;
                    if (!doc) {
                        this.log(`Iframe ${index} not ready or cross-origin`, 'warn');
                        return;
                    }

                    const info = {
                        index,
                        src: iframe.src || '',
                        id: iframe.id || '',
                        name: iframe.name || '',
                        width: iframe.width || iframe.style.width || '',
                        height: iframe.height || iframe.style.height || ''
                    };

                    accessible.push({ element: iframe, info });
                } catch (error) {
                    this.log(`Cannot access iframe ${index}: ${error.message}`, 'warn');
                }
            });

            return accessible.slice(0, this.config.MAX_IFRAMES);
        }

        async onPageCaptured(pageData) {
            try {
                await this.serverClient.sendPage(pageData);
                this.log(`Sent iframe page to server: ${pageData.url}`, 'success');
            } catch (error) {
                this.log(`Failed to send page: ${error.message}`, 'error');
            }
        }

        async onFailedLink(info) {
            this.log(`Failed link: ${info.linkHref || info.href} (${info.error})`, 'warn');
        }

        onLinksDiscovered(iframeIndex, pageUrl, links) {
            if (!this.pageLinkMap[iframeIndex]) {
                this.pageLinkMap[iframeIndex] = {};
            }
            this.pageLinkMap[iframeIndex][pageUrl] = links;
        }

        async runIframeCrawler(iframe, position) {
            const crawler = new BrowserIframeCrawler(iframe.element, {
                config: this.config,
                iframeIndex: iframe.info.index,
                iframeInfo: iframe.info,
                serverClient: this.serverClient,
                sharedProcessedUrls: this.globalProcessedUrls,
                sharedFailedUrls: this.globalFailedUrls,
                onPageCaptured: (data) => this.onPageCaptured(data),
                onFailed: (info) => this.onFailedLink(info),
                onLinksDiscovered: (idx, url, links) => this.onLinksDiscovered(idx, url, links)
            });

            this.log(`Starting iframe ${position + 1}/${this.accessibleIframes.length}`, 'info');
            return crawler.start();
        }

        async start() {
            if (this.isRunning) {
                alert('Iframe crawler already running.');
                return;
            }

            const reachable = await this.serverClient.ping();
            if (!reachable) {
                alert('Cannot reach local server at ' + this.config.SERVER_URL);
                return;
            }

            this.isRunning = true;
            this.globalProcessedUrls.clear();
            this.globalFailedUrls.clear();
            this.pageLinkMap = {};
            this.results = [];

            this.accessibleIframes = this.getAccessibleIframes();
            if (!this.accessibleIframes.length) {
                alert('No accessible iframes detected on this page.');
                this.isRunning = false;
                return;
            }

            for (let i = 0; i < this.accessibleIframes.length; i++) {
                if (!this.isRunning) {
                    break;
                }

                try {
                    const result = await this.runIframeCrawler(this.accessibleIframes[i], i);
                    this.results.push(result);
                } catch (error) {
                    this.log(`Iframe crawl failed: ${error.message}`, 'error');
                }
            }

            await this.sendCompletion();
            this.isRunning = false;
            alert('Iframe crawl completed. Processed pages: ' + this.globalProcessedUrls.size);
        }

        stop() {
            this.isRunning = false;
            alert('Iframe crawler stopped.');
        }

        async sendCompletion() {
            try {
                await this.serverClient.sendComplete({
                    totalPages: this.globalProcessedUrls.size,
                    failedUrls: Array.from(this.globalFailedUrls),
                    pageLinkMap: this.pageLinkMap,
                    iframeResults: this.results
                });
                this.log('Sent completion payload to server', 'success');
            } catch (error) {
                this.log('Failed to send completion payload: ' + error.message, 'error');
            }
        }
    }

    let controller = null;

    function getController() {
        if (!controller) {
            controller = new IframeCrawlerController(BASE_CONFIG);
        }
        return controller;
    }

    GM_registerMenuCommand('Start Iframe Crawl', () => {
        const instance = getController();
        instance.start();
    });

    GM_registerMenuCommand('Stop Iframe Crawl', () => {
        const instance = getController();
        instance.stop();
    });

    GM_registerMenuCommand('Configure Iframe Crawl', () => {
        const instance = getController();
        const serverUrl = prompt('Server URL:', instance.config.SERVER_URL);
        if (serverUrl) {
            instance.config.SERVER_URL = serverUrl;
        }

        const maxDepth = prompt('Max depth:', instance.config.MAX_DEPTH);
        if (maxDepth) {
            instance.config.MAX_DEPTH = parseInt(maxDepth, 10) || instance.config.MAX_DEPTH;
        }

        const delayValue = prompt('Delay between operations (ms):', instance.config.DELAY);
        if (delayValue) {
            instance.config.DELAY = parseInt(delayValue, 10) || instance.config.DELAY;
        }

        const maxLinks = prompt('Max links per page:', instance.config.MAX_LINKS_PER_PAGE);
        if (maxLinks) {
            instance.config.MAX_LINKS_PER_PAGE = parseInt(maxLinks, 10) || instance.config.MAX_LINKS_PER_PAGE;
        }

        alert('Iframe crawler configuration updated.');
    });

    if (BASE_CONFIG.AUTO_START) {
        const instance = getController();
        instance.start();
    }

    console.log('%c[DocumentOffline-Iframe] Userscript loaded. Use Tampermonkey menu to start.', 'color: #4CAF50; font-weight: bold');
})();
