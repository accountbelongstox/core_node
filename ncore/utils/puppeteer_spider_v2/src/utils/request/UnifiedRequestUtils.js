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
const ScriptInjectionUtils = require('../injection/ScriptInjectionUtils');
const ResourceInterceptor = require('../download/ResourceInterceptor');
const ResourceDownloadUtils = require('../download/ResourceDownloadUtils');
const BaseUtils = require('../base/BaseUtils');

class UnifiedRequestUtils {
    constructor(page, options = {}) {
        this.page = page;
        this.baseUtils = new BaseUtils();
        this.scriptInjection = new ScriptInjectionUtils(page);
        this.options = {
            timeout: options.timeout || 30000,
            retries: options.retries || 3,
            preferredMethod: options.preferredMethod || 'auto',
            fallbackEnabled: options.fallbackEnabled !== false,
            ...options
        };
        this.interceptor = null;
        this.downloadUtils = null;
    }

    async fetchViaInject(url, options = {}) {
        const method = options.method || 'GET';
        const headers = options.headers || {};
        const body = options.body;
        const responseType = options.responseType || 'auto';
        const timeout = options.timeout || this.options.timeout;

        logger.info(`[Method 1] Attempting fetch via script injection: ${url}`);

        try {
            const result = await this.scriptInjection.injectFetchRequest(url, {
                method,
                headers,
                body,
                responseType,
                timeout
            });

            if (result && result.success) {
                logger.success(`[Method 1] Fetch via injection succeeded: ${url}`);

                const responseData = {
                    method: 'inject',
                    url: url,
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                    contentType: result.contentType,
                    data: result.data,
                    dataType: this._detectDataType(result.data, result.contentType),
                    success: true
                };

                if (responseType === 'binary' || responseType === 'arrayBuffer') {
                    responseData.binary = result.data;
                    responseData.isBinary = true;
                }

                return responseData;
            } else {
                throw new Error(result.error || 'Fetch injection failed');
            }
        } catch (error) {
            logger.warn(`[Method 1] Fetch via injection failed: ${error.message}`);
            throw error;
        }
    }

    async fetchViaInterceptor(url, options = {}) {
        const timeout = options.timeout || this.options.timeout;
        const waitTime = options.waitTime || 5000;

        logger.info(`[Method 2] Attempting fetch via resource interceptor: ${url}`);

        try {
            if (!this.interceptor) {
                this.interceptor = new ResourceInterceptor(this.page, {
                    resourceTypes: ['xhr', 'fetch', 'document', 'image', 'media', 'font', 'script', 'stylesheet']
                });
                await this.interceptor.enable();
                logger.debug('[Method 2] Resource interceptor enabled');
            }

            const normalizedUrl = this.baseUtils.normalizeUrl(url);
            const startTime = Date.now();

            const checkResource = async () => {
                while (Date.now() - startTime < timeout) {
                    const resource = this.interceptor.getResourceByUrl(url) ||
                                    this.interceptor.getResourceByUrl(normalizedUrl);

                    if (resource) {
                        logger.success(`[Method 2] Resource intercepted: ${url}`);

                        const contentType = resource.headers['content-type'] || '';
                        let data = resource.buffer;

                        if (contentType.includes('application/json') || contentType.includes('text/')) {
                            try {
                                const text = resource.buffer.toString('utf-8');
                                if (contentType.includes('application/json')) {
                                    data = JSON.parse(text);
                                } else {
                                    data = text;
                                }
                            } catch (e) {
                                data = Array.from(resource.buffer);
                            }
                        } else {
                            data = Array.from(resource.buffer);
                        }

                        return {
                            method: 'interceptor',
                            url: url,
                            status: resource.status,
                            headers: resource.headers,
                            contentType: contentType,
                            data: data,
                            dataType: this._detectDataType(data, contentType),
                            buffer: resource.buffer,
                            isBinary: !contentType.includes('text/') && !contentType.includes('application/json'),
                            success: true
                        };
                    }

                    await this.baseUtils.wait(100);
                }

                throw new Error('Resource not intercepted within timeout');
            };

            return await checkResource();
        } catch (error) {
            logger.warn(`[Method 2] Fetch via interceptor failed: ${error.message}`);
            throw error;
        }
    }

    async fetchViaProxy(url, options = {}) {
        const timeout = options.timeout || this.options.timeout;
        const tempPath = options.tempPath || null;

        logger.info(`[Method 3] Attempting fetch via proxy download: ${url}`);

        try {
            if (!this.downloadUtils) {
                this.downloadUtils = new ResourceDownloadUtils(this.page, {
                    timeout: timeout
                });
            }

            const downloadId = this.baseUtils.generateRandomId();
            const fileName = tempPath || this.baseUtils.generateFileName(url, {
                prefix: 'fetch_proxy',
                timestamp: true
            });

            const result = await this.downloadUtils.downloadResourceViaProxy(url, fileName, {
                timeout: timeout,
                downloadId: downloadId
            });

            if (result && result.success) {
                logger.success(`[Method 3] Fetch via proxy succeeded: ${url}`);

                const fs = require('fs');
                const path = require('path');

                let data;
                let isBinary = true;
                const contentType = result.contentType || '';

                if (fs.existsSync(result.filePath)) {
                    const buffer = fs.readFileSync(result.filePath);

                    if (contentType.includes('application/json')) {
                        data = JSON.parse(buffer.toString('utf-8'));
                        isBinary = false;
                    } else if (contentType.includes('text/')) {
                        data = buffer.toString('utf-8');
                        isBinary = false;
                    } else {
                        data = Array.from(buffer);
                    }

                    if (options.deleteTempFile !== false) {
                        fs.unlinkSync(result.filePath);
                        logger.debug(`[Method 3] Temporary file deleted: ${result.filePath}`);
                    }
                } else {
                    throw new Error('Downloaded file not found');
                }

                return {
                    method: 'proxy',
                    url: url,
                    filePath: result.filePath,
                    contentType: contentType,
                    data: data,
                    dataType: this._detectDataType(data, contentType),
                    isBinary: isBinary,
                    size: result.size || 0,
                    success: true
                };
            } else {
                throw new Error('Proxy download failed');
            }
        } catch (error) {
            logger.warn(`[Method 3] Fetch via proxy failed: ${error.message}`);
            throw error;
        }
    }

    async fetch(url, options = {}) {
        const preferredMethod = options.preferredMethod || this.options.preferredMethod;
        const fallbackEnabled = options.fallbackEnabled !== false && this.options.fallbackEnabled;
        const methods = this._getMethodOrder(preferredMethod);

        logger.info(`[UnifiedRequest] Fetching ${url} (preferred: ${preferredMethod}, fallback: ${fallbackEnabled})`);

        let lastError = null;

        for (let i = 0; i < methods.length; i++) {
            const methodName = methods[i];

            try {
                let result;

                switch (methodName) {
                    case 'inject':
                        result = await this.fetchViaInject(url, options);
                        break;
                    case 'interceptor':
                        result = await this.fetchViaInterceptor(url, options);
                        break;
                    case 'proxy':
                        result = await this.fetchViaProxy(url, options);
                        break;
                    default:
                        throw new Error(`Unknown method: ${methodName}`);
                }

                if (result && result.success) {
                    logger.success(`[UnifiedRequest] Successfully fetched via ${methodName}: ${url}`);
                    return result;
                }
            } catch (error) {
                lastError = error;
                logger.warn(`[UnifiedRequest] Method ${methodName} failed: ${error.message}`);

                if (!fallbackEnabled || i === methods.length - 1) {
                    throw error;
                }

                logger.info(`[UnifiedRequest] Trying next method...`);
            }
        }

        throw lastError || new Error('All fetch methods failed');
    }

    _getMethodOrder(preferredMethod) {
        const allMethods = ['inject', 'interceptor', 'proxy'];

        if (preferredMethod === 'auto') {
            return allMethods;
        }

        if (allMethods.includes(preferredMethod)) {
            const ordered = [preferredMethod];
            allMethods.forEach(method => {
                if (method !== preferredMethod) {
                    ordered.push(method);
                }
            });
            return ordered;
        }

        return allMethods;
    }

    _detectDataType(data, contentType) {
        if (Array.isArray(data) && data.every(item => typeof item === 'number')) {
            return 'binary';
        }

        if (typeof data === 'string') {
            return contentType.includes('application/json') ? 'json-string' : 'text';
        }

        if (typeof data === 'object' && data !== null) {
            return 'json';
        }

        return 'unknown';
    }

    async disableInterceptor() {
        if (this.interceptor) {
            await this.interceptor.disable();
            this.interceptor = null;
            logger.info('[UnifiedRequest] Resource interceptor disabled');
        }
    }

    async cleanup() {
        await this.disableInterceptor();

        if (this.downloadUtils) {
            await this.downloadUtils.cleanup();
            this.downloadUtils = null;
        }

        logger.info('[UnifiedRequest] Cleanup completed');
    }

    getStats() {
        const stats = {
            interceptorEnabled: !!this.interceptor,
            proxyUtilsCreated: !!this.downloadUtils
        };

        if (this.interceptor) {
            const resources = this.interceptor.getInterceptedResources();
            stats.interceptedResourcesCount = resources.length;
        }

        return stats;
    }

    async downloadInCurrentPage(downloadUrl, options = {}) {
        const method = options.method || 'GET';
        const preferredMethod = options.preferredMethod || this.options.preferredMethod;
        const fallbackEnabled = options.fallbackEnabled !== false && this.options.fallbackEnabled;

        logger.info(`[DownloadInCurrent] Downloading ${downloadUrl} in current page`);

        try {
            const result = await this.fetch(downloadUrl, {
                method,
                preferredMethod,
                fallbackEnabled,
                responseType: options.responseType || 'binary',
                ...options
            });

            return result;
        } catch (error) {
            logger.error(`[DownloadInCurrent] Failed to download ${downloadUrl}:`, error.message);
            throw error;
        }
    }

    async downloadWithNavigation(downloadUrl, navigationUrl, options = {}) {
        const matchMode = options.matchMode || 'sameOrigin';
        const urlStrict = matchMode === 'fullUrl';
        const waitAfterNav = options.waitAfterNav || 2000;
        const method = options.method || 'GET';

        logger.info(`[DownloadWithNav] Download URL: ${downloadUrl}, Navigation URL: ${navigationUrl}, Match mode: ${matchMode}`);

        try {
            const EnhancedPage = require('../../implementations/pages/EnhancedPage');
            let enhancedPage = null;

            if (this.page.openUrl && typeof this.page.openUrl === 'function') {
                enhancedPage = this.page;
            } else if (this.page.page) {
                const session = this.page._session || this.page.session;
                if (session && session.browser) {
                    enhancedPage = new EnhancedPage(session.browser, {});
                }
            }

            if (!enhancedPage) {
                logger.warn('[DownloadWithNav] EnhancedPage not available, using simple navigation');
                await this.page.goto(navigationUrl, {
                    waitUntil: 'networkidle2',
                    timeout: options.timeout || this.options.timeout
                });
                await this.baseUtils.wait(waitAfterNav);

                return await this.downloadInCurrentPage(downloadUrl, options);
            }

            const navResult = await enhancedPage.openUrl(navigationUrl, {
                urlStrict: urlStrict,
                waitForComplete: true,
                timeout: options.timeout || this.options.timeout,
                showImages: options.showImages !== false,
                showStyle: options.showStyle !== false
            });

            logger.success(`[DownloadWithNav] Navigation result: ${navResult.action}`);

            await this.baseUtils.wait(waitAfterNav);

            const targetPage = navResult.page || this.page;

            const tempUtils = new UnifiedRequestUtils(targetPage, {
                timeout: this.options.timeout,
                retries: this.options.retries,
                preferredMethod: options.preferredMethod || this.options.preferredMethod,
                fallbackEnabled: options.fallbackEnabled !== false
            });

            const downloadResult = await tempUtils.fetch(downloadUrl, {
                method,
                responseType: options.responseType || 'binary',
                ...options
            });

            await tempUtils.cleanup();

            return {
                ...downloadResult,
                navigationAction: navResult.action,
                navigationUrl: navigationUrl,
                matchMode: matchMode
            };

        } catch (error) {
            logger.error(`[DownloadWithNav] Failed:`, error.message);
            throw error;
        }
    }

    async downloadWithSameOriginNav(downloadUrl, navigationUrl, options = {}) {
        logger.info(`[DownloadWithSameOrigin] Navigating to same origin before download`);
        return await this.downloadWithNavigation(downloadUrl, navigationUrl, {
            ...options,
            matchMode: 'sameOrigin'
        });
    }

    async downloadWithFullUrlNav(downloadUrl, navigationUrl, options = {}) {
        logger.info(`[DownloadWithFullUrl] Navigating to exact URL before download`);
        return await this.downloadWithNavigation(downloadUrl, navigationUrl, {
            ...options,
            matchMode: 'fullUrl'
        });
    }

    async fetchBatch(urls, options = {}) {
        const method = options.method || 'GET';
        const headers = options.headers || {};
        const responseType = options.responseType || 'json';
        const timeout = options.timeout || this.options.timeout;
        const concurrency = options.concurrency || 10;

        logger.info(`[UnifiedRequestUtils] Batch fetching ${urls.length} URLs with concurrency ${concurrency}`);

        try {
            const result = await this.scriptInjection.injectBatchFetchRequests(urls, {
                method,
                headers,
                responseType,
                timeout,
                concurrency
            });

            logger.success(`[UnifiedRequestUtils] Batch fetch completed: ${result.successful}/${result.total} successful`);

            return {
                success: true,
                method: 'inject_batch',
                total: result.total,
                successful: result.successful,
                failed: result.failed,
                results: result.results
            };

        } catch (error) {
            logger.error(`[UnifiedRequestUtils] Batch fetch failed: ${error.message}`);
            throw error;
        }
    }

    async fetchBatchAndMerge(urls, options = {}) {
        const result = await this.fetchBatch(urls, options);

        if (!result.success) {
            throw new Error('Batch fetch failed');
        }

        const successfulResults = result.results.filter(r => r.success);
        const allData = [];

        for (const item of successfulResults) {
            if (item.data && item.data.data && Array.isArray(item.data.data)) {
                allData.push(...item.data.data);
            } else if (item.data && Array.isArray(item.data)) {
                allData.push(...item.data);
            }
        }

        logger.info(`[UnifiedRequestUtils] Merged ${allData.length} items from ${successfulResults.length} successful requests`);

        return {
            success: true,
            method: 'inject_batch_merged',
            total: result.total,
            successful: result.successful,
            failed: result.failed,
            mergedCount: allData.length,
            data: allData,
            rawResults: result.results
        };
    }
}

module.exports = UnifiedRequestUtils;
