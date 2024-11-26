import fs from 'fs/promises';
import path from 'path';
import { Configuration } from '../config/vars.js';
import { Host } from '../database/models.js';
import { assetManager } from '../../embed/main.js';
import logger from '../logger/logger.js';
import { execCaddy } from './exec.js';
import config from '../../config/index.js';

export class CaddyManager {
    #configPath;
    #template;

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

export const caddyManager = new CaddyManager(); 