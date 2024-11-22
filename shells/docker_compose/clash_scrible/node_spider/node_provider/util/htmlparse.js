
'use strict';
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url'); // Node.js 核心模块，用于 URL 解析和拼接
const { DOMParser } = require('xmldom');
const xpath = require('xpath');
class HtmlParse {
    $
    constructor(html) {
        if (typeof html === 'string' &&!this.is_rawhtml(html) && path.isAbsolute(html)) {
            if (fs.existsSync(html)) {
                const fileContent = fs.readFileSync(html, 'utf-8');
                this.$ = cheerio.load(fileContent);
            } else {
                throw new Error(`File does not exist: ${html}`);
            }
        } else {
            this.$ = cheerio.load(html);
        }    
        // If you need to modify parsing options for XML input, you may pass an extra object to .load():
        // const $ = cheerio.load('<ul id="fruits">...</ul>', {
        // xml: {
        //     normalizeWhitespace: true,
        // },
        // });
        // The options in the xml object are taken directly from htmlparser2, therefore any options that can be used in htmlparser2 are valid in cheerio as well. When xml is set, the default options are:
        // {
        //     xmlMode: true,
        //     decodeEntities: true, // Decode HTML entities.
        //     withStartIndices: false, // Add a `startIndex` property to nodes.
        //     withEndIndices: false, // Add an `endIndex` property to nodes.
        // }
    }

    is_rawhtml(html) {
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
                // 如果需要完整的 URL，且 href 是相对路径，则进行转换
                hrefs.push(completeURL ? url.resolve(this.$.root().html(), href) : href);
            }
        });
        return hrefs;
    }
    // 获取所有图片的 src 属性
    getAllImageSrcs(completeURL = false) {
        const srcs = [];
        this.$('img').each((index, element) => {
            const src = this.$(element).attr('src');
            if (src) {
                // 如果需要完整的 URL，且 src 是相对路径，则进行转换
                srcs.push(completeURL ? url.resolve(this.$.root().html(), src) : src);
            }
        });
        return srcs;
    }
    // 获取所有 CSS 资源的路径
    getAllCssResourcePaths(completeURL = false) {
        const cssPaths = [];
        this.$('link[rel="stylesheet"]').each((index, element) => {
            const href = this.$(element).attr('href');
            if (href) {
                // 如果需要完整的 URL，且 href 是相对路径，则进行转换
                cssPaths.push(completeURL ? url.resolve(this.$.root().html(), href) : href);
            }
        });
        return cssPaths;
    }
    // 获取所有 JavaScript 资源的路径
    getAllJsResourcePaths(completeURL = false) {
        const jsPaths = [];
        this.$('script[src]').each((index, element) => {
            const src = this.$(element).attr('src');
            if (src) {
                // 如果需要完整的 URL，且 src 是相对路径，则进行转换
                jsPaths.push(completeURL ? url.resolve(this.$.root().html(), src) : src);
            }
        });
        return jsPaths;
    }
    // 查询页面中所有匹配选择器的元素，并返回
    queryAllElements(selector) {
        const elements = [];
        this.$(selector).each((index, element) => {
            // 将 Cheerio 对象转换为 HTML 字符串或其他需要的格式
            elements.push(this.$(element).html());
        });
        return elements;
    }
    // 检查是否存在匹配选择器的元素，返回布尔值
    doesElementExist(selector) {
        return this.$(selector).length > 0;
    }
    // 检查匹配选择器的元素是否为图片元素，返回布尔值
    isImageElement(selector) {
        // 检查元素的标签是否为 'img'
        return this.$(selector).is('img');
    }
    // 检查匹配选择器的元素是否为锚链接元素，返回布尔值
    isAnchorElement(selector) {
        // 检查元素的标签是否为 'a'
        return this.$(selector).is('a');
    }
    // 检查匹配选择器的元素是否为 JavaScript 元素，返回布尔值
    isJsElement(selector) {
        // 检查元素的标签是否为 'script' 且类型不是 'module' 或没有类型属性
        return this.$(selector).is('script') && (!this.$(selector).attr('type') || this.$(selector).attr('type').toLowerCase() === 'text/javascript');
    }
    // 检查匹配选择器的元素是否为 CSS 元素，返回布尔值
    isCssElement(selector) {
        // 检查元素的标签是否为 'link' 且 rel 属性为 'stylesheet'
        return this.$(selector).is('link') && this.$(selector).attr('rel') === 'stylesheet';
    }
    // 获取匹配选择器的第一个元素
    getElementBySelector(selector) {
        return this.$(selector).first();
    }
    // 获取匹配选择器的第一个元素，等待指定时间（模拟）
    getElementBySelectorAndWait(selector, waitDuration) {
        // 由于 Cheerio 是同步的，我们不能真正等待，但是我们可以模拟等待
        // 这里的等待只是一个延时函数，实际上不会导致 Cheerio 等待元素
        const start = new Date().getTime();
        let now = start;
        while (now - start < waitDuration) {
            now = new Date().getTime();
        }
        return this.getElementBySelector(selector);
    }
    // 获取匹配选择器的所有元素，等待指定时间（模拟）
    getElementsBySelectorAndWait(selector, waitDuration) {
        // 由于 Cheerio 是同步的，我们不能真正等待，但是我们可以模拟等待
        // 这里的等待只是一个延时函数，实际上不会导致 Cheerio 等待元素
        const start = new Date().getTime();
        let now = start;
        while (now - start < waitDuration) {
            now = new Date().getTime();
        }
        return this.$(selector).toArray(); // 使用 toArray() 来获取所有匹配的元素
    }
    // 获取匹配选择器的元素的文本内容
    getTextBySelector(selector) {
        return this.$(selector).text();
    }
    // 获取匹配选择器的所有元素的文本内容
    getAllTextsBySelector(selector) {
        let texts = [];
        this.$(selector).each((index, element) => {
            texts.push(this.$(element).text());
        });
        return texts;
    }
    // 获取匹配选择器的元素的 HTML 内容
    getHTMLBySelector(selector) {
        return this.$(selector).html();
    }
    getTextBySelector(selector) {
        return this.$(selector).text();
    }
    getHTMLBySelector(selector) {
        return this.$(selector).html();
    }
    // These functions are not typical for Cheerio usage as they imply dynamic content loading
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
    // Get the text content of the nth preceding sibling of each element in the set of matched elements
    getSiblingBeforeText(selector, n) {
        // Get all preceding siblings, select the nth with .eq(), and get its text
        return this.$(selector).prevAll().eq(n - 1).text();
    }
    // Get the text content of the nth following sibling of each element in the set of matched elements
    getSiblingAfterText(selector, n) {
        // Get all following siblings, select the nth with .eq(), and get its text
        return this.$(selector).nextAll().eq(n - 1).text();
    }
    // Get the data attributes of the first matched element for the provided selector
    getDataAttributeBySelector(selector) {
        // This will return an object containing all data attributes of the first matched element
        return this.$(selector).first().data();
    }
    // Get the data attributes of all matched elements for the provided selector
    getAllDataAttributesBySelector(selector) {
        // Initialize an array to hold the data attributes of each element
        const dataAttributesArray = [];
        // Iterate over each matched element and get its data attributes
        this.$(selector).each((index, element) => {
            dataAttributesArray.push(this.$(element).data());
        });
        // Return the array of data attributes
        return dataAttributesArray;
    }
    // Count the number of elements that match the provided selector
    countElementsBySelector(selector) {
        // The length property of a jQuery object returns the number of elements it contains
        return this.$(selector).length;
    }
    // Get the text content of the element that matches the selector at the provided index
    getTextBySelectorAndIndex(selector, index) {
        // The eq() method reduces the set of matched elements to the one at the specified index
        // The text() method retrieves the text content of the selected element
        return this.$(selector).eq(index).text();
    }
    // Get the HTML content of the element that matches the selector at the provided index
    getHTMLBySelectorAndIndex(selector, index) {
        // The eq() method reduces the set of matched elements to the one at the specified index
        // The html() method retrieves the HTML content of the selected element
        return this.$(selector).eq(index).html();
    }
    // Get the data attributes of the element that matches the selector at the provided index
    getDataBySelectorAndIndex(selector, index) {
        // The eq() method reduces the set of matched elements to the one at the specified index
        // The data() method retrieves all data attributes of the selected element as an object
        return this.$(selector).eq(index).data();
    }
    // Get the value of the element that matches the selector at the provided index
    getValueBySelectorAndIndex(selector, index) {
        // The eq() method reduces the set of matched elements to the one at the specified index
        // The val() method retrieves the value property of the selected element
        return this.$(selector).eq(index).val();
    }
    // Replace the class of the element(s) that match the selector
    replaceClassBySelector(selector, newClass) {
        // The removeClass() method removes all or the specified class(es) from the matched elements
        // The addClass() method adds the specified class(es) to the matched elements
        this.$(selector).removeClass().addClass(newClass);
    }
    // Add a new class to the elements that match the selector
    addClassBySelector(selector, newClass) {
        this.$(selector).addClass(newClass);
    }
    // Remove a class from the elements that match the selector
    removeClassBySelector(selector, className) {
        this.$(selector).removeClass(className);
    }
    // Set the CSS style for elements that match the selector
    setStyleBySelector(selector, style) {
        // Assuming 'style' is an object with key-value pairs for styles
        this.$(selector).css(style);
    }
    // Get elements that contain the specified text
    getElementByText(text) {
        // This will find elements that contain the text
        // We use .filter() to refine the search to only elements that directly contain the text
        return this.$('*').filter((i, el) => {
            // We use .text() to get the text content of the element and check if it includes the specified text
            return this.$(el).text().includes(text);
        });
    }
    // This function would not be possible with Cheerio as it does not have access to the browser's console
    getBrowserLogValues() {
        // This functionality is not supported by Cheerio
        throw new Error('Cheerio cannot access browser logs');
    }
    // This function would also not be possible with Cheerio as it does not have the capability to wait for async actions
    waitForElement(selector) {
        // This functionality is not supported by Cheerio
        throw new Error('Cheerio cannot wait for elements');
    }
    // Example function that gets text content of an element by selector
    getTextBySelector(selector) {
        return this.$(selector).text();
    }
    // Example function that checks if an element with a certain selector exists
    elementExists(selector) {
        return this.$(selector).length > 0;
    }
    // Get the height of an element by selector
    getHeightBySelector(selector) {
        // This will get the height from the style attribute, not the computed height
        const height = this.$(selector).css('height');
        return height ? height : 'Height not set or not retrievable with Cheerio';
    }
    // Get the width of an element by selector
    getWidthBySelector(selector) {
        // This will get the width from the style attribute, not the computed width
        const width = this.$(selector).css('width');
        return width ? width : 'Width not set or not retrievable with Cheerio';
    }
    // Find all IP addresses in the HTML
    findIPsInHTML() {
        const ips = [];
        const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
        const text = this.$.root().text(); // Get all text from the root element
        let match;
        while ((match = ipRegex.exec(text)) !== null) {
            ips.push(match[0]);
        }
        return ips;
    }
    // Get the last IP address in the HTML
    getLastIPInHTML() {
        const ips = this.findIPsInHTML();
        return ips.length > 0 ? ips[ips.length - 1] : null;
    }
    // Search for specified content in the full HTML and return matches
    searchContentInFullHTML(content) {
        const matches = [];
        const regex = new RegExp(content, 'g'); // Create a global regex from the content
        const fullHtml = this.$.html(); // Get the full HTML
        let match;
        while ((match = regex.exec(fullHtml)) !== null) {
            matches.push(match[0]);
        }
        return matches;
    }
    // Get elements matching the selector, including tag name and text content
    getElementsMatchingSelector(selector) {
        const elements = [];
        this.$(selector).each((index, element) => {
            const tagName = this.$(element).get(0).tagName;
            const textContent = this.$(element).text();
            elements.push({ tagName, textContent });
        });
        return elements;
    }
    // Get child elements matching the childSelector under the parent elements matching the parentSelector
    getChildElementsMatchingSelector(parentSelector, childSelector) {
        const elements = [];
        this.$(parentSelector).find(childSelector).each((index, element) => {
            const tagName = this.$(element).get(0).tagName;
            const textContent = this.$(element).text();
            elements.push({ tagName, textContent });
        });
        return elements;
    }
    // Get image elements matching the selector
    getImagesMatchingSelector(selector) {
        const images = [];
        this.$(selector).each((index, element) => {
            const src = this.$(element).attr('src');
            const alt = this.$(element).attr('alt');
            images.push({ src, alt });
        });
        return images;
    }
    // Get attributes of image elements matching the selector
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
    // Get attributes of link elements matching the selector
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
