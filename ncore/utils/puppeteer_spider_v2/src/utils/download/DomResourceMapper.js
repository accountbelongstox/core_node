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

class DomResourceMapper {
    constructor(page) {
        this.page = page;
        this.resourceMap = new Map();
    }

    async extractDomResources(options = {}) {
        const includeIframes = options.includeIframes !== false;
        const includeDataUrls = options.includeDataUrls === true;

        logger.info('[DomResourceMapper] Extracting DOM resources...');

        const mainFrameResources = await this.extractFrameResources(this.page, '/', includeDataUrls);

        logger.info(`[DomResourceMapper] Extracted ${mainFrameResources.length} resources from main frame`);

        let allResources = [...mainFrameResources];

        if (includeIframes) {
            const frames = this.page.frames();
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                if (frame === this.page.mainFrame()) {
                    continue;
                }

                try {
                    const framePath = `/iframe[${i}]`;
                    const frameResources = await this.extractFrameResources(frame, framePath, includeDataUrls);
                    allResources = allResources.concat(frameResources);
                    logger.info(`[DomResourceMapper] Extracted ${frameResources.length} resources from iframe ${i}`);
                } catch (error) {
                    logger.warn(`[DomResourceMapper] Failed to extract resources from iframe ${i}: ${error.message}`);
                }
            }
        }

        this.buildResourceMap(allResources);

        logger.success(`[DomResourceMapper] Total resources extracted: ${allResources.length}`);

        return allResources;
    }

    async extractFrameResources(frame, framePath, includeDataUrls) {
        const injectionCode = this.getInjectionCode(includeDataUrls);

        try {
            const resources = await frame.evaluate(injectionCode);

            return resources.map(resource => ({
                ...resource,
                xpath: framePath === '/' ? resource.xpath : framePath + resource.xpath,
                frame: framePath
            }));
        } catch (error) {
            logger.error(`[DomResourceMapper] Failed to execute injection code in frame ${framePath}: ${error.message}`);
            return [];
        }
    }

    getInjectionCode(includeDataUrls) {
        return `
            (function() {
                function stringToLowerCase(str) {
                    if (typeof str === 'string') {
                        return str.toLowerCase();
                    } else {
                        return '';
                    }
                }

                function getXpath(element) {
                    let xpath = '';
                    for (let me = element, k = 0; me && me.nodeType === 1; element = element.parentNode, me = element, k += 1) {
                        let i = 0;
                        while ((me = me.previousElementSibling)) {
                            if (me.tagName === element.tagName) {
                                i += 1;
                            }
                        }
                        const elementTag = stringToLowerCase(element.tagName);
                        let id = i + 1;
                        id = '[' + id + ']';
                        xpath = '/' + elementTag + id + xpath;
                    }
                    return xpath;
                }

                function extractUrlFromCss(cssValue) {
                    if (!cssValue || typeof cssValue !== 'string') {
                        return null;
                    }

                    const urlMatch = cssValue.match(/url\\s*\\(\\s*["']?([^"')]+)["']?\\s*\\)/i);
                    if (urlMatch && urlMatch[1]) {
                        let url = urlMatch[1].trim();
                        if (url.startsWith('data:') && !${includeDataUrls}) {
                            return null;
                        }
                        return url;
                    }

                    return null;
                }

                const results = [];
                const processedUrls = new Set();

                function addResource(element, url, sourceType) {
                    if (!url || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
                        return;
                    }

                    if (url.startsWith('data:') && !${includeDataUrls}) {
                        return;
                    }

                    try {
                        const absoluteUrl = new URL(url, window.location.href).href;
                        const key = absoluteUrl + '::' + getXpath(element);

                        if (processedUrls.has(key)) {
                            return;
                        }

                        processedUrls.add(key);

                        results.push({
                            xpath: getXpath(element),
                            url: absoluteUrl,
                            tagName: stringToLowerCase(element.tagName),
                            sourceType: sourceType,
                            attributes: {
                                id: element.id || null,
                                class: element.className || null,
                                alt: element.alt || null,
                                title: element.title || null
                            }
                        });
                    } catch (error) {
                    }
                }

                const treeWalker = document.createTreeWalker(
                    document.body ? document.body.parentElement : document.documentElement,
                    NodeFilter.SHOW_ELEMENT,
                    {
                        acceptNode: function (node) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                );

                while (treeWalker.nextNode()) {
                    const element = treeWalker.currentNode;

                    if (element.src) {
                        addResource(element, element.src, 'src');
                    }

                    if (element.href && (element.tagName.toLowerCase() === 'link' || element.tagName.toLowerCase() === 'a')) {
                        const rel = element.rel ? element.rel.toLowerCase() : '';
                        if (rel.includes('stylesheet') || rel.includes('icon') || rel.includes('preload')) {
                            addResource(element, element.href, 'href');
                        }
                    }

                    if (element.background) {
                        addResource(element, element.background, 'background');
                    }

                    if (element.poster && element.tagName.toLowerCase() === 'video') {
                        addResource(element, element.poster, 'poster');
                    }

                    const computedStyle = window.getComputedStyle(element, null);

                    const backgroundImage = extractUrlFromCss(computedStyle.backgroundImage);
                    if (backgroundImage) {
                        addResource(element, backgroundImage, 'css-background-image');
                    }

                    const listStyleImage = extractUrlFromCss(computedStyle.listStyleImage);
                    if (listStyleImage) {
                        addResource(element, listStyleImage, 'css-list-style-image');
                    }

                    const borderImage = extractUrlFromCss(computedStyle.borderImageSource);
                    if (borderImage) {
                        addResource(element, borderImage, 'css-border-image');
                    }

                    if (element.srcset) {
                        const srcsetEntries = element.srcset.split(',');
                        srcsetEntries.forEach(entry => {
                            const parts = entry.trim().split(/\\s+/);
                            if (parts[0]) {
                                addResource(element, parts[0], 'srcset');
                            }
                        });
                    }

                    const dataSrc = element.getAttribute('data-src');
                    if (dataSrc) {
                        addResource(element, dataSrc, 'data-src');
                    }

                    const dataOriginal = element.getAttribute('data-original');
                    if (dataOriginal) {
                        addResource(element, dataOriginal, 'data-original');
                    }

                    const vLazy = element.getAttribute('v-lazy');
                    if (vLazy) {
                        addResource(element, vLazy, 'v-lazy');
                    }
                }

                return results;
            })();
        `;
    }

    buildResourceMap(resources) {
        this.resourceMap.clear();

        for (const resource of resources) {
            const url = this.normalizeUrl(resource.url);

            if (!this.resourceMap.has(url)) {
                this.resourceMap.set(url, []);
            }

            this.resourceMap.get(url).push(resource);
        }
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

    findResourcesByUrl(url) {
        const normalizedUrl = this.normalizeUrl(url);
        return this.resourceMap.get(normalizedUrl) || [];
    }

    getAllResources() {
        const allResources = [];
        for (const resources of this.resourceMap.values()) {
            allResources.push(...resources);
        }
        return allResources;
    }

    getResourcesByType(sourceType) {
        return this.getAllResources().filter(resource => resource.sourceType === sourceType);
    }

    getResourcesByTag(tagName) {
        return this.getAllResources().filter(resource => resource.tagName === tagName.toLowerCase());
    }

    getStats() {
        const stats = {
            totalResources: 0,
            uniqueUrls: this.resourceMap.size,
            bySourceType: {},
            byTagName: {},
            byFrame: {}
        };

        for (const resources of this.resourceMap.values()) {
            stats.totalResources += resources.length;

            for (const resource of resources) {
                stats.bySourceType[resource.sourceType] = (stats.bySourceType[resource.sourceType] || 0) + 1;
                stats.byTagName[resource.tagName] = (stats.byTagName[resource.tagName] || 0) + 1;
                stats.byFrame[resource.frame] = (stats.byFrame[resource.frame] || 0) + 1;
            }
        }

        return stats;
    }

    clear() {
        this.resourceMap.clear();
        logger.info('[DomResourceMapper] Cleared resource map');
    }
}

module.exports = DomResourceMapper;
