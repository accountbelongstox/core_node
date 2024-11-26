import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import config from '../config/index.js';
import logger from '../internal/logger/logger.js';

class AssetManager {
    #templates = new Map();
    #assetsPath = path.join(config.rootDir, config.assetsPath);
    #templatesPath = path.join(config.rootDir, config.templatesPath);

    async loadTemplates() {
        try {
            const files = await fs.readdir(this.#templatesPath);
            for (const file of files) {
                if (path.extname(file) === '.hbs') {
                    const content = await fs.readFile(
                        path.join(this.#templatesPath, file),
                        'utf-8'
                    );
                    this.#templates.set(
                        path.basename(file, '.hbs'),
                        Handlebars.compile(content)
                    );
                }
            }
            logger.info('Templates loaded successfully');
        } catch (error) {
            logger.error('TemplateLoadError', error);
            throw error;
        }
    }

    getTemplate(name) {
        const template = this.#templates.get(name);
        if (!template) {
            throw new Error(`Template not found: ${name}`);
        }
        return template;
    }

    async getStaticFile(filepath) {
        try {
            return await fs.readFile(path.join(this.#assetsPath, filepath));
        } catch (error) {
            logger.error('StaticFileError', error);
            throw error;
        }
    }
}

export const assetManager = new AssetManager(); 