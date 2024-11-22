class PageHelper {
    constructor() {
    }
    
    waitForPageLoad(){
        
    }

    getFullPageOuterHTMLAndWait() {
        waitForPageLoad();
        return document.documentElement.outerHTML;
    }

    getFullPageOuterHTML() {
        return document.documentElement.outerHTML;
    }

    getAllAnchorHrefs(completeURL = false) {
        const anchorElements = document.querySelectorAll('a');
        const hrefs = Array.from(anchorElements).map(a => completeURL ? new URL(a.href, window.location.origin).href : a.href);
        return hrefs;
    }

    getAllImageSrcs(completeURL = false) {
        const imgElements = document.querySelectorAll('img');
        const srcs = Array.from(imgElements).map(img => completeURL ? new URL(img.src, window.location.origin).href : img.src);
        return srcs;
    }

    getAllCssResourcePaths(completeURL = false) {
        const cssElements = document.querySelectorAll('link[rel="stylesheet"]');
        const paths = Array.from(cssElements).map(link => completeURL ? new URL(link.href, window.location.origin).href : link.href);
        return paths;
    }

    getAllJsResourcePaths(completeURL = false) {
        const jsElements = document.querySelectorAll('script[src]');
        const paths = Array.from(jsElements).map(script => completeURL ? new URL(script.src, window.location.origin).href : script.src);
        return paths;
    }

    queryAllElements(selector) {
        return document.querySelectorAll(selector);
    }

    isImageElement(selector) {
        const element = document.querySelector(selector);
        return element && element.tagName.toLowerCase() === 'img';
    }

    isAnchorElement(selector) {
        const element = document.querySelector(selector);
        return element && element.tagName.toLowerCase() === 'a';
    }

    isJsElement(selector) {
        const element = document.querySelector(selector);
        return element && element.tagName.toLowerCase() === 'script';
    }

    isCssElement(selector) {
        const element = document.querySelector(selector);
        return element && element.tagName.toLowerCase() === 'link' && element.rel.toLowerCase() === 'stylesheet';
    }

    getElementBySelector(selector) {
        return document.querySelector(selector);
    }

    getElementBySelectorAndWait(selector, waitDuration = 5000) {
        const startTime = Date.now();
        let element;
        do {
            element = document.querySelector(selector);
        } while (!element && Date.now() - startTime < waitDuration);
        return element;
    }

    getElementsBySelectorAndWait(selector, waitDuration = 5000) {
        const startTime = Date.now();
        let elements;
        do {
            elements = document.querySelectorAll(selector);
        } while (elements.length === 0 && Date.now() - startTime < waitDuration);
        return elements;
    }

    getTextBySelector(selector) {
        const element = document.querySelector(selector);
        return element ? element.textContent : null;
    }

    getAllTextsBySelector(selector) {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements, element => element.textContent);
    }

    getHTMLBySelector(selector) {
        const element = document.querySelector(selector);
        return element ? element.innerHTML : null;
    }

    getTextBySelectorAndWait(selector, waitDuration = 5000) {
        const startTime = Date.now();
        let text;
        do {
            const element = document.querySelector(selector);
            text = element ? element.textContent : null;
        } while (text === null && Date.now() - startTime < waitDuration);
        return text;
    }

    getHTMLBySelectorAndWait(selector, waitDuration = 5000) {
        const startTime = Date.now();
        let html;
        do {
            const element = document.querySelector(selector);
            html = element ? element.innerHTML : null;
        } while (html === null && Date.now() - startTime < waitDuration);
        return html;
    }

    getElementsByTag(tag) {
        return document.getElementsByTagName(tag);
    }

    getElementByXpath(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    getSiblingBeforeText(selector, n = 0) {
        const element = document.querySelector(selector);
        const sibling = element ? element.previousElementSibling : null;
        return sibling ? sibling.textContent : null;
    }

    getSiblingAfterText(selector, n = 0) {
        const element = document.querySelector(selector);
        const sibling = element ? element.nextElementSibling : null;
        return sibling ? sibling.textContent : null;
    }

    getDataAttributeBySelector(selector) {
        const element = document.querySelector(selector);
        return element ? element.dataset : null;
    }

    getAllDataAttributesBySelector(selector) {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements, element => element.dataset);
    }

    countElementsBySelector(selector) {
        const elements = document.querySelectorAll(selector);
        return elements.length;
    }

    getTextBySelectorAndIndex(selector, index = 0) {
        const elements = document.querySelectorAll(selector);
        const element = elements[index];
        return element ? element.textContent : null;
    }

    getHTMLBySelectorAndIndex(selector, index = 0) {
        const elements = document.querySelectorAll(selector);
        const element = elements[index];
        return element ? element.innerHTML : null;
    }

    getDataBySelectorAndIndex(selector, index = 0) {
        const elements = document.querySelectorAll(selector);
        const element = elements[index];
        return element ? element.dataset : null;
    }

    getValueBySelectorAndIndex(selector, index = 0) {
        const elements = document.querySelectorAll(selector);
        const element = elements[index];
        return element ? element.value : null;
    }

    getElementByText(text) {
        const elements = Array.from(document.querySelectorAll('*')).filter(element => element.textContent === text);
        return elements.length > 0 ? elements[0] : null;
    }

    getBrowserLogValues() {
        const logValues = [];
        const consoleLog = console.log;
        console.log = function () {
            logValues.push.apply(logValues, arguments);
            consoleLog.apply(console, arguments);
        };
        console.log = consoleLog;
        return logValues;
    }

    replaceClassBySelector(selector, newClass) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.className = newClass;
        });
    }

    addClassBySelector(selector, newClass) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (!element.classList.contains(newClass)) {
                element.classList.add(newClass);
            }
        });
    }

    removeClassBySelector(selector, className) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.classList.remove(className);
        });
    }

    setStyleBySelector(selector, style) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            Object.assign(element.style, style);
        });
    }

    getCurrentPage() {
        return this.currentPage;
    }

    waitForElement(selector) {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                }
            }, 100);
        });
    }

    waitForCallback(selector, callback, timeout = 2000) {
        const startTime = Date.now();
        const checkCallback = () => {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
            } else if (Date.now() - startTime < timeout) {
                setTimeout(checkCallback, 100);
            }
        };

        checkCallback();
    }

    findIPsInHTML() {
        const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
        const htmlContent = document.documentElement.innerHTML;
        return htmlContent.match(ipRegex) || [];
    }

    getLastIPInHTML() {
        const ips = this.findIPsInHTML();
        return ips.length > 0 ? ips[ips.length - 1] : null;
    }

    searchContentInFullHTML(content) {
        const htmlContent = document.documentElement.innerHTML;
        return htmlContent.includes(content);
    }

    getChildElementsMatchingSelector(parentSelector, childSelector) {
        const parentElement = document.querySelector(parentSelector);
        return parentElement ? Array.from(parentElement.querySelectorAll(childSelector)) : [];
    }

    getHeightBySelector(selector) {
        const element = document.querySelector(selector);
        return element ? element.clientHeight : 0;
    }

    getWidthBySelector(selector) {
        const element = document.querySelector(selector);
        return element ? element.clientWidth : 0;
    }

}

export default PageHelper;
