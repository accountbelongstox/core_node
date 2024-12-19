const path = require('path');
    const fs = require('fs');
    const logger = require('../logger/index.js');
    const ConfigHelper = require('./ConfigHelper.js');
    const DEBUG_PRINT = false;

    // Flattened default configuration with uppercase keys
    const defaultConfig = {
        HTTP_PORT: 3000,
        HTTP_HOST: 'localhost',
        
        // CORS
        CORS_ENABLED: true,
        CORS_ORIGIN: '*',
        CORS_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        CORS_ALLOWED_HEADERS: ['Content-Type', 'Authorization'],
        CORS_CREDENTIALS: true,

        // SSL/HTTPS
        SSL_ENABLED: false,
        SSL_KEY: '',
        SSL_CERT: '',
        SSL_REJECT_UNAUTHORIZED: false,

        // WebSocket
        WEBSOCKET_ENABLED: true,
        WEBSOCKET_PATH: '/ws',
        WEBSOCKET_CLIENT_TRACKING: true,
        WEBSOCKET_DEFLATE: true,
        WEBSOCKET_MAX_PAYLOAD: 32 * 1024,

        // Security
        SECURITY_HELMET_ENABLED: true,
        SECURITY_CSP_ENABLED: false,
        SECURITY_CROSS_ORIGIN_ENABLED: false,
        SECURITY_RATE_LIMIT_ENABLED: true,
        SECURITY_RATE_LIMIT_WINDOW: 15 * 60 * 1000,
        SECURITY_RATE_LIMIT_MAX: 100,

        // Body Parser
        BODY_PARSER_JSON_ENABLED: true,
        BODY_PARSER_JSON_LIMIT: '1mb',
        BODY_PARSER_URLENCODED_ENABLED: true,
        BODY_PARSER_URLENCODED_EXTENDED: true,
        BODY_PARSER_URLENCODED_LIMIT: '1mb',

        // Compression
        COMPRESSION_ENABLED: true,
        COMPRESSION_LEVEL: 6,
        COMPRESSION_THRESHOLD: 1024,

        // Static Files
        STATIC_ENABLED: true,
        STATIC_PATH: path.join(process.cwd(), 'public'),
        STATIC_MAX_AGE: '1d',
        STATIC_ETAG: true,

        // Session
        SESSION_ENABLED: false,
        SESSION_SECRET: process.env.SESSION_SECRET || 'your-secret-key',
        SESSION_RESAVE: false,
        SESSION_SAVE_UNINITIALIZED: false,
        SESSION_COOKIE_SECURE: process.env.NODE_ENV === 'production',
        SESSION_COOKIE_MAX_AGE: 24 * 60 * 60 * 1000,

        // Logging
        LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        LOG_FORMAT: 'combined',
        LOG_SKIP_SUCCESS: true,

        // Error Handling
        ERROR_SHOW_STACK: process.env.NODE_ENV !== 'production',
        ERROR_SHOW_MESSAGE: true,
        ERROR_LOG_ERRORS: true,

        // Environment
        NODE_ENV: process.env.NODE_ENV || 'development'
    };

    const infoByDebug = (msg) => {
        if (DEBUG_PRINT) {
            logger.info(msg);
        }
    }

    const errorByDebug = (msg) => {
        if (DEBUG_PRINT) {
            logger.error(msg);
        }
    }

    const successByDebug = (msg) => {
        if (DEBUG_PRINT) {
            logger.success(msg);
        }
    }

    const debugByDebug = (msg) => {
        if (DEBUG_PRINT) {
            logger.debug(msg);
        }
    }

    const warningByDebug = (msg) => {
        if (DEBUG_PRINT) {
            logger.warning(msg);
        }
    }

    class ConfigManager {
        static #instance = null;
        #config = { ...defaultConfig };
        #changes = new Map();

        constructor() {
            if (ConfigManager.#instance) {
                return ConfigManager.#instance;
            }
            ConfigManager.#instance = this;
            this.#initConfig();
        }

        async #initConfig() {
            try {
                const { env } = await require('#@globalvars');
                if (env) {
                    // Get environment values
                    const envValues = env.getAllEnvValues();
                    
                    // Update config with environment values
                    this.updateConfig(envValues);

                    // Ensure required values exist
                    const requiredUpdates = await ConfigHelper.ensureRequiredValues(this.#config, env);
                    if (Object.keys(requiredUpdates).length > 0) {
                        // Update config with generated values
                        this.updateConfig(requiredUpdates);
                        infoByDebug('Generated missing required configuration values');
                    }

                    // Validate final configuration
                    const issues = ConfigHelper.validateConfig(this.#config);
                    if (issues.length > 0) {
                        errorByDebug('Configuration validation issues:');
                        issues.forEach(issue => errorByDebug(`- ${issue}`));
                        throw new Error('Invalid configuration');
                    }

                    successByDebug('Configuration initialized successfully');
                }
            } catch (error) {
                errorByDebug('Failed to initialize configuration:', error.message);
                throw error;
            }
        }

        // Update single configuration value
        updateConfig(key, value) {
            if (typeof key === 'object') {
                // Handle object input
                Object.entries(key).forEach(([k, v]) => {
                    this.#updateSingleConfig(k.toUpperCase(), v);
                });
            } else {
                // Handle single key-value pair
                this.#updateSingleConfig(key.toUpperCase(), value);
            }
            this.#logChanges();
        }

        // Internal method to update single config
        #updateSingleConfig(key, value) {
            let isNew = false;
            if (!this.#config.hasOwnProperty(key)) {
                isNew = true;
            }
            const oldValue = this.#config[key];
            this.#config[key] = this.#convertValue(value, oldValue);
            this.#changes.set(key, {
                oldValue,
                newValue: this.#config[key]
            });
            if (this.#config.hasOwnProperty(key) && isNew) {
                successByDebug(`New configuration key: ${key}`);
            } else {
                infoByDebug(`Updated configuration key: ${key}`);
            }
        }

        // Convert value to match original type
        #convertValue(value, originalValue) {
            if (typeof originalValue === 'number') {
                return Number(value);
            } else if (typeof originalValue === 'boolean') {
                return String(value).toLowerCase() === 'true';
            } else if (Array.isArray(originalValue)) {
                try {
                    return Array.isArray(value) ? value : JSON.parse(value);
                } catch {
                    return value.split(',').map(v => v.trim());
                }
            }
            return value;
        }

        // Log configuration changes
        #logChanges() {
            if (this.#changes.size > 0) {
                infoByDebug('\n=== Configuration Changes ===');
                infoByDebug(`Total changes: ${this.#changes.size}`);
                
                this.#changes.forEach((change, key) => {
                    infoByDebug(`${key}:`);
                    infoByDebug(`  Original: ${JSON.stringify(change.oldValue)}`);
                    infoByDebug(`  New:      ${JSON.stringify(change.newValue)}`);
                });
                
                infoByDebug('=== End Configuration Changes ===\n');
            }
        }

        // Get current configuration
        getConfig() {
            return { ...this.#config };
        }

        // Reset configuration to defaults
        resetConfig() {
            this.#config = { ...defaultConfig };
            this.#changes.clear();
            infoByDebug('Configuration reset to defaults');
        }

        static getInstance() {
            if (!ConfigManager.#instance) {
                ConfigManager.#instance = new ConfigManager();
            }
            return ConfigManager.#instance;
        }
    }

    const configManager = ConfigManager.getInstance();

    async function getConfig() {
        return configManager.getConfig();
    }

    function updateConfig(keyOrObject, value) {
        return configManager.updateConfig(keyOrObject, value);
    }

    function resetConfig() {
        return configManager.resetConfig();
    }

    module.exports = { 
        defaultConfig,
        getConfig, 
        updateConfig, 
        resetConfig 
    };