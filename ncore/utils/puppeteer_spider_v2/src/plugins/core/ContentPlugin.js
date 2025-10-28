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
const IPlugin = require('../interfaces/IPlugin');

class ContentPlugin extends IPlugin {
    constructor() {
        super();
        this.name = 'content';
        this.version = '1.0.0';
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            this.isInitialized = true;
            logger.info(`ContentPlugin initialized for spider: ${spider.id}`);
        } catch (error) {
            logger.error('Failed to initialize ContentPlugin:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.isInitialized = false;
            logger.info('ContentPlugin cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup ContentPlugin:', error);
        }
    }

    async extractText(page) {
        try {
            return await page.evaluate(() => {
                return document.body.innerText;
            });
        } catch (error) {
            logger.error('Failed to extract text:', error);
            throw error;
        }
    }

    async extractHTML(page) {
        try {
            return await page.evaluate(() => {
                return document.documentElement.outerHTML;
            });
        } catch (error) {
            logger.error('Failed to extract HTML:', error);
            throw error;
        }
    }

    async extractImages(page) {
        try {
            return await page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('img'));
                return images.map(img => ({
                    src: img.src,
                    alt: img.alt,
                    width: img.width,
                    height: img.height
                }));
            });
        } catch (error) {
            logger.error('Failed to extract images:', error);
            throw error;
        }
    }

    async extractLinks(page) {
        try {
            return await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'));
                return links.map(link => ({
                    href: link.href,
                    text: link.textContent.trim(),
                    title: link.title
                }));
            });
        } catch (error) {
            logger.error('Failed to extract links:', error);
            throw error;
        }
    }

    async extractForms(page) {
        try {
            return await page.evaluate(() => {
                const forms = Array.from(document.querySelectorAll('form'));
                return forms.map(form => ({
                    action: form.action,
                    method: form.method,
                    inputs: Array.from(form.querySelectorAll('input')).map(input => ({
                        type: input.type,
                        name: input.name,
                        value: input.value,
                        placeholder: input.placeholder
                    }))
                }));
            });
        } catch (error) {
            logger.error('Failed to extract forms:', error);
            throw error;
        }
    }

    async extractMeta(page) {
        try {
            return await page.evaluate(() => {
                const meta = Array.from(document.querySelectorAll('meta'));
                const result = {};
                
                meta.forEach(metaTag => {
                    const name = metaTag.getAttribute('name') || metaTag.getAttribute('property');
                    const content = metaTag.getAttribute('content');
                    
                    if (name && content) {
                        result[name] = content;
                    }
                });
                
                return result;
            });
        } catch (error) {
            logger.error('Failed to extract meta:', error);
            throw error;
        }
    }

    async extractAll(page) {
        try {
            const [text, html, images, links, forms, meta] = await Promise.all([
                this.extractText(page),
                this.extractHTML(page),
                this.extractImages(page),
                this.extractLinks(page),
                this.extractForms(page),
                this.extractMeta(page)
            ]);

            return {
                text,
                html,
                images,
                links,
                forms,
                meta,
                url: await page.getUrl(),
                title: await page.getTitle(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Failed to extract all content:', error);
            throw error;
        }
    }
}

module.exports = ContentPlugin;
