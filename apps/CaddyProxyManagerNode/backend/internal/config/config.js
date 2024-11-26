import { FolderManager } from './folders.js';
import logger from '../logger/logger.js';
import config from '../../config/index.js';

export class ConfigManager {
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