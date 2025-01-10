const { APP_DATA_DIR } = require('#@/ncore/gvar/gdir.js');
const logger = require('#@/ncore/utils/logger/index.js');

class DictInitController {
    constructor() {
        this.dataDir = APP_DATA_DIR;
    }

    async start() {
        try {
            logger.info('Initializing dictionary...');
            logger.info(`Data directory: ${this.dataDir}`);
            
            return {
                success: true,
                message: 'Dictionary initialized successfully',
                dataDir: this.dataDir
            };
        } catch (error) {
            logger.error('Error initializing dictionary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new DictInitController();

