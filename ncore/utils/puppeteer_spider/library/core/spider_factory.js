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

// Declare variables
let factoryCounter = 0;

class SpiderFactory {
    constructor() {
        this.templates = new Map();
        this.presets = new Map();
        this.isInitialized = false;
        
        this.initializePresets();
    }

    initializePresets() {
        // Browser presets
        this.presets.set('edge', {
            browser: 'edge',
            headless: true,
            viewport: { width: 1920, height: 1080 }
        });

        this.presets.set('chrome', {
            browser: 'chrome',
            headless: true,
            viewport: { width: 1920, height: 1080 }
        });

        // Display presets
        this.presets.set('headless', {
            headless: true
        });

        this.presets.set('visible', {
            headless: false
        });

        // Device presets
        this.presets.set('mobile', {
            viewport: { width: 375, height: 667 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        });

        this.presets.set('tablet', {
            viewport: { width: 768, height: 1024 },
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        });

        this.presets.set('desktop', {
            viewport: { width: 1920, height: 1080 }
        });

        // Performance presets
        this.presets.set('fast', {
            timeout: 10000,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        this.presets.set('slow', {
            timeout: 60000,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Use case presets
        this.presets.set('scraping', {
            headless: true,
            timeout: 30000,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        this.presets.set('testing', {
            headless: false,
            timeout: 30000,
            devtools: true
        });

        this.presets.set('automation', {
            headless: false,
            timeout: 30000,
            slowMo: 100
        });

        logger.info('SpiderFactory presets initialized');
    }

    create(options = {}) {
        try {
            const spiderId = `spider_${++factoryCounter}_${Date.now()}`;
            
            // Merge options with presets
            const mergedOptions = this.mergeOptions(options);
            
            // Create spider instance
            const Spider = require('../main').Spider;
            const spider = new Spider(mergedOptions);
            
            logger.info(`Spider created: ${spiderId}`);
            
            return spider;
        } catch (error) {
            logger.error(`Failed to create spider: ${error.message}`);
            throw error;
        }
    }

    async createAndInitialize(options = {}) {
        try {
            const spider = this.create(options);
            await spider.initialize();
            
            logger.info('Spider created and initialized');
            
            return spider;
        } catch (error) {
            logger.error(`Failed to create and initialize spider: ${error.message}`);
            throw error;
        }
    }

    // Preset-based creation methods
    createHeadless(options = {}) {
        return this.create({ ...this.presets.get('headless'), ...options });
    }

    createVisible(options = {}) {
        return this.create({ ...this.presets.get('visible'), ...options });
    }

    createChrome(options = {}) {
        return this.create({ ...this.presets.get('chrome'), ...options });
    }

    createEdge(options = {}) {
        return this.create({ ...this.presets.get('edge'), ...options });
    }

    createMobile(options = {}) {
        return this.create({ ...this.presets.get('mobile'), ...options });
    }

    createTablet(options = {}) {
        return this.create({ ...this.presets.get('tablet'), ...options });
    }

    createDesktop(options = {}) {
        return this.create({ ...this.presets.get('desktop'), ...options });
    }

    createFast(options = {}) {
        return this.create({ ...this.presets.get('fast'), ...options });
    }

    createSlow(options = {}) {
        return this.create({ ...this.presets.get('slow'), ...options });
    }

    createForScraping(options = {}) {
        return this.create({ ...this.presets.get('scraping'), ...options });
    }

    createForTesting(options = {}) {
        return this.create({ ...this.presets.get('testing'), ...options });
    }

    createForAutomation(options = {}) {
        return this.create({ ...this.presets.get('automation'), ...options });
    }

    // Plugin-based creation
    createWithPlugins(plugins, options = {}) {
        return this.create({ ...options, plugins });
    }

    // Template-based creation
    createFromTemplate(templateName, options = {}) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        
        return this.create({ ...template, ...options });
    }

    // Template management
    registerTemplate(name, template) {
        try {
            if (!name || !template) {
                throw new Error('Template name and template object are required');
            }
            
            this.templates.set(name, template);
            logger.info(`Template registered: ${name}`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to register template ${name}: ${error.message}`);
            throw error;
        }
    }

    unregisterTemplate(name) {
        try {
            if (!this.templates.has(name)) {
                throw new Error(`Template ${name} not found`);
            }
            
            this.templates.delete(name);
            logger.info(`Template unregistered: ${name}`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to unregister template ${name}: ${error.message}`);
            throw error;
        }
    }

    getTemplate(name) {
        return this.templates.get(name);
    }

    getTemplateNames() {
        return Array.from(this.templates.keys());
    }

    // Preset management
    registerPreset(name, preset) {
        try {
            if (!name || !preset) {
                throw new Error('Preset name and preset object are required');
            }
            
            this.presets.set(name, preset);
            logger.info(`Preset registered: ${name}`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to register preset ${name}: ${error.message}`);
            throw error;
        }
    }

    unregisterPreset(name) {
        try {
            if (!this.presets.has(name)) {
                throw new Error(`Preset ${name} not found`);
            }
            
            this.presets.delete(name);
            logger.info(`Preset unregistered: ${name}`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to unregister preset ${name}: ${error.message}`);
            throw error;
        }
    }

    getPreset(name) {
        return this.presets.get(name);
    }

    getPresetNames() {
        return Array.from(this.presets.keys());
    }

    // Utility methods
    mergeOptions(options) {
        let merged = { ...options };
        
        // Apply presets in order
        if (options.presets && Array.isArray(options.presets)) {
            options.presets.forEach(presetName => {
                const preset = this.presets.get(presetName);
                if (preset) {
                    merged = { ...preset, ...merged };
                }
            });
        }
        
        return merged;
    }

    getInfo() {
        return {
            totalTemplates: this.templates.size,
            totalPresets: this.presets.size,
            templates: this.getTemplateNames(),
            presets: this.getPresetNames()
        };
    }
}

module.exports = SpiderFactory;
