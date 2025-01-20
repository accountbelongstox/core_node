const logger = require('#@logger');
let sequelize_db = null;
try {
    sequelize_db = require('#@/ncore/utils/db_tool/libs/sequelize_db.js');
} catch (error) {
    logger.error('Failed to initialize sequelize_db:', error);
}

async function cleanup() {
    if (sequelize_db) {
        try {
            await sequelize_db.closeAllDatabases();
        } catch (error) {
            logger.error('Error closing database connections:', error);
        }
    }else{
        logger.warn('No database connections to close');
    }
}

class ProcessHandler {
    constructor() {
        this.handlers = new Set();
        // Add database cleanup as the first shutdown handler
        this.addShutdownHandler(cleanup);
    }

    addShutdownHandler(handler) {
        this.handlers.add(handler);
    }

    removeShutdownHandler(handler) {
        this.handlers.delete(handler);
    }

    async executeShutdown(signal) {
        logger.info(`Received ${signal}. Graceful shutdown...`);
        for (const handler of this.handlers) {
            try {
                await handler();
            } catch (error) {
                logger.error(`Error during shutdown handler execution:`, error);
            }
        }
        process.exit(0);
    }

    initialize() {
        process.on('SIGINT', () => this.executeShutdown('SIGINT'));
        process.on('SIGTERM', () => this.executeShutdown('SIGTERM'));
        process.on('exit', () => {
            logger.info(`[Content] Process exited`);
        });
    }
}

const processHandler = new ProcessHandler();
processHandler.initialize();

module.exports = processHandler; 