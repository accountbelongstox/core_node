// Importing required modules
    const logger = require('#@utils_logger');
    const { env } = require('#@globalvars');

    const DEFAULT_CONFIG = {
        HTTP_PORT: 3000,
        HTTP_HOST: '0.0.0.0',
        HTTP_STATIC_PATHS: [],
        HTTP_STATIC_PREFIX: '/',
    };

    class HttpConfig {
        static #instance = null;
        #config = {
            ...DEFAULT_CONFIG,
        };
        #env = null;

        constructor() {
            if (HttpConfig.#instance) {
                return HttpConfig.#instance;
            }
            HttpConfig.#instance = this;
        }

        async #ensureEnv() {
            if (!this.#env) {
                try {
                    if (env) {
                        this.#env = env;
                        return true;
                    }
                } catch (error) {
                    logger.warning('Failed to load environment:', error.message);
                }
                return false;
            }
            return true;
        }

        async loadConfig() {
            try {
                if (await this.#ensureEnv()) {
                    // Iterate through default config and load from environment
                    for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
                        const envKey = `${key}`;
                        let value = this.#env.getEnvValue(envKey);
                        if (value === undefined || value === null) {
                            // If environment variable doesn't exist, write default value
                            if (this.#env.setEnvValue) {
                                await this.#env.setEnvValue(envKey, String(defaultValue));
                                logger.info(`Setting default value for ${envKey}: ${defaultValue}`);
                            }
                            value = defaultValue;
                        }

                        // Special handling for numeric types
                        if (key === 'HTTP_PORT') {
                            this.#config[key] = parseInt(value, 10);
                        } 
                        // Special handling for array types
                        else if (key === 'HTTP_STATIC_PATHS') {
                            this.#config[key] = Array.isArray(value) ? value : [];
                        }
                        else {
                            this.#config[key] = value;
                        }
                    }

                    logger.success('HTTP configuration loaded from environment');
                }
            } catch (error) {
                logger.warning('Failed to load environment configuration:', error.message);
                logger.info('Using default HTTP configuration');
            }
        }

        get(key, defaultValue = null) {
            return this.#config[key] ?? defaultValue;
        }

        async set(key, value) {
            this.#config[key] = value;
            if (await this.#ensureEnv()) {
                const envKey = key.startsWith('HTTP_') ? key : `HTTP_${key}`;
                await this.#env.setEnvValue(envKey, String(value));
                logger.info(`Updated environment variable ${envKey}=${value}`);
            }
        }

        async getAll() {
            await this.loadConfig().catch(error => {
                logger.error('Failed to load initial configuration:', error.message);
            });
            return { ...this.#config };
        }

        /**
         * Update multiple configuration values
         * @param {Object} config Configuration object
         */
        async update(config) {
            for (const [key, value] of Object.entries(config)) {
                await this.set(key, value);
            }
        }

        /**
         * Get singleton instance
         * @returns {HttpConfig}
         */
        static getInstance() {
            if (!HttpConfig.#instance) {
                HttpConfig.#instance = new HttpConfig();
            }
            return HttpConfig.#instance;
        }
    }

    // Export singleton instance
    module.exports = HttpConfig.getInstance();