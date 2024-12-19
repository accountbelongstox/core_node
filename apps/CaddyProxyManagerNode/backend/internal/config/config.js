const { FolderManager } = require('./folders.js');
    const logger = require('../logger/logger.js');
    const config = require('../../config/index.js');

    class ConfigManager {
        static async init() {
            try {
                await FolderManager.init();
                logger.configure({
                    logThreshold: config.log.level,
                    formatter: config.log.format
                });
                logger.info('Configuration initialized');
                return true;
            } catch (error) {
                logger.error('ConfigInitError', error);
                throw error;
            }
        }

        static getConfig() {
            return { ...config };
        }

        static updateConfig(newConfig) {
            Object.assign(config, newConfig);
            logger.info('Configuration updated');
        }
    }

    module.exports = ConfigManager;