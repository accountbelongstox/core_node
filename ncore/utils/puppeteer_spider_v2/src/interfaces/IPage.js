'use strict';

const logger = require('#@logger');

class IPage {
    constructor() {
        this.page = null;
        this.isInitialized = false;
        this.url = null;
        this.title = null;
    }

    async goto(url, options = {}) {
        throw new Error('IPage.goto() must be implemented by subclass');
    }

    async click(selector, options = {}) {
        throw new Error('IPage.click() must be implemented by subclass');
    }

    async type(selector, text, options = {}) {
        throw new Error('IPage.type() must be implemented by subclass');
    }

    async screenshot(options = {}) {
        throw new Error('IPage.screenshot() must be implemented by subclass');
    }

    async evaluate(fn, ...args) {
        throw new Error('IPage.evaluate() must be implemented by subclass');
    }

    async waitForSelector(selector, options = {}) {
        throw new Error('IPage.waitForSelector() must be implemented by subclass');
    }

    async waitForFunction(fn, options = {}) {
        throw new Error('IPage.waitForFunction() must be implemented by subclass');
    }

    async getContent() {
        throw new Error('IPage.getContent() must be implemented by subclass');
    }

    async getTitle() {
        throw new Error('IPage.getTitle() must be implemented by subclass');
    }

    async getUrl() {
        throw new Error('IPage.getUrl() must be implemented by subclass');
    }

    async close() {
        throw new Error('IPage.close() must be implemented by subclass');
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            url: this.url,
            title: this.title
        };
    }
}

module.exports = IPage;
