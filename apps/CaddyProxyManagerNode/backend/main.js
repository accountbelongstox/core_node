import config from './config/index.js';
import { initDatabase } from './internal/database/sqlite.js';
import jobQueue from './internal/jobqueue/main.js';
import { server } from './internal/api/server.js';
import logger from './internal/logger/logger.js';
import { assetManager } from './embed/main.js';

const version = '3.0.0';
const commit = 'abcdefgh';

// process.on('SIGINT', handleShutdown);
// process.on('SIGTERM', handleShutdown);

async function main() {
    try {
        config.version = version;
        config.commit = commit;

        await initDatabase();
        
        await assetManager.loadTemplates();
        
        const app = server.start();
        
        logger.info(`Server is running at http://${config.server.host}:${config.server.port}`);
        
        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM signal. Shutting down...');
            await closeDatabase();
            process.exit(0);
        });

    } catch (error) {
        logger.error('ShutdownError', error);
        process.exit(1);
    }
}

main(); 