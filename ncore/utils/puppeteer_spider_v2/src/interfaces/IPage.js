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
