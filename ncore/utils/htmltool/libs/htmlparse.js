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
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { DOMParser } = require('xmldom');
const xpath = require('xpath');

class HtmlParse {
    constructor(html, baseUrl = '') {
        this.baseUrl = baseUrl;
        if (typeof html === 'string' && !this.isRawHtml(html) && path.isAbsolute(html)) {
            if (fs.existsSync(html)) {
                const fileContent = fs.readFileSync(html, 'utf-8');
                this.$ = cheerio.load(fileContent);
            } else {
                throw new Error(`File does not exist: ${html}`);
            }
        } else {
            this.$ = cheerio.load(html);
        }
    }

    isRawHtml(html) {
        const regex = /^[\s\n\r]*\</;
        return regex.test(html);
    }

    getCurrentPage() {
        return this.$;
    }

    getFullPageOuterHTMLAndWait() {
        return this.$.html();
    }

    getFullPageOuterHTML() {
        return this.$.html();
    }

    getAllAnchorHrefs(completeURL = false) {
        const hrefs = [];
        this.$('a').each((index, element) => {
            const href = this.$(element).attr('href');
            if (href) {
                if (completeURL && this.baseUrl) {
                    try {
                        const absoluteUrl = new URL(href, this.baseUrl).toString();
                        hrefs.push(absoluteUrl);
                    } catch (error) {
                        // Skip invalid URLs
                        console.warn(`Invalid URL: ${href}`);
                    }
                } else {
                    hrefs.push(href);
                }
            }
        });
        return hrefs;
    }

    getAllImageSrcs(completeURL = false) {
        const srcs = [];
        this.$('img').each((index, element) => {
            const src = this.$(element).attr('src');
            if (src) {
                if (completeURL && this.baseUrl) {
                    try {
                        const absoluteUrl = new URL(src, this.baseUrl).toString();
                        srcs.push(absoluteUrl);
                    } catch (error) {
                        // Skip invalid URLs
                        console.warn(`Invalid URL: ${src}`);
                    }
                } else {
                    srcs.push(src);
                }
            }
        });
        return srcs;
    }

    getAllCssResourcePaths(completeURL = false) {
        const cssPaths = [];
        this.$('link[rel="stylesheet"]').each((index, element) => {
            const href = this.$(element).attr('href');
            if (href) {
                if (completeURL && this.baseUrl) {
                    try {
                        const absoluteUrl = new URL(href, this.baseUrl).toString();
                        cssPaths.push(absoluteUrl);
                    } catch (error) {
                        // Skip invalid URLs
                        console.warn(`Invalid URL: ${href}`);
                    }
                } else {
                    cssPaths.push(href);
                }
            }
        });
        return cssPaths;
    }

    getAllJsResourcePaths(completeURL = false) {
        const jsPaths = [];
        this.$('script[src]').each((index, element) => {
            const src = this.$(element).attr('src');
            if (src) {
                if (completeURL && this.baseUrl) {
                    try {
                        const absoluteUrl = new URL(src, this.baseUrl).toString();
                        jsPaths.push(absoluteUrl);
                    } catch (error) {
                        // Skip invalid URLs
                        console.warn(`Invalid URL: ${src}`);
                    }
                } else {
                    jsPaths.push(src);
                }
            }
        });
        return jsPaths;
    }

    queryAllElements(selector) {
        const elements = [];
        this.$(selector).each((index, element) => {
            elements.push(this.$(element).html());
        });
        return elements;
    }

    doesElementExist(selector) {
        return this.$(selector).length > 0;
    }

    isImageElement(selector) {
        return this.$(selector).is('img');
    }

    isJsElement(selector) {
        return this.$(selector).is('script');
    }

    isCssElement(selector) {
        return this.$(selector).is('link');
    }

    getElementBySelector(selector) {
        return this.$(selector).html();
    }

    getElementBySelectorAndWait(selector, waitDuration) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(this.$(selector).html());
            }, waitDuration);
        });
    }

    getElementsBySelectorAndWait(selector, waitDuration) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const elements = [];
                this.$(selector).each((index, element) => {
                    elements.push(this.$(element).html());
                });
                resolve(elements);
            }, waitDuration);
        });
    }

    getTextBySelector(selector) {
        return this.$(selector).text();
    }

    getAllTextsBySelector(selector) {
        const texts = [];
        this.$(selector).each((index, element) => {
            texts.push(this.$(element).text());
        });
        return texts;
    }

    getHTMLBySelector(selector) {
        return this.$(selector).html();
    }

    getTextBySelectorAndWait(selector, waitDuration, callback) {
        setTimeout(() => {
            const text = this.$(selector).text();
            if (callback) callback(text);
        }, waitDuration);
    }

    getHTMLBySelectorAndWait(selector, waitDuration, callback) {
        setTimeout(() => {
            const html = this.$(selector).html();
            if (callback) callback(html);
        }, waitDuration);
    }

    getElementsByTag(tag) {
        return this.$(tag);
    }

    getElementByXpath(xpathExpression) {
        const dom = new DOMParser().parseFromString(this.$.html());
        const result = xpath.select(xpathExpression, dom);
        return result;
    }

    getSiblingBeforeText(selector, n) {
        return this.$(selector).prevAll().eq(n).text();
    }

    getSiblingAfterText(selector, n) {
        return this.$(selector).nextAll().eq(n).text();
    }

    getDataAttributeBySelector(selector) {
        return this.$(selector).data();
    }

    getAllDataAttributesBySelector(selector) {
        const dataAttributes = [];
        this.$(selector).each((index, element) => {
            dataAttributes.push(this.$(element).data());
        });
        return dataAttributes;
    }

    countElementsBySelector(selector) {
        return this.$(selector).length;
    }

    getTextBySelectorAndIndex(selector, index) {
        return this.$(selector).eq(index).text();
    }

    getHTMLBySelectorAndIndex(selector, index) {
        return this.$(selector).eq(index).html();
    }

    getDataBySelectorAndIndex(selector, index) {
        return this.$(selector).eq(index).data();
    }

    getValueBySelectorAndIndex(selector, index) {
        return this.$(selector).eq(index).val();
    }

    replaceClassBySelector(selector, newClass) {
        this.$(selector).attr('class', newClass);
    }

    addClassBySelector(selector, newClass) {
        this.$(selector).addClass(newClass);
    }

    removeClassBySelector(selector, className) {
        this.$(selector).removeClass(className);
    }

    setStyleBySelector(selector, style) {
        this.$(selector).attr('style', style);
    }

    getElementByText(text) {
        return this.$(`*:contains("${text}")`);
    }

    getBrowserLogValues() {
        return [];
    }

    waitForElement(selector) {
        return this.$(selector).length > 0;
    }

    getHeightBySelector(selector) {
        return this.$(selector).height();
    }

    getWidthBySelector(selector) {
        return this.$(selector).width();
    }

    findIPsInHTML() {
        const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
        const html = this.$.html();
        const matches = html.match(ipRegex);
        return matches || [];
    }

    getLastIPInHTML() {
        const ips = this.findIPsInHTML();
        return ips.length > 0 ? ips[ips.length - 1] : null;
    }

    searchContentInFullHTML(content) {
        const html = this.$.html();
        return html.includes(content);
    }

    getElementsMatchingSelector(selector) {
        const elements = [];
        this.$(selector).each((index, element) => {
            elements.push({
                text: this.$(element).text(),
                html: this.$(element).html(),
                attributes: this.$(element).attr()
            });
        });
        return elements;
    }

    getChildElementsMatchingSelector(parentSelector, childSelector) {
        const elements = [];
        this.$(parentSelector).find(childSelector).each((index, element) => {
            elements.push({
                text: this.$(element).text(),
                html: this.$(element).html(),
                attributes: this.$(element).attr()
            });
        });
        return elements;
    }

    getImagesMatchingSelector(selector) {
        const images = [];
        this.$(selector).each((index, element) => {
            const src = this.$(element).attr('src');
            if (src) {
                images.push(src);
            }
        });
        return images;
    }

    getImgAttributesMatchingSelector(selector) {
        const attributes = [];
        this.$(selector).each((index, element) => {
            const imgAttributes = {
                src: this.$(element).attr('src'),
                alt: this.$(element).attr('alt'),
                title: this.$(element).attr('title'),
                width: this.$(element).attr('width'),
                height: this.$(element).attr('height')
            };
            attributes.push(imgAttributes);
        });
        return attributes;
    }

    getLinkAttributesMatchingSelector(selector) {
        const attributes = [];
        this.$(selector).each((index, element) => {
            const linkAttributes = {
                href: this.$(element).attr('href'),
                text: this.$(element).text(),
                title: this.$(element).attr('title'),
                target: this.$(element).attr('target'),
                rel: this.$(element).attr('rel')
            };
            attributes.push(linkAttributes);
        });
        return attributes;
    }
}

module.exports = HtmlParse;
