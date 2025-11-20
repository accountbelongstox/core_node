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
const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor(config = {}) {
        this.config = this.mergeConfigs(this.getDefaultConfig(), config);
        this.presets = new Map();
        this.isInitialized = false;
    }

    getDefaultConfig() {
        return {
            browser: 'edge',
            headless: false,
            viewport: {
                width: 1920,
                height: 1080
            },
            timeout: 30000,
            retries: 3,
            delay: 1000,
            userAgent: null,
            proxy: null,
            cookies: [],
            localStorage: {},
            sessionStorage: {},
            browserOptions: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                ignoreDefaultArgs: false,
                ignoreHTTPSErrors: true,
                slowMo: 0
            },
            sessionOptions: {
                maxPages: 10,
                maxConcurrentRequests: 5,
                requestTimeout: 30000
            },
            plugins: {
                download: {
                    enabled: true,
                    path: './downloads',
                    overwrite: false
                },
                content: {
                    enabled: true,
                    extractImages: true,
                    extractLinks: true
                },
                automation: {
                    enabled: true,
                    waitTimeout: 5000,
                    retryAttempts: 3
                }
            }
        };
    }

    async load() {
        try {
            logger.info('Loading configuration...');
            
            // Load preset configurations
            await this.loadPresets();
            
            // Load environment-specific config
            await this.loadEnvironmentConfig();
            
            this.isInitialized = true;
            logger.info('Configuration loaded successfully');
        } catch (error) {
            logger.error('Failed to load configuration:', error);
            throw error;
        }
    }

    async loadPresets() {
        const presetsDir = path.join(__dirname, '../config/presets');
        
        try {
            if (fs.existsSync(presetsDir)) {
                const presetFiles = fs.readdirSync(presetsDir).filter(file => file.endsWith('.json'));
                
                for (const file of presetFiles) {
                    const presetName = path.basename(file, '.json');
                    const presetPath = path.join(presetsDir, file);
                    const presetConfig = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
                    
                    this.presets.set(presetName, presetConfig);
                    logger.debug(`Preset loaded: ${presetName}`);
                }
            }
        } catch (error) {
            logger.warn('Failed to load presets:', error);
        }
    }

    async loadEnvironmentConfig() {
        const env = process.env.NODE_ENV || 'development';
        const configPath = path.join(__dirname, `../config/${env}.json`);
        
        try {
            if (fs.existsSync(configPath)) {
                const envConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.config = this.mergeConfigs(this.config, envConfig);
                logger.debug(`Environment config loaded: ${env}`);
            }
        } catch (error) {
            logger.warn(`Failed to load environment config for ${env}:`, error);
        }
    }

    mergeConfigs(baseConfig, overrideConfig) {
        const merged = { ...baseConfig };
        
        for (const key in overrideConfig) {
            if (overrideConfig[key] && typeof overrideConfig[key] === 'object' && !Array.isArray(overrideConfig[key])) {
                merged[key] = this.mergeConfigs(merged[key] || {}, overrideConfig[key]);
            } else {
                merged[key] = overrideConfig[key];
            }
        }
        
        return merged;
    }

    mergeSessionConfig(sessionConfig) {
        const baseConfig = { ...this.config };
        
        // Apply preset if specified
        if (sessionConfig.preset && this.presets.has(sessionConfig.preset)) {
            const presetConfig = this.presets.get(sessionConfig.preset);
            baseConfig.browserOptions = this.mergeConfigs(baseConfig.browserOptions, presetConfig.browserOptions || {});
            baseConfig.sessionOptions = this.mergeConfigs(baseConfig.sessionOptions, presetConfig.sessionOptions || {});
        }
        
        // Merge session-specific config
        return this.mergeConfigs(baseConfig, sessionConfig);
    }

    set(key, value) {
        const keys = key.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        logger.debug(`Config updated: ${key} = ${JSON.stringify(value)}`);
    }

    get(key) {
        const keys = key.split('.');
        let current = this.config;
        
        for (const k of keys) {
            if (current[k] === undefined) {
                return undefined;
            }
            current = current[k];
        }
        
        return current;
    }

    getPreset(presetName) {
        return this.presets.get(presetName);
    }

    getAvailablePresets() {
        return Array.from(this.presets.keys());
    }

    validateConfig(config) {
        const required = ['browser', 'viewport', 'timeout'];
        const errors = [];
        
        for (const field of required) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        if (config.viewport && (!config.viewport.width || !config.viewport.height)) {
            errors.push('Viewport must have width and height');
        }
        
        if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
            errors.push('Timeout must be a positive number');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            browser: this.config.browser,
            headless: this.config.headless,
            viewport: this.config.viewport,
            timeout: this.config.timeout,
            presets: this.getAvailablePresets(),
            plugins: Object.keys(this.config.plugins || {})
        };
    }
}

module.exports = ConfigManager;
