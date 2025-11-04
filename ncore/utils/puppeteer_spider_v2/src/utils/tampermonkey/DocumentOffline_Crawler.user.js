// ==UserScript==
// @name         DocumentOffline Crawler
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Recursive crawler for DocumentOffline - sends page content to local server
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
        AUTO_START: false
    };

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
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${this.config.SERVER_URL}${endpoint}`,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify(data),
                    onload: (response) => {
                        try {
                            const result = JSON.parse(response.responseText);
                            resolve(result);
                        } catch (error) {
                            resolve({ success: true });
                        }
                    },
                    onerror: (error) => {
                        this.log(`Server connection error: ${error}`, 'error');
                        reject(error);
                    },
                    ontimeout: () => {
                        this.log('Server request timeout', 'error');
                        reject(new Error('Timeout'));
                    },
                    timeout: 10000
                });
            });
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
            try {
                const parsed = new URL(url);
                if (this.config.SKIP_HASH_LINKS) {
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
                index: index
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
                content: content,
                contentLength: content.length,
                depth: depth,
                timestamp: new Date().toISOString()
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

                await new Promise(resolve => setTimeout(resolve, this.config.DELAY));

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
                    await new Promise(resolve => setTimeout(resolve, this.config.DELAY));
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
                await new Promise(resolve => setTimeout(resolve, this.config.DELAY));
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
                    startUrl: window.location.href
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

    let crawler = null;

    GM_registerMenuCommand('Start Crawling', () => {
        if (crawler && crawler.isRunning) {
            alert('Crawler is already running!');
            return;
        }
        crawler = new RecursiveCrawler(CONFIG);
        crawler.start();
    });

    GM_registerMenuCommand('Pause Crawling', () => {
        if (crawler) {
            crawler.pause();
        }
    });

    GM_registerMenuCommand('Resume Crawling', () => {
        if (crawler) {
            crawler.resume();
        }
    });

    GM_registerMenuCommand('Stop Crawling', () => {
        if (crawler) {
            crawler.stop();
        }
    });

    GM_registerMenuCommand('Configure', () => {
        const maxDepth = prompt('Max depth:', CONFIG.MAX_DEPTH);
        if (maxDepth) {
            CONFIG.MAX_DEPTH = parseInt(maxDepth);
        }

        const delay = prompt('Delay (ms):', CONFIG.DELAY);
        if (delay) {
            CONFIG.DELAY = parseInt(delay);
        }

        const serverUrl = prompt('Server URL:', CONFIG.SERVER_URL);
        if (serverUrl) {
            CONFIG.SERVER_URL = serverUrl;
        }

        alert('Configuration updated!\n\nMax Depth: ' + CONFIG.MAX_DEPTH + '\nDelay: ' + CONFIG.DELAY + 'ms\nServer: ' + CONFIG.SERVER_URL);
    });

    if (CONFIG.AUTO_START && window.location.href === GM_getValue('crawlStartUrl')) {
        crawler = new RecursiveCrawler(CONFIG);
        crawler.start();
    }

    console.log('%c[DocumentOffline-Crawler] Script loaded! Use Tampermonkey menu to start crawling.', 'color: #4CAF50; font-weight: bold');
})();
