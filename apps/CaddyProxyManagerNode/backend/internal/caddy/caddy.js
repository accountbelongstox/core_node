const fs = require('fs/promises');
    const path = require('path');
    const { Configuration } = require('../config/vars.js');
    const { Host } = require('../database/models.js');
    const { assetManager } = require('../../embed/main.js');
    const logger = require('../logger/logger.js');
    const { execCaddy } = require('./exec.js');
    const config = require('../../config/index.js');

    class CaddyManager {
        constructor() {
            this.#configPath = config.caddyFile;
        }

        async init() {
            try {
                await assetManager.loadTemplates();
                this.#template = assetManager.getTemplate('host');
            } catch (error) {
                logger.error('CaddyTemplateError', error);
                throw error;
            }
        }

        async generateConfig() {
            const hosts = await Host.findAll({
                include: ['Upstreams']
            });

            const config = hosts.map(host => this.#template({
                domains: host.domains,
                matcher: host.matcher,
                upstreams: host.Upstreams.map(u => u.backend)
            })).join('\n\n');

            await fs.writeFile(this.#configPath, config);
        }

        async reload() {
            try {
                await this.generateConfig();
                await execCaddy(['reload']);
                logger.info('Caddy configuration reloaded');
            } catch (error) {
                logger.error('CaddyReloadError', error);
                throw error;
            }
        }
    }

    const caddyManager = new CaddyManager();

    module.exports = { caddyManager };