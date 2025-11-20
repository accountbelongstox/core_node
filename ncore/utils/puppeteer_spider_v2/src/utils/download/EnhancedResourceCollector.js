// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');
const ResourceInterceptor = require('./ResourceInterceptor');
const DomResourceMapper = require('./DomResourceMapper');

class EnhancedResourceCollector {
    constructor(page, options = {}) {
        this.page = page;
        this.interceptor = new ResourceInterceptor(page, {
            resourceTypes: options.resourceTypes || ['image', 'stylesheet', 'font', 'media'],
            includeFailedRequests: options.includeFailedRequests !== false,
            computeHash: options.computeHash !== false
        });
        this.mapper = new DomResourceMapper(page);
        this.enabled = false;
        this.matchedResources = [];
    }

    async enable() {
        if (this.enabled) {
            logger.warn('[EnhancedResourceCollector] Already enabled');
            return;
        }

        await this.interceptor.enable();
        this.enabled = true;
        logger.success('[EnhancedResourceCollector] Resource collection enabled');
    }

    async disable() {
        if (!this.enabled) {
            return;
        }

        await this.interceptor.disable();
        this.enabled = false;
        logger.info('[EnhancedResourceCollector] Resource collection disabled');
    }

    async collectResources(options = {}) {
        logger.info('[EnhancedResourceCollector] Starting resource collection...');

        const waitForNetwork = options.waitForNetwork !== false;
        const waitTime = options.waitTime || 2000;

        if (waitForNetwork) {
            logger.info(`[EnhancedResourceCollector] Waiting ${waitTime}ms for network idle...`);
            await this.page.waitForTimeout(waitTime);
        }

        const domResources = await this.mapper.extractDomResources({
            includeIframes: options.includeIframes !== false,
            includeDataUrls: options.includeDataUrls === true
        });

        logger.info(`[EnhancedResourceCollector] DOM extraction complete: ${domResources.length} resources found`);

        this.matchedResources = this.matchResourcesWithInterception(domResources);

        logger.success(`[EnhancedResourceCollector] Resource collection complete: ${this.matchedResources.length} resources matched`);

        return this.getCollectionResult();
    }

    matchResourcesWithInterception(domResources) {
        const matched = [];
        const interceptedResources = this.interceptor.getInterceptedResources();

        logger.info(`[EnhancedResourceCollector] Matching ${domResources.length} DOM resources with ${interceptedResources.length} intercepted resources...`);

        for (const domResource of domResources) {
            const interceptedData = this.interceptor.matchResource(domResource.url);

            matched.push({
                xpath: domResource.xpath,
                url: domResource.url,
                tagName: domResource.tagName,
                sourceType: domResource.sourceType,
                frame: domResource.frame,
                attributes: domResource.attributes,
                intercepted: interceptedData ? {
                    status: interceptedData.status,
                    contentType: interceptedData.contentType,
                    contentLength: interceptedData.contentLength,
                    actualSize: interceptedData.actualSize,
                    hash: interceptedData.hash,
                    timestamp: interceptedData.timestamp,
                    failed: interceptedData.failed,
                    failureText: interceptedData.failureText
                } : null,
                matched: !!interceptedData
            });
        }

        const matchedCount = matched.filter(r => r.matched).length;
        const unmatchedCount = matched.length - matchedCount;

        logger.info(`[EnhancedResourceCollector] Matched: ${matchedCount}, Unmatched: ${unmatchedCount}`);

        return matched;
    }

    getCollectionResult() {
        const result = {
            resources: this.matchedResources,
            stats: {
                total: this.matchedResources.length,
                matched: this.matchedResources.filter(r => r.matched).length,
                unmatched: this.matchedResources.filter(r => !r.matched).length,
                bySourceType: {},
                byTagName: {},
                byFrame: {},
                interceptorStats: this.interceptor.getStats(),
                mapperStats: this.mapper.getStats()
            }
        };

        for (const resource of this.matchedResources) {
            result.stats.bySourceType[resource.sourceType] = (result.stats.bySourceType[resource.sourceType] || 0) + 1;
            result.stats.byTagName[resource.tagName] = (result.stats.byTagName[resource.tagName] || 0) + 1;
            result.stats.byFrame[resource.frame] = (result.stats.byFrame[resource.frame] || 0) + 1;
        }

        return result;
    }

    getMatchedResources() {
        return this.matchedResources.filter(r => r.matched);
    }

    getUnmatchedResources() {
        return this.matchedResources.filter(r => !r.matched);
    }

    getResourcesByType(sourceType) {
        return this.matchedResources.filter(r => r.sourceType === sourceType);
    }

    getResourcesByTag(tagName) {
        return this.matchedResources.filter(r => r.tagName === tagName.toLowerCase());
    }

    getResourcesByFrame(framePath) {
        return this.matchedResources.filter(r => r.frame === framePath);
    }

    findResourceByXpath(xpath) {
        return this.matchedResources.find(r => r.xpath === xpath);
    }

    findResourcesByUrl(url) {
        const normalizedUrl = this.normalizeUrl(url);
        return this.matchedResources.filter(r => this.normalizeUrl(r.url) === normalizedUrl);
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

    exportToJson(includeUnmatched = false) {
        const resources = includeUnmatched ? this.matchedResources : this.getMatchedResources();

        return {
            timestamp: new Date().toISOString(),
            url: this.page.url(),
            totalResources: resources.length,
            resources: resources.map(r => ({
                xpath: r.xpath,
                url: r.url,
                tagName: r.tagName,
                sourceType: r.sourceType,
                frame: r.frame,
                matched: r.matched,
                status: r.intercepted ? r.intercepted.status : null,
                contentType: r.intercepted ? r.intercepted.contentType : null,
                size: r.intercepted ? r.intercepted.actualSize || r.intercepted.contentLength : null,
                hash: r.intercepted ? r.intercepted.hash : null
            })),
            stats: this.getCollectionResult().stats
        };
    }

    clear() {
        this.matchedResources = [];
        this.interceptor.clear();
        this.mapper.clear();
        logger.info('[EnhancedResourceCollector] Cleared all collected resources');
    }
}

module.exports = EnhancedResourceCollector;
