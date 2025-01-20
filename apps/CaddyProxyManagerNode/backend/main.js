const config = require('./config/index.js');
    const { initDatabase } = require('./internal/database/sqlite.js');
    const jobQueue = require('./internal/jobqueue/main.js');
    const { server } = require('./internal/api/server.js');
    const logger = require('#@logger');
    const { assetManager } = require('./embed/main.js');

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