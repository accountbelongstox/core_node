'use strict';
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { DOMParser } = require('xmldom');
const xpath = require('xpath');
import Base from '#@base';

class HtmlParse extends Base {
    constructor(html) {
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
                hrefs.push(completeURL ? url.resolve(this.$.root().html(), href) : href);
            }
        });
        return hrefs;
    }

    getAllImageSrcs(completeURL = false) {
        const srcs = [];
        this.$('img').each((index, element) => {
            const src = this.$(element).attr('src');
            if (src) {
                srcs.push(completeURL ? url.resolve(this.$.root().html(), src) : src);
            }
        });
        return srcs;
    }

    getAllCssResourcePaths(completeURL = false) {
        const cssPaths = [];
        this.$('link[rel="stylesheet"]').each((index, element) => {
            const href = this.$(element).attr('href');
            if (href) {
                cssPaths.push(completeURL ? url.resolve(this.$.root().html(), href) : href);
            }
        });
        return cssPaths;
    }

    getAllJsResourcePaths(completeURL = false) {
        const jsPaths = [];
        this.$('script[src]').each((index, element) => {
            const src = this.$(element).attr('src');
            if (src) {
                jsPaths.push(completeURL ? url.resolve(this.$.root().html(), src) : src);
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

    isAnchorElement(selector) {
        return this.$(selector).is('a');
    }

    isJsElement(selector) {
        return this.$(selector).is('script') && (!this.$(selector).attr('type') || this.$(selector).attr('type').toLowerCase() === 'text/javascript');
    }

    isCssElement(selector) {
        return this.$(selector).is('link') && this.$(selector).attr('rel') === 'stylesheet';
    }

    getElementBySelector(selector) {
        return this.$(selector).first();
    }

    getElementBySelectorAndWait(selector, waitDuration) {
        const start = new Date().getTime();
        let now = start;
        while (now - start < waitDuration) {
            now = new Date().getTime();
        }
        return this.getElementBySelector(selector);
    }

    getElementsBySelectorAndWait(selector, waitDuration) {
        const start = new Date().getTime();
        let now = start;
        while (now - start < waitDuration) {
            now = new Date().getTime();
        }
        return this.$(selector).toArray();
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
            const text = this.getTextBySelector(selector);
            callback(text);
        }, waitDuration);
    }

    getHTMLBySelectorAndWait(selector, waitDuration, callback) {
        setTimeout(() => {
            const html = this.getHTMLBySelector(selector);
            callback(html);
        }, waitDuration);
    }

    getElementsByTag(tag) {
        return this.$(tag).toArray().map(el => this.$(el));
    }

    getElementByXpath(xpathExpression) {
        if (!this.dom) this.dom = new DOMParser().parseFromString(html);
        const nodes = xpath.select(xpathExpression, this.dom);
        return nodes[0] ? this.$(nodes[0]) : null;
    }

    getSiblingBeforeText(selector, n) {
        return this.$(selector).prevAll().eq(n - 1).text();
    }

    getSiblingAfterText(selector, n) {
        return this.$(selector).nextAll().eq(n - 1).text();
    }

    getDataAttributeBySelector(selector) {
        return this.$(selector).first().data();
    }

    getAllDataAttributesBySelector(selector) {
        const dataAttributesArray = [];
        this.$(selector).each((index, element) => {
            dataAttributesArray.push(this.$(element).data());
        });
        return dataAttributesArray;
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
        this.$(selector).removeClass().addClass(newClass);
    }

    addClassBySelector(selector, newClass) {
        this.$(selector).addClass(newClass);
    }

    removeClassBySelector(selector, className) {
        this.$(selector).removeClass(className);
    }

    setStyleBySelector(selector, style) {
        this.$(selector).css(style);
    }

    getElementByText(text) {
        return this.$('*').filter((i, el) => {
            return this.$(el).text().includes(text);
        });
    }

    getBrowserLogValues() {
        throw new Error('Cheerio cannot access browser logs');
    }

    waitForElement(selector) {
        throw new Error('Cheerio cannot wait for elements');
    }

    getHeightBySelector(selector) {
        const height = this.$(selector).css('height');
        return height ? height : 'Height not set or not retrievable with Cheerio';
    }

    getWidthBySelector(selector) {
        const width = this.$(selector).css('width');
        return width ? width : 'Width not set or not retrievable with Cheerio';
    }

    findIPsInHTML() {
        const ips = [];
        const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
        const text = this.$.root().text();
        let match;
        while ((match = ipRegex.exec(text)) !== null) {
            ips.push(match[0]);
        }
        return ips;
    }

    getLastIPInHTML() {
        const ips = this.findIPsInHTML();
        return ips.length > 0 ? ips[ips.length - 1] : null;
    }

    searchContentInFullHTML(content) {
        const matches = [];
        const regex = new RegExp(content, 'g');
        const fullHtml = this.$.html();
        let match;
        while ((match = regex.exec(fullHtml)) !== null) {
            matches.push(match[0]);
        }
        return matches;
    }

    getElementsMatchingSelector(selector) {
        const elements = [];
        this.$(selector).each((index, element) => {
            const tagName = this.$(element).get(0).tagName;
            const textContent = this.$(element).text();
            elements.push({ tagName, textContent });
        });
        return elements;
    }

    getChildElementsMatchingSelector(parentSelector, childSelector) {
        const elements = [];
        this.$(parentSelector).find(childSelector).each((index, element) => {
            const tagName = this.$(element).get(0).tagName;
            const textContent = this.$(element).text();
            elements.push({ tagName, textContent });
        });
        return elements;
    }

    getImagesMatchingSelector(selector) {
        const images = [];
        this.$(selector).each((index, element) => {
            const src = this.$(element).attr('src');
            const alt = this.$(element).attr('alt');
            images.push({ src, alt });
        });
        return images;
    }

    getImgAttributesMatchingSelector(selector) {
        const images = [];
        this.$(selector).each((index, element) => {
            const img = this.$(element);
            images.push({
                src: img.attr('src'),
                class: img.attr('class'),
                dataAttr: img.data(),
                id: img.attr('id'),
                alt: img.attr('alt')
            });
        });
        return images;
    }

    getLinkAttributesMatchingSelector(selector) {
        const links = [];
        this.$(selector).each((index, element) => {
            const link = this.$(element);
            links.push({
                href: link.attr('href'),
                class: link.attr('class'),
                dataAttr: link.data(),
                id: link.attr('id'),
                textInner: link.text()
            });
        });
        return links;
    }
}

module.exports = HtmlParse;
