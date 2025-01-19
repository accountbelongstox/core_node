const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../gvar/basic/logger');
const { 
    CADDY_PATHS, 
    CADDY_USER, 
    CADDY_MODES,
    resolveWwwRoot 
} = require('../provider/constants');
const CaddyService = require('./service');

class CaddyManager {
    /**
     * Add single domain configuration
     * @param {string} domain Domain name
     * @param {string} [wwwRoot] Optional web root directory (relative to WWW_ROOT)
     * @param {Object} options Additional options
     * @returns {Promise<boolean>} Success status
     */
    static async addDomain(domain, wwwRoot = null, options = {}) {
        try {
            // Resolve www root path
            const absoluteWwwRoot = resolveWwwRoot(wwwRoot, domain);
            
            // Ensure www root exists
            await fs.mkdir(absoluteWwwRoot, { recursive: true });
            await execSync(`chown -R ${CADDY_USER.USER}:${CADDY_USER.GROUP} ${absoluteWwwRoot}`);
            await execSync(`chmod ${CADDY_MODES.DIR} ${absoluteWwwRoot}`);

            // Create domain configuration
            const config = this.generateDomainConfig(domain, absoluteWwwRoot, options);
            
            // Add to Caddyfile
            await fs.appendFile(CADDY_PATHS.CONFIG, config);
            
            logger.success(`Added domain ${domain} with root ${absoluteWwwRoot}`);
            
            // Reload Caddy
            return await this.reloadConfig();
        } catch (error) {
            logger.error('Failed to add domain:', error.message);
            return false;
        }
    }

    /**
     * Add multiple domains configuration
     * @param {Array<{domain: string, wwwRoot?: string, options?: Object}>} domains Domain configurations
     * @returns {Promise<boolean>} Success status
     */
    static async addDomains(domains) {
        try {
            let configContent = '';

            // Process each domain
            for (const { domain, wwwRoot = null, options = {} } of domains) {
                // Resolve www root path
                const absoluteWwwRoot = resolveWwwRoot(wwwRoot, domain);
                
                // Ensure www root exists
                await fs.mkdir(absoluteWwwRoot, { recursive: true });
                await execSync(`chown -R ${CADDY_USER.USER}:${CADDY_USER.GROUP} ${absoluteWwwRoot}`);
                await execSync(`chmod ${CADDY_MODES.DIR} ${absoluteWwwRoot}`);

                // Generate and append config
                configContent += this.generateDomainConfig(domain, absoluteWwwRoot, options);
                
                logger.success(`Added domain ${domain} with root ${absoluteWwwRoot}`);
            }

            // Add all configurations to Caddyfile
            await fs.appendFile(CADDY_PATHS.CONFIG, configContent);

            // Reload Caddy
            return await this.reloadConfig();
        } catch (error) {
            logger.error('Failed to add domains:', error.message);
            return false;
        }
    }

    /**
     * Generate domain configuration
     * @private
     */
    static generateDomainConfig(domain, wwwRoot, options = {}) {
        const {
            gzip = true,
            logs = true,
            cors = false,
            corsOrigins = ['*'],
            php = false,
            ssl = true
        } = options;

        let config = `\n${domain} {\n`;
        config += `    root * ${wwwRoot}\n`;
        
        if (gzip) {
            config += '    encode gzip\n';
        }

        if (logs) {
            config += `    log {\n`;
            config += `        output file ${CADDY_PATHS.LOG_DIR}/${domain}.log\n`;
            config += `    }\n`;
        }

        if (cors) {
            config += `    header Access-Control-Allow-Origin "${corsOrigins.join(' ')}"\n`;
            config += `    header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"\n`;
            config += `    header Access-Control-Allow-Headers "*"\n`;
        }

        if (php) {
            config += `    php_fastcgi unix//run/php/php-fpm.sock\n`;
        }

        if (!ssl) {
            config += `    tls off\n`;
        }

        config += '    file_server\n';
        config += '}\n';

        return config;
    }

    /**
     * Reload Caddy configuration
     * @private
     */
    static async reloadConfig() {
        try {
            // Validate configuration
            await execSync(`${CADDY_PATHS.BIN} validate --config ${CADDY_PATHS.CONFIG}`);
            
            // Reload service
            return await CaddyService.restart();
        } catch (error) {
            logger.error('Failed to reload Caddy:', error.message);
            return false;
        }
    }
}

module.exports = CaddyManager; 