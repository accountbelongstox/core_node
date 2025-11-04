// ==UserScript==
// @name         DocumentOffline Crawler
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Capture full pages and iframe regions, send HTML to local DocumentOffline server
// @author       DocumentOffline
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        SERVER_URL: 'http://127.0.0.1:8765',
        MAX_DEPTH: 10,
        DELAY: 1000,
        MAX_LINKS_PER_PAGE: Infinity,
        SAME_ORIGIN_ONLY: true,
        SKIP_HASH_LINKS: true,
        AUTO_START: false,
        MAX_IFRAMES: Infinity,
        MAX_IFRAME_DEPTH: 5,
        MAX_IFRAME_LINKS_PER_PAGE: Infinity,
        IFRAME_NAVIGATION_TIMEOUT: 10000
    };

    const PANEL_ID = 'documentoffline-panel';
    const PANEL_STYLE_ID = 'documentoffline-panel-style';

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeUrlValue(url, skipHash = true) {
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

    function sendServerRequest(serverUrl, endpoint, data, logFn) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${serverUrl}${endpoint}`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(data),
                onload: (response) => {
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch (error) {
                        resolve({ success: true });
                    }
                },
                onerror: (error) => {
                    if (typeof logFn === 'function') {
                        logFn(`Server connection error: ${error}`, 'error');
                    }
                    reject(error);
                },
                ontimeout: () => {
                    if (typeof logFn === 'function') {
                        logFn('Server request timeout', 'error');
                    }
                    reject(new Error('Timeout'));
                },
                timeout: 10000
            });
        });
    }

    class RecursiveCrawler {
        constructor(config) {
            this.config = { ...CONFIG, ...config };
            this.globalProcessedUrls = new Set();
            this.globalFailedUrls = new Set();
            this.pageLinkMap = {};
            this.results = [];
            this.navigationStack = [];
            this.startOrigin = null;
            this.isRunning = false;
            this.isPaused = false;
        }

        log(message, type = 'info') {
            const prefix = '[DocumentOffline-Crawler]';
            const styles = {
                info: 'color: #2196F3',
                success: 'color: #4CAF50',
                warn: 'color: #FF9800',
                error: 'color: #F44336'
            };
            console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
        }

        async sendToServer(endpoint, data) {
            return sendServerRequest(this.config.SERVER_URL, endpoint, data, (msg, type) => this.log(msg, type));
        }

        async pingServer() {
            try {
                await this.sendToServer('/ping', {});
                return true;
            } catch (error) {
                return false;
            }
        }

        normalizeUrl(url) {
            return normalizeUrlValue(url, this.config.SKIP_HASH_LINKS);
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

        getPageLinks() {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            const links = anchors.map((a, index) => ({
                href: a.href,
                text: a.textContent.trim(),
                id: a.id || '',
                className: a.className || '',
                index
            }));
            const validLinks = links.filter(link => this.isValidLink(link.href));
            return validLinks.map(link => ({
                ...link,
                normalizedUrl: this.normalizeUrl(link.href)
            }));
        }

        async capturePageContent(linkInfo, depth) {
            const content = document.documentElement.outerHTML;
            const currentUrl = window.location.href;
            const normalizedUrl = this.normalizeUrl(currentUrl);
            const pageData = {
                url: normalizedUrl,
                originalUrl: currentUrl,
                linkText: linkInfo.text || '',
                linkHref: linkInfo.href || currentUrl,
                content,
                contentLength: content.length,
                depth,
                timestamp: new Date().toISOString(),
                sourceType: 'page'
            };
            this.results.push(pageData);
            this.globalProcessedUrls.add(normalizedUrl);
            this.log(`Captured page (depth ${depth}): ${linkInfo.text || normalizedUrl}`, 'success');
            try {
                await this.sendToServer('/page', pageData);
                this.log(`Sent page to server: ${normalizedUrl}`, 'success');
            } catch (error) {
                this.log(`Failed to send page to server: ${error.message}`, 'error');
            }
            return pageData;
        }

        async clickLink(link) {
            return new Promise((resolve) => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                const targetAnchor = anchors.find(a => a.href === link.href);
                if (!targetAnchor) {
                    resolve(false);
                    return;
                }
                const handleNavigation = () => {
                    window.removeEventListener('beforeunload', handleNavigation);
                    setTimeout(() => resolve(true), this.config.DELAY);
                };
                window.addEventListener('beforeunload', handleNavigation);
                targetAnchor.click();
                setTimeout(() => {
                    window.removeEventListener('beforeunload', handleNavigation);
                    if (window.location.href === link.href || this.normalizeUrl(window.location.href) === link.normalizedUrl) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, 3000);
            });
        }

        async recursiveCrawl(currentUrl, depth = 0) {
            if (!this.isRunning || this.isPaused) {
                return;
            }
            if (depth >= this.config.MAX_DEPTH) {
                this.log(`Max depth ${this.config.MAX_DEPTH} reached at ${currentUrl}`, 'warn');
                return;
            }
            const normalizedCurrentUrl = this.normalizeUrl(currentUrl);
            if (this.globalProcessedUrls.has(normalizedCurrentUrl)) {
                this.log(`Skipping already processed URL: ${normalizedCurrentUrl}`, 'info');
                return;
            }
            this.log(`Processing URL at depth ${depth}: ${currentUrl}`, 'info');
            const links = this.getPageLinks();
            this.pageLinkMap[normalizedCurrentUrl] = links;
            const unprocessedLinks = links.filter(link =>
                !this.globalProcessedUrls.has(link.normalizedUrl) &&
                !this.globalFailedUrls.has(link.normalizedUrl)
            );
            this.log(`${unprocessedLinks.length} unprocessed links at depth ${depth}`, 'info');
            const linksToProcess = unprocessedLinks.slice(0, this.config.MAX_LINKS_PER_PAGE);
            for (let i = 0; i < linksToProcess.length; i++) {
                if (!this.isRunning || this.isPaused) {
                    return;
                }
                const link = linksToProcess[i];
                if (this.globalProcessedUrls.has(link.normalizedUrl)) {
                    continue;
                }
                this.log(`Clicking link ${i + 1}/${linksToProcess.length} at depth ${depth}: ${link.text || link.normalizedUrl}`, 'info');
                const previousUrl = window.location.href;
                const clicked = await this.clickLink(link);
                if (!clicked) {
                    this.log(`Failed to click link: ${link.normalizedUrl}`, 'warn');
                    this.globalFailedUrls.add(link.normalizedUrl);
                    continue;
                }
                await delay(this.config.DELAY);
                const newUrl = window.location.href;
                const normalizedNewUrl = this.normalizeUrl(newUrl);
                if (normalizedNewUrl === this.normalizeUrl(previousUrl)) {
                    this.log(`Navigation failed - URL did not change: ${link.normalizedUrl}`, 'warn');
                    this.globalFailedUrls.add(link.normalizedUrl);
                    continue;
                }
                if (this.globalProcessedUrls.has(normalizedNewUrl)) {
                    this.log(`Arrived at already processed URL: ${normalizedNewUrl}, going back`, 'info');
                    window.history.back();
                    await delay(this.config.DELAY);
                    continue;
                }
                await this.capturePageContent(link, depth + 1);
                this.navigationStack.push({
                    url: normalizedCurrentUrl,
                    linkHref: link.href
                });
                await this.recursiveCrawl(newUrl, depth + 1);
                this.navigationStack.pop();
                this.log(`Going back from depth ${depth + 1} to ${depth}`, 'info');
                window.history.back();
                await delay(this.config.DELAY);
            }
        }

        async start() {
            const serverReachable = await this.pingServer();
            if (!serverReachable) {
                alert('Cannot connect to DocumentOffline server at ' + this.config.SERVER_URL + '\nPlease make sure the server is running!');
                return;
            }
            this.isRunning = true;
            this.startOrigin = window.location.origin;
            this.log('Starting recursive crawl from: ' + window.location.href, 'success');
            this.log(`Max depth: ${this.config.MAX_DEPTH}, Delay: ${this.config.DELAY}ms`, 'info');
            await this.capturePageContent({ text: 'Initial Page', href: window.location.href }, 0);
            await this.recursiveCrawl(window.location.href, 0);
            this.log('Crawl completed!', 'success');
            this.log(`Total pages processed: ${this.results.length}`, 'success');
            this.log(`Total URLs in global set: ${this.globalProcessedUrls.size}`, 'success');
            this.log(`Failed URLs: ${this.globalFailedUrls.size}`, 'success');
            try {
                await this.sendToServer('/complete', {
                    totalPages: this.results.length,
                    globalProcessedUrls: Array.from(this.globalProcessedUrls),
                    failedUrls: Array.from(this.globalFailedUrls),
                    pageLinkMap: this.pageLinkMap,
                    startUrl: window.location.href,
                    sourceType: 'page'
                });
                this.log('Sent completion notification to server', 'success');
            } catch (error) {
                this.log('Failed to send completion notification', 'error');
            }
            this.isRunning = false;
            alert('DocumentOffline Crawler completed!\n\nTotal pages: ' + this.results.length + '\nFailed URLs: ' + this.globalFailedUrls.size);
        }

        pause() {
            this.isPaused = true;
            this.log('Crawler paused', 'warn');
        }

        resume() {
            this.isPaused = false;
            this.log('Crawler resumed', 'info');
        }

        stop() {
            this.isRunning = false;
            this.isPaused = false;
            this.log('Crawler stopped', 'error');
        }
    }

    class BrowserIframeCrawler {
        constructor(iframeElement, options = {}) {
            this.iframeElement = iframeElement;
            this.config = options.config;
            this.iframeIndex = options.iframeIndex || 0;
            this.iframeInfo = options.iframeInfo || {};
            this.sharedProcessedUrls = options.sharedProcessedUrls || new Set();
            this.sharedFailedUrls = options.sharedFailedUrls || new Set();
            this.onPageCaptured = options.onPageCaptured;
            this.onFailed = options.onFailed;
            this.onLinksDiscovered = options.onLinksDiscovered;
            this.shouldStop = options.shouldStop || (() => false);
            this.results = [];
            this.pageLinkMap = {};
            this.navigationStack = [];
            this.startOrigin = null;
        }

        log(message, type = 'info') {
            const prefix = `[DocumentOffline-Iframe ${this.iframeIndex}]`;
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
            const validLinks = links.filter(link => {
                try {
                    const parsed = new URL(link.href);
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
            });
            const normalizedLinks = validLinks.map(link => ({
                ...link,
                normalizedUrl: normalizeUrlValue(link.href, this.config.SKIP_HASH_LINKS)
            }));
            this.pageLinkMap[currentUrl] = normalizedLinks;
            if (this.onLinksDiscovered) {
                this.onLinksDiscovered(this.iframeIndex, currentUrl, normalizedLinks);
            }
            this.log(`Found ${normalizedLinks.length} valid links on ${currentUrl}`);
            return normalizedLinks;
        }

        async waitForReadyState() {
            const timeout = this.config.IFRAME_NAVIGATION_TIMEOUT;
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

        async waitForNavigation(previousUrl, expectedUrl) {
            const timeout = this.config.IFRAME_NAVIGATION_TIMEOUT;
            const start = Date.now();
            const normalizedPrevious = previousUrl ? normalizeUrlValue(previousUrl, this.config.SKIP_HASH_LINKS) : null;
            const normalizedExpected = expectedUrl ? normalizeUrlValue(expectedUrl, this.config.SKIP_HASH_LINKS) : null;
            while (Date.now() - start < timeout) {
                const currentUrl = this.getCurrentUrl();
                if (!currentUrl) {
                    await delay(200);
                    continue;
                }
                const normalizedCurrent = normalizeUrlValue(currentUrl, this.config.SKIP_HASH_LINKS);
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
            const normalizedUrl = normalizeUrlValue(currentUrl, this.config.SKIP_HASH_LINKS);
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
                timestamp: new Date().toISOString(),
                sourceType: 'iframe'
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
            if (depth >= this.config.MAX_IFRAME_DEPTH) {
                this.log(`Max depth ${this.config.MAX_IFRAME_DEPTH} reached`, 'warn');
                return;
            }
            const currentUrl = this.getCurrentUrl();
            if (!currentUrl) {
                this.log('Cannot determine current URL for iframe', 'warn');
                return;
            }
            const normalizedCurrentUrl = normalizeUrlValue(currentUrl, this.config.SKIP_HASH_LINKS);
            if (this.sharedProcessedUrls.has(normalizedCurrentUrl)) {
                this.log(`Already processed ${normalizedCurrentUrl}, skipping`);
                return;
            }
            const links = this.collectLinks(normalizedCurrentUrl);
            const unprocessed = links.filter(link =>
                !this.sharedProcessedUrls.has(link.normalizedUrl) &&
                !this.sharedFailedUrls.has(link.normalizedUrl)
            );
            const linksToProcess = unprocessed.slice(0, this.config.MAX_IFRAME_LINKS_PER_PAGE);
            this.log(`${linksToProcess.length} links queued at depth ${depth}`);
            for (let i = 0; i < linksToProcess.length; i++) {
                if (this.shouldStop()) {
                    this.log('Stop requested, terminating iframe crawl early', 'warn');
                    break;
                }
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
        constructor(config, statusCallback) {
            this.config = config;
            this.statusCallback = statusCallback;
            this.isRunning = false;
            this.globalProcessedUrls = new Set();
            this.globalFailedUrls = new Set();
            this.pageLinkMap = {};
            this.results = [];
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

        updateStatus(status) {
            if (typeof this.statusCallback === 'function') {
                this.statusCallback(status);
            }
        }

        async pingServer() {
            try {
                await sendServerRequest(this.config.SERVER_URL, '/ping', {}, (msg, type) => this.log(msg, type));
                return true;
            } catch (error) {
                return false;
            }
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
                await sendServerRequest(this.config.SERVER_URL, '/page', pageData, (msg, type) => this.log(msg, type));
                this.log(`Sent iframe page to server: ${pageData.url}`, 'success');
            } catch (error) {
                this.log(`Failed to send iframe page: ${error.message}`, 'error');
            }
        }

        async onFailedLink(info) {
            this.log(`Failed iframe link: ${info.linkHref || info.href} (${info.error})`, 'warn');
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
                sharedProcessedUrls: this.globalProcessedUrls,
                sharedFailedUrls: this.globalFailedUrls,
                onPageCaptured: (data) => this.onPageCaptured(data),
                onFailed: (info) => this.onFailedLink(info),
                onLinksDiscovered: (idx, url, links) => this.onLinksDiscovered(idx, url, links),
                shouldStop: () => !this.isRunning
            });
            this.log(`Starting iframe ${position + 1}/${this.accessibleIframes.length}`, 'info');
            const result = await crawler.start();
            this.results.push(result);
        }

        async sendCompletion() {
            try {
                await sendServerRequest(this.config.SERVER_URL, '/complete', {
                    totalPages: this.globalProcessedUrls.size,
                    failedUrls: Array.from(this.globalFailedUrls),
                    pageLinkMap: this.pageLinkMap,
                    iframeResults: this.results,
                    sourceType: 'iframe'
                }, (msg, type) => this.log(msg, type));
                this.log('Sent iframe completion payload', 'success');
            } catch (error) {
                this.log('Failed to send iframe completion payload: ' + error.message, 'error');
            }
        }

        async start() {
            if (this.isRunning) {
                alert('Iframe crawler already running.');
                return;
            }
            const reachable = await this.pingServer();
            if (!reachable) {
                alert('Cannot reach DocumentOffline server at ' + this.config.SERVER_URL);
                return;
            }
            this.isRunning = true;
            this.updateStatus('starting');
            this.globalProcessedUrls.clear();
            this.globalFailedUrls.clear();
            this.pageLinkMap = {};
            this.results = [];
            this.accessibleIframes = this.getAccessibleIframes();
            if (!this.accessibleIframes.length) {
                alert('No accessible iframes detected on this page.');
                this.isRunning = false;
                this.updateStatus('idle');
                return;
            }
            this.updateStatus(`processing ${this.accessibleIframes.length}`);
            for (let i = 0; i < this.accessibleIframes.length; i++) {
                if (!this.isRunning) {
                    break;
                }
                try {
                    await this.runIframeCrawler(this.accessibleIframes[i], i);
                } catch (error) {
                    this.log(`Iframe crawl failed: ${error.message}`, 'error');
                }
            }
            await this.sendCompletion();
            this.isRunning = false;
            this.updateStatus('completed');
            alert('Iframe crawl completed. Processed pages: ' + this.globalProcessedUrls.size);
            setTimeout(() => this.updateStatus('idle'), 2000);
        }

        stop() {
            if (!this.isRunning) {
                alert('Iframe crawler is not running.');
                return;
            }
            this.isRunning = false;
            this.updateStatus('stopping');
            alert('Iframe crawler stop requested. It will halt after current link.');
        }
    }

    let crawler = null;
    let iframeController = null;
    let controlPanel = null;

    function getIframeController() {
        if (!iframeController) {
            iframeController = new IframeCrawlerController(CONFIG, (status) => updatePanelStatus('iframe', status));
        }
        return iframeController;
    }

    async function startPageCrawl() {
        if (crawler && crawler.isRunning) {
            alert('Crawler is already running!');
            return;
        }
        crawler = new RecursiveCrawler(CONFIG);
        updatePanelStatus('page', 'starting');
        try {
            await crawler.start();
            updatePanelStatus('page', 'completed');
            setTimeout(() => updatePanelStatus('page', 'idle'), 2000);
        } catch (error) {
            updatePanelStatus('page', 'error');
        }
    }

    function pausePageCrawl() {
        if (crawler) {
            crawler.pause();
            updatePanelStatus('page', 'paused');
        }
    }

    function resumePageCrawl() {
        if (crawler) {
            crawler.resume();
            updatePanelStatus('page', 'running');
        }
    }

    function stopPageCrawl() {
        if (crawler) {
            crawler.stop();
            updatePanelStatus('page', 'stopped');
            setTimeout(() => updatePanelStatus('page', 'idle'), 1500);
        }
    }

    async function startIframeCrawl() {
        const controller = getIframeController();
        updatePanelStatus('iframe', 'starting');
        await controller.start();
    }

    function stopIframeCrawl() {
        const controller = getIframeController();
        controller.stop();
    }

    function configureCrawler() {
        const maxDepth = prompt('Max depth (pages):', CONFIG.MAX_DEPTH);
        if (maxDepth) {
            CONFIG.MAX_DEPTH = parseInt(maxDepth, 10) || CONFIG.MAX_DEPTH;
        }
        const delayValue = prompt('Delay (ms):', CONFIG.DELAY);
        if (delayValue) {
            CONFIG.DELAY = parseInt(delayValue, 10) || CONFIG.DELAY;
        }
        const iframeDepth = prompt('Iframe max depth:', CONFIG.MAX_IFRAME_DEPTH);
        if (iframeDepth) {
            CONFIG.MAX_IFRAME_DEPTH = parseInt(iframeDepth, 10) || CONFIG.MAX_IFRAME_DEPTH;
        }
        const serverUrl = prompt('Server URL:', CONFIG.SERVER_URL);
        if (serverUrl) {
            CONFIG.SERVER_URL = serverUrl;
        }
        alert('Configuration updated!');
    }

    function injectPanelStyles() {
        if (document.getElementById(PANEL_STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = PANEL_STYLE_ID;
        style.textContent = `
            #${PANEL_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 260px;
                background: rgba(20, 20, 20, 0.9);
                color: #fff;
                font-family: Arial, sans-serif;
                font-size: 12px;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                z-index: 999999;
            }
            #${PANEL_ID}.collapsed .docoffline-panel-body {
                display: none;
            }
            #${PANEL_ID} button {
                font-size: 12px;
                padding: 4px 8px;
                margin: 2px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            #${PANEL_ID} button.docoffline-primary {
                background: #4CAF50;
                color: #fff;
            }
            #${PANEL_ID} button.docoffline-secondary {
                background: #2196F3;
                color: #fff;
            }
            #${PANEL_ID} button.docoffline-danger {
                background: #F44336;
                color: #fff;
            }
            .docoffline-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                font-weight: bold;
                cursor: move;
            }
            .docoffline-panel-body {
                padding: 8px 12px 12px;
            }
            .docoffline-section {
                margin-bottom: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 8px;
            }
            .docoffline-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            .docoffline-section-title {
                font-size: 13px;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #90CAF9;
            }
            .docoffline-status {
                font-size: 11px;
                margin-bottom: 4px;
                color: #CE93D8;
            }
        `;
        document.head.appendChild(style);
    }

    function makePanelDraggable(panel) {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        const header = panel.querySelector('.docoffline-panel-header');
        header.addEventListener('mousedown', (event) => {
            if (event.target?.dataset?.docofflineAction === 'toggle-panel') {
                return;
            }
            isDragging = true;
            offsetX = event.clientX - panel.offsetLeft;
            offsetY = event.clientY - panel.offsetTop;
            event.preventDefault();
        });
        document.addEventListener('mousemove', (event) => {
            if (!isDragging) {
                return;
            }
            panel.style.left = `${event.clientX - offsetX}px`;
            panel.style.top = `${event.clientY - offsetY}px`;
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    function updatePanelStatus(section, status) {
        const target = document.querySelector(`[data-docoffline-status="${section}"]`);
        if (target) {
            target.textContent = `Status: ${status}`;
        }
    }

    function createControlPanel() {
        if (controlPanel) {
            return controlPanel;
        }
        injectPanelStyles();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="docoffline-panel-header">
                <span>DocumentOffline</span>
                <button data-docoffline-action="toggle-panel" class="docoffline-secondary">–</button>
            </div>
            <div class="docoffline-panel-body">
                <div class="docoffline-section">
                    <div class="docoffline-section-title">Page Crawl</div>
                    <div class="docoffline-status" data-docoffline-status="page">Status: idle</div>
                    <div>
                        <button data-docoffline-action="start-page" class="docoffline-primary">Start</button>
                        <button data-docoffline-action="pause-page" class="docoffline-secondary">Pause</button>
                        <button data-docoffline-action="resume-page" class="docoffline-secondary">Resume</button>
                        <button data-docoffline-action="stop-page" class="docoffline-danger">Stop</button>
                    </div>
                </div>
                <div class="docoffline-section">
                    <div class="docoffline-section-title">Iframe Crawl</div>
                    <div class="docoffline-status" data-docoffline-status="iframe">Status: idle</div>
                    <div>
                        <button data-docoffline-action="start-iframe" class="docoffline-primary">Start</button>
                        <button data-docoffline-action="stop-iframe" class="docoffline-danger">Stop</button>
                    </div>
                </div>
                <div class="docoffline-section">
                    <button data-docoffline-action="configure" class="docoffline-secondary" style="width: 100%;">Configure</button>
                </div>
            </div>
        `;
        panel.addEventListener('click', (event) => {
            const action = event.target?.dataset?.docofflineAction;
            if (!action) {
                return;
            }
            switch (action) {
                case 'toggle-panel':
                    panel.classList.toggle('collapsed');
                    event.target.textContent = panel.classList.contains('collapsed') ? '+' : '–';
                    break;
                case 'start-page':
                    startPageCrawl();
                    break;
                case 'pause-page':
                    pausePageCrawl();
                    break;
                case 'resume-page':
                    resumePageCrawl();
                    break;
                case 'stop-page':
                    stopPageCrawl();
                    break;
                case 'start-iframe':
                    startIframeCrawl();
                    break;
                case 'stop-iframe':
                    stopIframeCrawl();
                    break;
                case 'configure':
                    configureCrawler();
                    break;
                default:
                    break;
            }
        });
        document.body.appendChild(panel);
        makePanelDraggable(panel);
        controlPanel = panel;
        return controlPanel;
    }

    function initializePanelWhenReady() {
        if (document.body) {
            createControlPanel();
        } else {
            const observer = new MutationObserver(() => {
                if (document.body) {
                    observer.disconnect();
                    createControlPanel();
                }
            });
            observer.observe(document.documentElement, { childList: true });
        }
    }

    GM_registerMenuCommand('Start Page Crawl', startPageCrawl);
    GM_registerMenuCommand('Pause Page Crawl', pausePageCrawl);
    GM_registerMenuCommand('Resume Page Crawl', resumePageCrawl);
    GM_registerMenuCommand('Stop Page Crawl', stopPageCrawl);
    GM_registerMenuCommand('Start Iframe Crawl', startIframeCrawl);
    GM_registerMenuCommand('Stop Iframe Crawl', stopIframeCrawl);
    GM_registerMenuCommand('Configure', configureCrawler);

    if (CONFIG.AUTO_START && window.location.href === GM_getValue('crawlStartUrl')) {
        startPageCrawl();
    }

    initializePanelWhenReady();

    console.log('%c[DocumentOffline-Crawler] Script loaded with UI panel. Use Tampermonkey menu or floating controls.', 'color: #4CAF50; font-weight: bold');
})();
