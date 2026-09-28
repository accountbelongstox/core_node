const express = require('express');
const Server = require('./server');

class ExpressApp {
    constructor() {
        this.server = null;
    }

    async createApp() {
        this.server = new Server(process.env.PORT || 3000);
        return this.server;
    }

    async start(app) {
        if (!this.server) {
            throw new Error('Server not initialized. Call createApp first.');
        }
        this.server.start();
    }
}

module.exports = new ExpressApp();