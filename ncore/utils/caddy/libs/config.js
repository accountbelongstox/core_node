const fs = require('fs').promises;
const { CADDY_PATHS, CADDY_PORTS } = require('../provider/constants');
const logger = require('../../logger');

class CaddyConfig {
    /**
     * Change Caddy's HTTP port
     * @param {number} port New port number
     * @returns {Promise<boolean>} Success status
     */
    static async changeHttpPort(port) {
        try {
            let config = await fs.readFile(CADDY_PATHS.CONFIG, 'utf8');
            // Replace default HTTP port
            config = config.replace(
                new RegExp(`:${CADDY_PORTS.HTTP}\\b`, 'g'),
                `:${port}`
            );
            await fs.writeFile(CADDY_PATHS.CONFIG, config);
            logger.success(`Changed HTTP port to ${port}`);
            return true;
        } catch (error) {
            logger.error('Failed to change HTTP port:', error.message);
            return false;
        }
    }

    /**
     * Set custom error page
     * @param {string} statusCode HTTP status code
     * @param {string} pagePath Path to error page
     * @returns {Promise<boolean>} Success status
     */
    static async setErrorPage(statusCode, pagePath) {
        try {
            let config = await fs.readFile(CADDY_PATHS.CONFIG, 'utf8');
            const errorDirective = `
    handle_errors {
        rewrite * /${statusCode}.html
        file_server
    }`;
            
            if (!config.includes('handle_errors')) {
                config += errorDirective;
            } else {
                config = config.replace(
                    /handle_errors {[\s\S]*?}/,
                    errorDirective
                );
            }
            
            await fs.writeFile(CADDY_PATHS.CONFIG, config);
            // Copy error page to www root
            await fs.copyFile(pagePath, `${CADDY_PATHS.WWW_ROOT}/${statusCode}.html`);
            logger.success(`Set custom ${statusCode} error page`);
            return true;
        } catch (error) {
            logger.error('Failed to set error page:', error.message);
            return false;
        }
    }

    /**
     * Add reverse proxy configuration
     * @param {string} domain Domain name
     * @param {string} target Target URL
     * @returns {Promise<boolean>} Success status
     */
    static async addReverseProxy(domain, target) {
        try {
            const proxyConfig = `
${domain} {
    reverse_proxy ${target}
}`;
            await fs.appendFile(CADDY_PATHS.CONFIG, proxyConfig);
            logger.success(`Added reverse proxy for ${domain} -> ${target}`);
            return true;
        } catch (error) {
            logger.error('Failed to add reverse proxy:', error.message);
            return false;
        }
    }

    /**
     * Set CORS headers
     * @param {string} domain Domain name
     * @param {string[]} origins Allowed origins
     * @returns {Promise<boolean>} Success status
     */
    static async setCORS(domain, origins) {
        try {
            const corsConfig = `
${domain} {
    header Access-Control-Allow-Origin "${origins.join(' ')}"
    header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "*"
}`;
            await fs.appendFile(CADDY_PATHS.CONFIG, corsConfig);
            logger.success(`Set CORS headers for ${domain}`);
            return true;
        } catch (error) {
            logger.error('Failed to set CORS headers:', error.message);
            return false;
        }
    }
}

module.exports = CaddyConfig; 