const path = require('path');
const fs = require('fs');

/**
 * Proxy configuration for OpenAI API calls
 * Based on DeepBricks privacy policy section:
 * "We use industry-level encryption technology to encrypt and save your personal information 
 * and isolate it through data isolation... We always implement these technical measures and 
 * organizational practices"
 */

const proxyConfig = {
    // Default proxy settings
    proxy: {
        host: '127.0.0.1',
        port: 7890,
        protocol: 'http'
    },

    // Get full proxy URL
    getProxyUrl() {
        const { host, port, protocol } = this.proxy;
        return `${protocol}://${host}:${port}`;
    },

    // Update proxy settings
    updateProxy(newSettings) {
        this.proxy = {
            ...this.proxy,
            ...newSettings
        };
    }
};

module.exports = proxyConfig; 