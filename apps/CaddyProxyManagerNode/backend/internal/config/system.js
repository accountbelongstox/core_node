const os = require('os');
    const config = require('../../config/index.js');
    const logger = require('../logger/logger.js');

    class SystemConfig {
        static #instance;
        #config;

        constructor() {
            if (SystemConfig.#instance) {
                return SystemConfig.#instance;
            }

            this.#config = {
                hostname: os.hostname(),
                platform: process.platform,
                arch: process.arch,
                cpus: os.cpus().length,
                memory: {
                    total: os.totalmem(),
                    free: os.freemem()
                },
                network: this.#getNetworkInterfaces(),
                env: process.env.NODE_ENV || 'development'
            };

            SystemConfig.#instance = this;
        }

        #getNetworkInterfaces() {
            const interfaces = os.networkInterfaces();
            const result = {};

            for (const [name, addrs] of Object.entries(interfaces)) {
                result[name] = addrs.filter(addr => !addr.internal);
            }

            return result;
        }

        getConfig() {
            return {
                ...this.#config,
                appConfig: config
            };
        }

        async updateSystemInfo() {
            try {
                this.#config.memory.free = os.freemem();
                this.#config.network = this.#getNetworkInterfaces();
                logger.debug('System information updated');
            } catch (error) {
                logger.error('SystemUpdateError', error);
                throw error;
            }
        }
    }

    const systemConfig = new SystemConfig();

    module.exports = { systemConfig };