'use strict';

const logger = require('#@logger');
const crypto = require('crypto');

class ResourceInterceptor {
    constructor(page, options = {}) {
        this.page = page;
        this.enabled = false;
        this.interceptedResources = new Map();
        this.resourceTypes = options.resourceTypes || ['image', 'stylesheet', 'font', 'media'];
        this.includeFailedRequests = options.includeFailedRequests !== false;
        this.computeHash = options.computeHash !== false;

        this.stats = {
            totalRequests: 0,
            interceptedRequests: 0,
            failedRequests: 0,
            byType: {}
        };
    }

    async enable() {
        if (this.enabled) {
            logger.warn('[ResourceInterceptor] Already enabled');
            return;
        }

        await this.page.setRequestInterception(true);

        this.page.on('request', (request) => {
            this.handleRequest(request);
        });

        this.page.on('response', async (response) => {
            await this.handleResponse(response);
        });

        this.page.on('requestfailed', (request) => {
            this.handleRequestFailed(request);
        });

        this.enabled = true;
        logger.success('[ResourceInterceptor] Resource interception enabled');
    }

    async disable() {
        if (!this.enabled) {
            return;
        }

        await this.page.setRequestInterception(false);
        this.page.removeAllListeners('request');
        this.page.removeAllListeners('response');
        this.page.removeAllListeners('requestfailed');

        this.enabled = false;
        logger.info('[ResourceInterceptor] Resource interception disabled');
    }

    handleRequest(request) {
        this.stats.totalRequests++;
        request.continue();
    }

    async handleResponse(response) {
        const url = response.url();
        const request = response.request();
        const resourceType = request.resourceType();

        if (!this.resourceTypes.includes(resourceType)) {
            return;
        }

        const status = response.status();

        if (status < 200 || status >= 400) {
            return;
        }

        try {
            this.stats.interceptedRequests++;
            this.stats.byType[resourceType] = (this.stats.byType[resourceType] || 0) + 1;

            const headers = response.headers();
            const contentType = headers['content-type'] || '';
            const contentLength = parseInt(headers['content-length'] || '0', 10);

            const resourceInfo = {
                url: url,
                resourceType: resourceType,
                status: status,
                contentType: contentType,
                contentLength: contentLength,
                timestamp: new Date().toISOString(),
                method: request.method(),
                headers: headers
            };

            if (this.computeHash && contentLength > 0 && contentLength < 10 * 1024 * 1024) {
                try {
                    const buffer = await response.buffer();
                    resourceInfo.hash = crypto.createHash('md5').update(buffer).digest('hex');
                    resourceInfo.actualSize = buffer.length;
                } catch (error) {
                    logger.debug(`[ResourceInterceptor] Could not compute hash for ${url}: ${error.message}`);
                }
            }

            this.interceptedResources.set(url, resourceInfo);
            logger.debug(`[ResourceInterceptor] Intercepted ${resourceType}: ${url}`);

        } catch (error) {
            logger.warn(`[ResourceInterceptor] Failed to process response: ${url}`, error);
        }
    }

    handleRequestFailed(request) {
        if (!this.includeFailedRequests) {
            return;
        }

        const url = request.url();
        const resourceType = request.resourceType();

        if (!this.resourceTypes.includes(resourceType)) {
            return;
        }

        this.stats.failedRequests++;

        const resourceInfo = {
            url: url,
            resourceType: resourceType,
            status: 0,
            failed: true,
            failureText: request.failure() ? request.failure().errorText : 'Unknown error',
            timestamp: new Date().toISOString()
        };

        this.interceptedResources.set(url, resourceInfo);
        logger.warn(`[ResourceInterceptor] Failed request: ${url} (${resourceInfo.failureText})`);
    }

    getInterceptedResources(resourceType = null) {
        if (!resourceType) {
            return Array.from(this.interceptedResources.values());
        }

        return Array.from(this.interceptedResources.values()).filter(
            resource => resource.resourceType === resourceType
        );
    }

    getResourceByUrl(url) {
        return this.interceptedResources.get(url);
    }

    getStats() {
        return {
            ...this.stats,
            totalIntercepted: this.interceptedResources.size,
            resourceTypes: Object.keys(this.stats.byType)
        };
    }

    clear() {
        this.interceptedResources.clear();
        this.stats = {
            totalRequests: 0,
            interceptedRequests: 0,
            failedRequests: 0,
            byType: {}
        };
        logger.info('[ResourceInterceptor] Cleared all intercepted resources');
    }

    hasResource(url) {
        return this.interceptedResources.has(url);
    }

    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            urlObj.hash = '';
            return urlObj.href;
        } catch (error) {
            return url;
        }
    }

    matchResource(domUrl) {
        const normalizedDomUrl = this.normalizeUrl(domUrl);

        if (this.interceptedResources.has(normalizedDomUrl)) {
            return this.interceptedResources.get(normalizedDomUrl);
        }

        if (this.interceptedResources.has(domUrl)) {
            return this.interceptedResources.get(domUrl);
        }

        return null;
    }
}

module.exports = ResourceInterceptor;
