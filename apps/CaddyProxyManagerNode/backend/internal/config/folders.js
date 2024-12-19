const fs = require('fs/promises');
    const path = require('path');
    const config = require('../../config/index.js');
    const logger = require('../logger/logger.js');

    class FolderManager {
        static async ensureExists(folderPath) {
            try {
                await fs.access(folderPath);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.mkdir(folderPath, { recursive: true });
                    logger.info(`Created folder: ${folderPath}`);
                } else {
                    throw error;
                }
            }
        }

        static async init() {
            const folders = [
                config.dataFolder,
                config.logFolder,
                path.dirname(config.caddyFile),
                path.dirname(config.privateKey)
            ];

            for (const folder of folders) {
                try {
                    await FolderManager.ensureExists(folder);
                } catch (error) {
                    logger.error('FolderCreateError', error);
                    throw error;
                }
            }
        }
    }

    module.exports = FolderManager;