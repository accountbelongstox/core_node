'use strict';

const logger = require('#@logger');

class IBrowser {
    constructor() {
        this.browser = null;
        this.isLaunched = false;
        this.version = null;
    }

    async launch(options = {}) {
        throw new Error('IBrowser.launch() must be implemented by subclass');
    }

    async close() {
        throw new Error('IBrowser.close() must be implemented by subclass');
    }

    async newPage(options = {}) {
        throw new Error('IBrowser.newPage() must be implemented by subclass');
    }

    async getVersion() {
        throw new Error('IBrowser.getVersion() must be implemented by subclass');
    }

    async getPages() {
        throw new Error('IBrowser.getPages() must be implemented by subclass');
    }

    async isConnected() {
        throw new Error('IBrowser.isConnected() must be implemented by subclass');
    }

    getInfo() {
        return {
            isLaunched: this.isLaunched,
            version: this.version,
            isConnected: this.isConnected()
        };
    }
}

module.exports = IBrowser;
